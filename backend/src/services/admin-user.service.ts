import { and, asc, count, desc, eq, ilike, isNotNull, isNull, ne, or, sql } from "drizzle-orm";
import type { PgUpdateSetSource } from "drizzle-orm/pg-core";
import { ERROR_MESSAGES } from "@/constants/messages";
import { db } from "@/db/client";
import {
  projects,
  users,
  whiteboardDocuments,
  workspaceMemberships,
  workspaces,
} from "@/db/schema";
import type { TransactionHandle } from "@/db/transaction";
import type { UserStatusFilter } from "@/schemas/admin-user.schema";
import { DEFAULT_WORKSPACE_NAME } from "@/services/user.service";
import { HttpError } from "@/utils/http-error";
import type { PaginationMeta } from "@/utils/pagination";
import { createPaginationMeta, getPaginationOffset } from "@/utils/pagination";
import { buildContainsSearchPattern } from "@/utils/search";

/*
 * 어드민의 사용자 조작만 담당한다. 제품 서비스와 달리 요청자의 소속을 확인하지 않는다 —
 * 어드민은 모든 사용자를 볼 수 있다는 전제이고, 권한은 `authenticateAdmin`이 지킨다.
 * 감사 로그는 컨트롤러가 기록한다. 변경 함수는 그래서 트랜잭션 핸들을 인자로 받는다.
 */

/** 비밀번호 해시와 `sessionVersion`을 뺀 응답용 모양. 목록·상세·변경 응답이 모두 이 형태를 따른다. */
const USER_SUMMARY_COLUMNS = {
  id: users.id,
  name: users.name,
  email: users.email,
  deactivatedAt: users.deactivatedAt,
  createdAt: users.createdAt,
} as const;

export interface AdminUserSummary {
  id: string;
  name: string;
  email: string;
  deactivatedAt: Date | null;
  createdAt: Date;
}

export interface AdminUserListItem extends AdminUserSummary {
  workspaceCount: number;
}

export interface ListUsersInput {
  search?: string;
  status: UserStatusFilter;
  page: number;
  limit: number;
}

export interface ListUsersResult {
  users: AdminUserListItem[];
  pagination: PaginationMeta;
}

export interface AdminUserWorkspace {
  id: string;
  name: string;
  isDefault: boolean;
  role: (typeof workspaceMemberships.$inferSelect)["role"];
  joinedAt: Date;
}

export interface AdminUserDetail {
  user: AdminUserSummary;
  workspaces: AdminUserWorkspace[];
  createdProjectCount: number;
  createdWhiteboardDocumentCount: number;
}

export interface UpdateUserFieldsInput {
  userId: string;
  name?: string;
  email?: string;
}

export interface UpdateUserResult {
  previousUser: AdminUserSummary;
  user: AdminUserSummary;
}

export interface ResetUserPasswordInput {
  userId: string;
  passwordHash: string;
}

export interface CreateUserInput {
  email: string;
  name: string;
  passwordHash: string;
}

function emailAlreadyExists() {
  return new HttpError(409, "EMAIL_ALREADY_EXISTS", ERROR_MESSAGES.EMAIL_ALREADY_EXISTS);
}

function userNotFound() {
  return new HttpError(404, "USER_NOT_FOUND", ERROR_MESSAGES.USER_NOT_FOUND);
}

/*
 * 변경 전 값을 함께 돌려준다. 감사 로그 `metadata`에 before/after를 남기는 계약이 있어서
 * 컨트롤러가 변경 전 상태를 따로 조회하지 않아도 되도록 서비스가 한 번에 읽는다.
 */
async function applyUserUpdate(
  tx: TransactionHandle,
  userId: string,
  values: PgUpdateSetSource<typeof users>,
): Promise<UpdateUserResult> {
  const [previousUser] = await tx
    .select(USER_SUMMARY_COLUMNS)
    .from(users)
    .where(eq(users.id, userId));

  if (!previousUser) {
    throw userNotFound();
  }

  const [user] = await tx
    .update(users)
    .set(values)
    .where(eq(users.id, userId))
    .returning(USER_SUMMARY_COLUMNS);

  // 선행 조회와 update 사이에 계정이 지워진 경우다. 없는 사용자로 응답하는 게 맞다.
  if (!user) {
    throw userNotFound();
  }

  return { previousUser, user };
}

/*
 * 세션 무효화의 기준점이다. refresh 갱신은 토큰의 `ver`와 저장된 `sessionVersion`을
 * 비교하므로, 이 값이 오르면 이미 발급된 refresh 토큰은 모두 거부된다.
 */
const BUMP_SESSION_VERSION = sql`${users.sessionVersion} + 1`;

function buildStatusCondition(status: UserStatusFilter) {
  if (status === "active") return isNull(users.deactivatedAt);
  if (status === "deactivated") return isNotNull(users.deactivatedAt);
  return undefined;
}

export async function listUsers({
  search,
  status,
  page,
  limit,
}: ListUsersInput): Promise<ListUsersResult> {
  const pattern = search ? buildContainsSearchPattern(search) : undefined;
  const whereCondition = and(
    pattern ? or(ilike(users.name, pattern), ilike(users.email, pattern)) : undefined,
    buildStatusCondition(status),
  );

  const [countRows, userRows] = await Promise.all([
    db.select({ total: count() }).from(users).where(whereCondition),
    db
      .select({ ...USER_SUMMARY_COLUMNS, workspaceCount: count(workspaceMemberships.id) })
      .from(users)
      /*
       * 멤버십을 join하면 사용자당 행이 늘어나므로 묶어서 센다. left join이라 멤버십이
       * 없는 사용자도 0으로 남는다 — 목록에서 사라지면 정지·삭제 대상을 찾을 수 없다.
       */
      .leftJoin(workspaceMemberships, eq(workspaceMemberships.userId, users.id))
      .where(whereCondition)
      .groupBy(users.id)
      .orderBy(desc(users.createdAt), asc(users.id))
      .limit(limit)
      .offset(getPaginationOffset({ page, limit })),
  ]);

  return {
    users: userRows.map((row) => ({ ...row, workspaceCount: Number(row.workspaceCount) })),
    pagination: createPaginationMeta({ page, limit, total: Number(countRows[0]?.total ?? 0) }),
  };
}

export async function createUser(
  tx: TransactionHandle,
  { email, name, passwordHash }: CreateUserInput,
): Promise<AdminUserSummary> {
  const normalizedEmail = email.trim().toLowerCase();

  // 저장된 이메일의 케이스에 의존하지 않고 비교한다. 제품 로그인도 같은 방식으로 찾는다.
  const [existingUser] = await tx
    .select({ id: users.id })
    .from(users)
    .where(sql`lower(${users.email}) = ${normalizedEmail}`);

  if (existingUser) {
    throw emailAlreadyExists();
  }

  const [user] = await tx
    .insert(users)
    .values({ email: normalizedEmail, name, passwordHash })
    .onConflictDoNothing()
    .returning(USER_SUMMARY_COLUMNS);

  // 사전 조회와 insert 사이에 같은 이메일이 들어온 경합. 제약이 막아준 결과도 중복이다.
  if (!user) {
    throw emailAlreadyExists();
  }

  /*
   * 제품 가입과 같은 불변식이다 — 모든 사용자는 기본 워크스페이스를 하나 가진다.
   * 같은 트랜잭션에서 만들지 않으면 워크스페이스 없는 계정이 남아 제품 화면이 빈다.
   */
  const [defaultWorkspace] = await tx
    .insert(workspaces)
    .values({ name: DEFAULT_WORKSPACE_NAME, ownerId: user.id, isDefault: true })
    .returning({ id: workspaces.id });

  if (!defaultWorkspace) {
    throw new Error("Default workspace insert returned no row");
  }

  await tx
    .insert(workspaceMemberships)
    .values({ workspaceId: defaultWorkspace.id, userId: user.id, role: "owner" });

  return user;
}

export async function getUserDetail(userId: string): Promise<AdminUserDetail> {
  const [user] = await db.select(USER_SUMMARY_COLUMNS).from(users).where(eq(users.id, userId));

  if (!user) {
    throw userNotFound();
  }

  const [workspaceRows, projectCountRows, documentCountRows] = await Promise.all([
    db
      .select({
        id: workspaces.id,
        name: workspaces.name,
        isDefault: workspaces.isDefault,
        role: workspaceMemberships.role,
        joinedAt: workspaceMemberships.createdAt,
      })
      .from(workspaceMemberships)
      .innerJoin(workspaces, eq(workspaceMemberships.workspaceId, workspaces.id))
      .where(eq(workspaceMemberships.userId, userId))
      // 기본 워크스페이스를 맨 위에 둔다 — 하드 삭제 판단의 기준이 되는 워크스페이스다.
      .orderBy(desc(workspaces.isDefault), asc(workspaces.name), asc(workspaces.id)),
    /*
     * 소프트 삭제된 리소스는 제품에서 이미 보이지 않으므로 제외한다. 하드 삭제로 함께
     * 사라지는 전체 범위는 `getUserDeletionImpact`가 따로 센다.
     */
    db
      .select({ total: count() })
      .from(projects)
      .where(and(eq(projects.creatorId, userId), isNull(projects.deletedAt))),
    db
      .select({ total: count() })
      .from(whiteboardDocuments)
      .where(and(eq(whiteboardDocuments.creatorId, userId), isNull(whiteboardDocuments.deletedAt))),
  ]);

  return {
    user,
    workspaces: workspaceRows,
    createdProjectCount: Number(projectCountRows[0]?.total ?? 0),
    createdWhiteboardDocumentCount: Number(documentCountRows[0]?.total ?? 0),
  };
}

export async function updateUser(
  tx: TransactionHandle,
  { userId, name, email }: UpdateUserFieldsInput,
): Promise<UpdateUserResult> {
  const [previousUser] = await tx
    .select(USER_SUMMARY_COLUMNS)
    .from(users)
    .where(eq(users.id, userId));

  if (!previousUser) {
    throw userNotFound();
  }

  const normalizedEmail = email?.trim().toLowerCase();

  if (normalizedEmail !== undefined) {
    /*
     * 자기 자신은 제외한다. 같은 이메일을 그대로 다시 보내는 요청까지 중복으로 막으면
     * 이름과 이메일을 함께 보내는 화면이 저장할 수 없게 된다.
     */
    const [duplicateUser] = await tx
      .select({ id: users.id })
      .from(users)
      .where(and(sql`lower(${users.email}) = ${normalizedEmail}`, ne(users.id, userId)));

    if (duplicateUser) {
      throw emailAlreadyExists();
    }
  }

  /*
   * 이메일이 바뀌어도 세션은 유지한다. 제품 인증은 `sub`로 사용자를 찾고 이메일은
   * 표시용이라, 여기서 세션을 끊으면 이름 수정과 같은 변경이 사용자를 로그아웃시킨다.
   */
  const [user] = await tx
    .update(users)
    .set({
      ...(name !== undefined ? { name } : {}),
      ...(normalizedEmail !== undefined ? { email: normalizedEmail } : {}),
    })
    .where(eq(users.id, userId))
    .returning(USER_SUMMARY_COLUMNS);

  if (!user) {
    throw userNotFound();
  }

  return { previousUser, user };
}

export async function resetUserPassword(
  tx: TransactionHandle,
  { userId, passwordHash }: ResetUserPasswordInput,
): Promise<UpdateUserResult> {
  /* 비밀번호가 바뀌면 기존 세션은 모두 끊는다 — 탈취된 세션을 남겨두면 재설정이 무의미하다. */
  return applyUserUpdate(tx, userId, { passwordHash, sessionVersion: BUMP_SESSION_VERSION });
}

export async function deactivateUser(
  tx: TransactionHandle,
  userId: string,
): Promise<UpdateUserResult> {
  /*
   * 이미 정지된 계정에 다시 요청이 와도 처음 정지 시각을 유지한다. 시각을 덮어쓰면
   * 언제부터 막혔는지 알 수 없어진다. 정지는 곧 세션 차단이므로 세션 버전도 올린다.
   */
  return applyUserUpdate(tx, userId, {
    deactivatedAt: sql`coalesce(${users.deactivatedAt}, now())`,
    sessionVersion: BUMP_SESSION_VERSION,
  });
}

export async function reactivateUser(
  tx: TransactionHandle,
  userId: string,
): Promise<UpdateUserResult> {
  /* 정지 시점에 세션을 이미 끊었으므로 해제할 때는 건드리지 않는다. */
  return applyUserUpdate(tx, userId, { deactivatedAt: null });
}

export async function revokeUserSessions(
  tx: TransactionHandle,
  userId: string,
): Promise<UpdateUserResult> {
  return applyUserUpdate(tx, userId, { sessionVersion: BUMP_SESSION_VERSION });
}
