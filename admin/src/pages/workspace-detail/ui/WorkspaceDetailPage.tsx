import { useState } from 'react'
import { Link, useNavigate } from '@tanstack/react-router'

import type {
  AdminWorkspaceMember,
  AdminWorkspaceProject,
  UpdateWorkspaceInput,
} from '@/entities/workspace'
import {
  WorkspaceEditDialog,
  WorkspaceMemberAddDialog,
  WorkspaceTransferOwnerDialog,
  isWorkspaceNotFound,
  useAddWorkspaceMember,
  useDeleteWorkspace,
  useRemoveWorkspaceMember,
  useTransferWorkspaceOwner,
  useUpdateWorkspace,
  useWorkspace,
} from '@/features/workspace'
import { MESSAGES } from '@/shared/constants/messages'
import { apiErrorMessage } from '@/shared/lib/api-error'
import { formatDate, formatDateTime } from '@/shared/lib/format-date'
import { Badge } from '@in2white/ui/badge'
import { Button } from '@in2white/ui/button'
import { ConfirmDialog } from '@in2white/ui/confirm-dialog'
import { ErrorState } from '@in2white/ui/error-state'
import { LoadingState } from '@in2white/ui/loading-state'
import { PageHeader } from '@in2white/ui/page-header'
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from '@in2white/ui/table'
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@in2white/ui/tabs'
import { toast } from '@in2white/ui/toast'

type OpenDialog =
  'edit' | 'transfer-owner' | 'add-member' | 'remove-member' | 'delete' | null

type WorkspaceDetailPageProps = {
  workspaceId: string
}

function DetailRow({ label, children }: { label: string; children: string }) {
  return (
    <div className="flex gap-3">
      <dt className="text-foreground-secondary w-32 shrink-0 text-[14px] leading-[1.429]">
        {label}
      </dt>
      <dd className="text-foreground-default min-w-0 text-[14px] leading-[1.429]">
        {children}
      </dd>
    </div>
  )
}

function MemberTable({
  members,
  onRemove,
}: {
  members: AdminWorkspaceMember[]
  onRemove: (member: AdminWorkspaceMember) => void
}) {
  if (members.length === 0) {
    return (
      <p className="text-foreground-secondary text-[14px]">
        {MESSAGES.workspace.empty.members}
      </p>
    )
  }

  return (
    <Table>
      <TableHeader>
        <TableRow>
          <TableHead>{MESSAGES.workspace.column.name}</TableHead>
          <TableHead>{MESSAGES.workspace.column.email}</TableHead>
          <TableHead>{MESSAGES.workspace.column.role}</TableHead>
          <TableHead>{MESSAGES.workspace.column.status}</TableHead>
          <TableHead>{MESSAGES.workspace.column.joinedAt}</TableHead>
          <TableHead />
        </TableRow>
      </TableHeader>
      <TableBody>
        {members.map((member) => (
          <TableRow key={member.userId}>
            <TableCell className="text-foreground-strong truncate font-medium">
              {member.name}
            </TableCell>
            <TableCell className="truncate">{member.email}</TableCell>
            <TableCell>{MESSAGES.workspace.role[member.role]}</TableCell>
            <TableCell>
              <Badge
                semantic={member.deactivatedAt === null ? 'success' : 'danger'}
              >
                {member.deactivatedAt === null
                  ? MESSAGES.workspace.status.active
                  : MESSAGES.workspace.status.deactivated}
              </Badge>
            </TableCell>
            <TableCell>{formatDate(member.joinedAt)}</TableCell>
            <TableCell>
              {/* 소유자 제거는 백엔드가 403으로 막는다. 버튼을 두면 막힌 작업을 계속 시도한다. */}
              {member.role !== 'owner' && (
                <Button
                  variant="tertiary"
                  aria-label={MESSAGES.workspace.a11y.removeMember(member.name)}
                  onClick={() => onRemove(member)}
                >
                  {MESSAGES.workspace.action.removeMember}
                </Button>
              )}
            </TableCell>
          </TableRow>
        ))}
      </TableBody>
    </Table>
  )
}

function ProjectTable({ projects }: { projects: AdminWorkspaceProject[] }) {
  if (projects.length === 0) {
    return (
      <p className="text-foreground-secondary text-[14px]">
        {MESSAGES.workspace.empty.projects}
      </p>
    )
  }

  return (
    <Table>
      <TableHeader>
        <TableRow>
          <TableHead>{MESSAGES.workspace.column.name}</TableHead>
          <TableHead>{MESSAGES.workspace.column.creator}</TableHead>
          <TableHead>{MESSAGES.workspace.column.documentCount}</TableHead>
          <TableHead>{MESSAGES.workspace.column.status}</TableHead>
          <TableHead>{MESSAGES.workspace.column.createdAt}</TableHead>
        </TableRow>
      </TableHeader>
      <TableBody>
        {projects.map((project) => (
          <TableRow key={project.id}>
            <TableCell className="text-foreground-strong truncate font-medium">
              {project.name}
            </TableCell>
            <TableCell className="truncate">{project.creator.name}</TableCell>
            <TableCell>
              {MESSAGES.workspace.detail.countSuffix(
                project.whiteboardDocumentCount,
              )}
            </TableCell>
            <TableCell>
              {/* 삭제된 프로젝트도 함께 보여준다 — 복구 대상을 찾는 것이 이 화면의 쓸모다. */}
              <Badge
                semantic={project.deletedAt === null ? 'success' : 'neutral'}
              >
                {project.deletedAt === null
                  ? MESSAGES.workspace.status.active
                  : MESSAGES.workspace.status.deleted}
              </Badge>
            </TableCell>
            <TableCell>{formatDate(project.createdAt)}</TableCell>
          </TableRow>
        ))}
      </TableBody>
    </Table>
  )
}

function WorkspaceDetailPage({ workspaceId }: WorkspaceDetailPageProps) {
  const navigate = useNavigate()
  const [openDialog, setOpenDialog] = useState<OpenDialog>(null)
  const [removeTarget, setRemoveTarget] = useState<AdminWorkspaceMember | null>(
    null,
  )

  const workspaceQuery = useWorkspace(workspaceId)
  const updateWorkspace = useUpdateWorkspace(workspaceId)
  const transferOwner = useTransferWorkspaceOwner(workspaceId)
  const addMember = useAddWorkspaceMember(workspaceId)
  const removeMember = useRemoveWorkspaceMember(workspaceId)
  const deleteWorkspace = useDeleteWorkspace(workspaceId)

  const detail = workspaceQuery.data
  const workspace = detail?.workspace

  function openWith(dialog: Exclude<OpenDialog, null>, reset: () => void) {
    reset()
    setOpenDialog(dialog)
  }

  /* 요청 중에는 닫지 않는다. 결과를 못 본 채 모달이 사라지면 성패를 알 수 없다. */
  function closeDialog(pending: boolean, reset: () => void) {
    return (open: boolean) => {
      if (!open && pending) return
      if (!open) {
        reset()
        setOpenDialog(null)
      }
    }
  }

  async function runAction(
    mutate: () => Promise<unknown>,
    successMessage: string,
    onDone?: () => void,
  ) {
    try {
      await mutate()
      toast.success(successMessage)
      setOpenDialog(null)
      onDone?.()
    } catch {
      return
    }
  }

  if (workspaceQuery.isLoading) {
    return <LoadingState label={MESSAGES.workspace.a11y.detailLoading} />
  }

  if (workspaceQuery.isError || !detail || !workspace) {
    const notFound = isWorkspaceNotFound(workspaceQuery.error)

    return (
      <ErrorState
        className="min-h-48"
        title={
          notFound
            ? MESSAGES.workspace.error.notFound
            : MESSAGES.workspace.error.detailLoadFailed
        }
        action={
          notFound ? undefined : (
            <Button
              variant="secondary"
              onClick={() => void workspaceQuery.refetch()}
            >
              {MESSAGES.common.action.retry}
            </Button>
          )
        }
      />
    )
  }

  return (
    <section className="flex min-w-0 flex-1 flex-col gap-6">
      <PageHeader
        breadcrumb={
          <Link
            to="/workspaces"
            className="text-foreground-secondary text-[14px] leading-[1.429] hover:underline"
          >
            {MESSAGES.workspace.heading.list}
          </Link>
        }
        title={workspace.name}
        action={
          workspace.isDefault ? (
            <Badge semantic="neutral">{MESSAGES.workspace.badge.default}</Badge>
          ) : undefined
        }
      />

      {/*
       * 기본 워크스페이스는 제품의 "사용자마다 기본 워크스페이스 하나" 불변식을 지탱한다.
       * 막힌 작업의 버튼을 아예 숨기고 이유를 한 줄로 알린다.
       */}
      {workspace.isDefault && (
        <p className="text-foreground-secondary text-[14px] leading-[1.429]">
          {MESSAGES.workspace.detail.defaultNotice}
        </p>
      )}

      <div className="flex flex-wrap gap-2">
        {!workspace.isDefault && (
          <Button
            variant="secondary"
            onClick={() => openWith('edit', updateWorkspace.reset)}
          >
            {MESSAGES.workspace.action.edit}
          </Button>
        )}
        <Button
          variant="secondary"
          onClick={() => openWith('transfer-owner', transferOwner.reset)}
        >
          {MESSAGES.workspace.action.transferOwner}
        </Button>
        {!workspace.isDefault && (
          <Button
            variant="destructive"
            onClick={() => openWith('delete', deleteWorkspace.reset)}
          >
            {MESSAGES.workspace.action.delete}
          </Button>
        )}
      </div>

      <section className="flex flex-col gap-3">
        <h2 className="text-foreground-strong text-[16px] leading-[1.4] font-bold">
          {MESSAGES.workspace.heading.basicInfo}
        </h2>
        <dl className="flex flex-col gap-2">
          <DetailRow label={MESSAGES.workspace.column.owner}>
            {MESSAGES.workspace.form.ownerOption(
              workspace.owner.name,
              workspace.owner.email,
            )}
          </DetailRow>
          <DetailRow label={MESSAGES.workspace.column.createdAt}>
            {formatDateTime(workspace.createdAt)}
          </DetailRow>
          <DetailRow label={MESSAGES.workspace.detail.updatedAt}>
            {formatDateTime(workspace.updatedAt)}
          </DetailRow>
        </dl>
      </section>

      <Tabs defaultValue="members">
        <TabsList>
          <TabsTrigger value="members">
            {MESSAGES.workspace.tab.members}
          </TabsTrigger>
          <TabsTrigger value="projects">
            {MESSAGES.workspace.tab.projects}
          </TabsTrigger>
        </TabsList>

        <TabsContent value="members" className="flex flex-col gap-3">
          {!workspace.isDefault && (
            <div className="flex justify-end">
              <Button onClick={() => openWith('add-member', addMember.reset)}>
                {MESSAGES.workspace.action.addMember}
              </Button>
            </div>
          )}
          <div className="w-full overflow-x-auto">
            <MemberTable
              members={detail.members}
              onRemove={(member) => {
                removeMember.reset()
                setRemoveTarget(member)
                setOpenDialog('remove-member')
              }}
            />
          </div>
        </TabsContent>

        <TabsContent value="projects">
          <div className="w-full overflow-x-auto">
            <ProjectTable projects={detail.projects} />
          </div>
        </TabsContent>
      </Tabs>

      {openDialog === 'edit' && (
        <WorkspaceEditDialog
          open
          workspace={workspace}
          onOpenChange={closeDialog(
            updateWorkspace.isPending,
            updateWorkspace.reset,
          )}
          onSubmit={(input: UpdateWorkspaceInput) =>
            void runAction(
              () => updateWorkspace.mutateAsync(input),
              MESSAGES.workspace.toast.updated,
            )
          }
          loading={updateWorkspace.isPending}
          error={
            updateWorkspace.error
              ? apiErrorMessage(updateWorkspace.error)
              : undefined
          }
        />
      )}

      {openDialog === 'transfer-owner' && (
        <WorkspaceTransferOwnerDialog
          open
          members={detail.members}
          onOpenChange={closeDialog(
            transferOwner.isPending,
            transferOwner.reset,
          )}
          onSubmit={(userId) =>
            void runAction(
              () => transferOwner.mutateAsync(userId),
              MESSAGES.workspace.toast.ownerTransferred,
            )
          }
          loading={transferOwner.isPending}
          error={
            transferOwner.error
              ? apiErrorMessage(transferOwner.error)
              : undefined
          }
        />
      )}

      {openDialog === 'add-member' && (
        <WorkspaceMemberAddDialog
          open
          members={detail.members}
          onOpenChange={closeDialog(addMember.isPending, addMember.reset)}
          onSubmit={(userId) =>
            void runAction(
              () => addMember.mutateAsync(userId),
              MESSAGES.workspace.toast.memberAdded,
            )
          }
          loading={addMember.isPending}
          error={addMember.error ? apiErrorMessage(addMember.error) : undefined}
        />
      )}

      {openDialog === 'remove-member' && removeTarget && (
        <ConfirmDialog
          open
          destructive
          title={MESSAGES.workspace.heading.removeMember}
          description={MESSAGES.workspace.confirm.removeMember(
            removeTarget.email,
          )}
          confirmLabel={MESSAGES.workspace.action.removeMember}
          onOpenChange={closeDialog(removeMember.isPending, removeMember.reset)}
          onConfirm={() =>
            void runAction(
              () => removeMember.mutateAsync(removeTarget.userId),
              MESSAGES.workspace.toast.memberRemoved,
            )
          }
          loading={removeMember.isPending}
          error={
            removeMember.error ? apiErrorMessage(removeMember.error) : undefined
          }
        />
      )}

      {openDialog === 'delete' && (
        <ConfirmDialog
          open
          destructive
          title={MESSAGES.workspace.heading.delete}
          description={MESSAGES.workspace.confirm.delete(workspace.name)}
          confirmLabel={MESSAGES.workspace.action.delete}
          onOpenChange={closeDialog(
            deleteWorkspace.isPending,
            deleteWorkspace.reset,
          )}
          onConfirm={() =>
            void runAction(
              () => deleteWorkspace.mutateAsync(),
              MESSAGES.workspace.toast.deleted,
              /* 삭제된 워크스페이스의 상세 화면에 남아 있을 수 없다. */
              () => void navigate({ to: '/workspaces', replace: true }),
            )
          }
          loading={deleteWorkspace.isPending}
          error={
            deleteWorkspace.error
              ? apiErrorMessage(deleteWorkspace.error)
              : undefined
          }
        />
      )}
    </section>
  )
}

export { WorkspaceDetailPage }
