import { useState } from 'react'
import { Link } from '@tanstack/react-router'

import type { AdminProject, AdminProjectDocument } from '@/entities/project'
import {
  isProjectNotFound,
  useDeleteProject,
  useProject,
  useRestoreProject,
} from '@/features/project'
import {
  useDeleteWhiteboardDocument,
  useRestoreWhiteboardDocument,
} from '@/features/whiteboard-document'
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
import { toast } from '@in2white/ui/toast'

type ProjectDetailPageProps = {
  projectId: string
}

/*
 * 프로젝트와 문서의 삭제·복구를 한 모달로 처리한다. 네 가지가 모두 "확인만 받는" 같은
 * 모양이라 모달을 네 개 두면 같은 코드가 네 번 생긴다.
 */
type ConfirmTarget =
  | { kind: 'project'; action: 'delete' | 'restore' }
  | {
      kind: 'document'
      action: 'delete' | 'restore'
      document: AdminProjectDocument
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

function DocumentTable({
  documents,
  onDelete,
  onRestore,
}: {
  documents: AdminProjectDocument[]
  onDelete: (document: AdminProjectDocument) => void
  onRestore: (document: AdminProjectDocument) => void
}) {
  if (documents.length === 0) {
    return (
      <p className="text-foreground-secondary text-[14px]">
        {MESSAGES.project.empty.documents}
      </p>
    )
  }

  return (
    <Table>
      <TableHeader>
        <TableRow>
          <TableHead>{MESSAGES.whiteboardDocument.column.name}</TableHead>
          <TableHead>{MESSAGES.whiteboardDocument.column.creator}</TableHead>
          <TableHead>{MESSAGES.whiteboardDocument.column.status}</TableHead>
          <TableHead>{MESSAGES.whiteboardDocument.column.createdAt}</TableHead>
          <TableHead />
        </TableRow>
      </TableHeader>
      <TableBody>
        {documents.map((document) => (
          <TableRow key={document.id}>
            <TableCell className="text-foreground-strong truncate font-medium">
              {document.name}
            </TableCell>
            <TableCell className="truncate">{document.creator.name}</TableCell>
            <TableCell>
              <Badge
                semantic={document.deletedAt === null ? 'success' : 'neutral'}
              >
                {document.deletedAt === null
                  ? MESSAGES.whiteboardDocument.status.active
                  : MESSAGES.whiteboardDocument.status.deleted}
              </Badge>
            </TableCell>
            <TableCell>{formatDate(document.createdAt)}</TableCell>
            <TableCell>
              {/* 삭제와 복구 중 가능한 하나만 둔다 — 둘 다 두면 막힌 작업을 누르게 된다. */}
              {document.deletedAt === null ? (
                <Button
                  variant="tertiary"
                  aria-label={MESSAGES.whiteboardDocument.a11y.delete(
                    document.name,
                  )}
                  onClick={() => onDelete(document)}
                >
                  {MESSAGES.whiteboardDocument.action.delete}
                </Button>
              ) : (
                <Button
                  variant="tertiary"
                  aria-label={MESSAGES.whiteboardDocument.a11y.restore(
                    document.name,
                  )}
                  onClick={() => onRestore(document)}
                >
                  {MESSAGES.whiteboardDocument.action.restore}
                </Button>
              )}
            </TableCell>
          </TableRow>
        ))}
      </TableBody>
    </Table>
  )
}

type DialogContent = {
  title: string
  description: string
  confirmLabel: string
}

function dialogContent(
  target: ConfirmTarget,
  project: AdminProject,
): DialogContent {
  if (target.kind === 'project') {
    return target.action === 'delete'
      ? {
          title: MESSAGES.project.heading.delete,
          description: MESSAGES.project.confirm.delete(project.name),
          confirmLabel: MESSAGES.project.action.delete,
        }
      : {
          title: MESSAGES.project.heading.restore,
          description: MESSAGES.project.confirm.restore(project.name),
          confirmLabel: MESSAGES.project.action.restore,
        }
  }

  if (target.action === 'delete') {
    return {
      title: MESSAGES.whiteboardDocument.heading.delete,
      description: MESSAGES.whiteboardDocument.confirm.delete(
        target.document.name,
      ),
      confirmLabel: MESSAGES.whiteboardDocument.action.delete,
    }
  }

  return {
    title: MESSAGES.whiteboardDocument.heading.restore,
    /* 프로젝트가 삭제된 상태면 문서만 복구해도 제품에서는 보이지 않는다. */
    description:
      project.deletedAt === null
        ? MESSAGES.whiteboardDocument.confirm.restore(target.document.name)
        : MESSAGES.whiteboardDocument.confirm.restoreUnderDeletedProject(
            target.document.name,
            project.name,
          ),
    confirmLabel: MESSAGES.whiteboardDocument.action.restore,
  }
}

function ProjectDetailPage({ projectId }: ProjectDetailPageProps) {
  const [confirmTarget, setConfirmTarget] = useState<ConfirmTarget | null>(null)

  const projectQuery = useProject(projectId)
  const deleteProject = useDeleteProject()
  const restoreProject = useRestoreProject()
  const deleteDocument = useDeleteWhiteboardDocument()
  const restoreDocument = useRestoreWhiteboardDocument()

  const detail = projectQuery.data
  const project = detail?.project

  function mutationFor(target: ConfirmTarget) {
    if (target.kind === 'project') {
      return target.action === 'delete' ? deleteProject : restoreProject
    }

    return target.action === 'delete' ? deleteDocument : restoreDocument
  }

  function openConfirm(target: ConfirmTarget) {
    mutationFor(target).reset()
    setConfirmTarget(target)
  }

  const activeMutation = confirmTarget
    ? mutationFor(confirmTarget)
    : deleteProject

  async function handleConfirm() {
    if (!confirmTarget) return

    const targetId =
      confirmTarget.kind === 'project' ? projectId : confirmTarget.document.id
    const messages =
      confirmTarget.kind === 'project'
        ? MESSAGES.project.toast
        : MESSAGES.whiteboardDocument.toast

    try {
      await activeMutation.mutateAsync(targetId)
      toast.success(
        confirmTarget.action === 'delete'
          ? messages.deleted
          : messages.restored,
      )
      setConfirmTarget(null)
    } catch {
      /* 실패 사유는 모달 안에 남긴다. 닫아버리면 무엇이 막혔는지 알 수 없다. */
      return
    }
  }

  if (projectQuery.isLoading) {
    return <LoadingState label={MESSAGES.project.a11y.detailLoading} />
  }

  if (projectQuery.isError || !detail || !project) {
    const notFound = isProjectNotFound(projectQuery.error)

    return (
      <ErrorState
        className="min-h-48"
        title={
          notFound
            ? MESSAGES.project.error.notFound
            : MESSAGES.project.error.detailLoadFailed
        }
        action={
          notFound ? undefined : (
            <Button
              variant="secondary"
              onClick={() => void projectQuery.refetch()}
            >
              {MESSAGES.common.action.retry}
            </Button>
          )
        }
      />
    )
  }

  const deleted = project.deletedAt !== null
  const content = confirmTarget ? dialogContent(confirmTarget, project) : null

  return (
    <section className="flex min-w-0 flex-1 flex-col gap-6">
      <PageHeader
        breadcrumb={
          <Link
            to="/projects"
            className="text-foreground-secondary text-[14px] leading-[1.429] hover:underline"
          >
            {MESSAGES.project.heading.list}
          </Link>
        }
        title={project.name}
        action={
          deleted ? (
            <Badge semantic="neutral">{MESSAGES.project.status.deleted}</Badge>
          ) : undefined
        }
      />

      {/*
       * 소프트 삭제라 삭제된 프로젝트도 이 화면에 남는다. 지금 제품에서 보이지 않는다는
       * 사실과 복구 버튼을 함께 둬야 어드민이 무엇을 할지 바로 안다.
       */}
      {project.deletedAt !== null && (
        <p className="text-foreground-secondary text-[14px] leading-[1.429]">
          {MESSAGES.project.detail.deletedNotice(
            formatDateTime(project.deletedAt),
          )}
        </p>
      )}

      <div className="flex flex-wrap gap-2">
        {deleted ? (
          <Button
            variant="secondary"
            aria-label={MESSAGES.project.heading.restore}
            onClick={() => openConfirm({ kind: 'project', action: 'restore' })}
          >
            {MESSAGES.project.action.restore}
          </Button>
        ) : (
          <Button
            variant="destructive"
            aria-label={MESSAGES.project.heading.delete}
            onClick={() => openConfirm({ kind: 'project', action: 'delete' })}
          >
            {MESSAGES.project.action.delete}
          </Button>
        )}
      </div>

      <section className="flex flex-col gap-3">
        <h2 className="text-foreground-strong text-[16px] leading-[1.4] font-bold">
          {MESSAGES.project.heading.basicInfo}
        </h2>
        <dl className="flex flex-col gap-2">
          <DetailRow label={MESSAGES.project.column.workspace}>
            {project.workspace.name}
          </DetailRow>
          <DetailRow label={MESSAGES.project.column.creator}>
            {`${project.creator.name} (${project.creator.email})`}
          </DetailRow>
          <DetailRow label={MESSAGES.project.detail.description}>
            {project.description ?? MESSAGES.project.detail.noDescription}
          </DetailRow>
          <DetailRow label={MESSAGES.project.column.createdAt}>
            {formatDateTime(project.createdAt)}
          </DetailRow>
          <DetailRow label={MESSAGES.project.detail.updatedAt}>
            {formatDateTime(project.updatedAt)}
          </DetailRow>
        </dl>
      </section>

      <section className="flex flex-col gap-3">
        <h2 className="text-foreground-strong text-[16px] leading-[1.4] font-bold">
          {MESSAGES.project.heading.documents}
        </h2>
        <div className="w-full overflow-x-auto">
          <DocumentTable
            documents={detail.whiteboardDocuments}
            onDelete={(document) =>
              openConfirm({ kind: 'document', action: 'delete', document })
            }
            onRestore={(document) =>
              openConfirm({ kind: 'document', action: 'restore', document })
            }
          />
        </div>
      </section>

      {confirmTarget && content && (
        <ConfirmDialog
          open
          destructive={confirmTarget.action === 'delete'}
          title={content.title}
          description={content.description}
          confirmLabel={content.confirmLabel}
          onOpenChange={(open) => {
            if (!open && !activeMutation.isPending) setConfirmTarget(null)
          }}
          onConfirm={() => void handleConfirm()}
          loading={activeMutation.isPending}
          error={
            activeMutation.error
              ? apiErrorMessage(activeMutation.error)
              : undefined
          }
        />
      )}
    </section>
  )
}

export { ProjectDetailPage }
