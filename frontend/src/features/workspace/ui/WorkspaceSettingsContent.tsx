import { useState, type FormEvent } from 'react'
import { CircleAlert } from 'lucide-react'

import type { WorkspaceSummary } from '@/entities/workspace'
import { useDeleteWorkspace, useUpdateWorkspace } from '@/features/workspace'
import { Button } from '@/shared/ui/button'
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogTitle,
} from '@/shared/ui/dialog'
import { Input } from '@/shared/ui/input'
import { toast } from '@/shared/ui/toast'

type WorkspaceSettingsContentProps = {
  workspace: WorkspaceSummary
  accessToken: string
  onDeleted: () => void
}

function WorkspaceSettingsContent({
  workspace,
  accessToken,
  onDeleted,
}: WorkspaceSettingsContentProps) {
  const updateMutation = useUpdateWorkspace(accessToken)
  const deleteMutation = useDeleteWorkspace(accessToken)
  const [name, setName] = useState(workspace.name)
  const [deleteDialogOpen, setDeleteDialogOpen] = useState(false)

  const normalizedName = name.trim()
  const isNameValid = normalizedName.length > 0 && normalizedName.length <= 255
  const canSave =
    !workspace.isDefault &&
    isNameValid &&
    normalizedName !== workspace.name &&
    !updateMutation.isPending

  async function handleSave(event: FormEvent<HTMLFormElement>) {
    event.preventDefault()
    if (!canSave) return

    try {
      await updateMutation.mutateAsync({
        workspaceId: workspace.id,
        name: normalizedName,
      })
      setName(normalizedName)
      toast.success('워크스페이스 이름을 변경했어요')
    } catch {
      // Keep the entered name and let the mutation error explain the retry.
    }
  }

  async function handleDelete() {
    try {
      await deleteMutation.mutateAsync(workspace.id)
      toast.success('워크스페이스를 삭제했어요')
      onDeleted()
    } catch {
      // Keep the dialog open so the user can retry.
    }
  }

  return (
    <div className="flex flex-col">
      <h1 className="text-foreground-strong text-[20px] leading-7 font-semibold tracking-[-0.012em]">
        설정
      </h1>
      <section aria-labelledby="workspace-settings-general" className="mt-6">
        <h2
          id="workspace-settings-general"
          className="text-foreground-default text-[16px] leading-6 font-semibold"
        >
          일반
        </h2>
        <form
          className="mt-4 flex w-full max-w-[400px] flex-col items-start gap-4"
          onSubmit={handleSave}
        >
          <div className="flex w-full flex-col gap-2">
            <label
              className="text-foreground-default text-[14px] leading-5 font-semibold tracking-[0.0145em]"
              htmlFor="workspace-settings-name"
            >
              워크스페이스 이름
            </label>
            <Input
              id="workspace-settings-name"
              value={name}
              maxLength={255}
              readOnly={workspace.isDefault}
              aria-describedby={
                workspace.isDefault ? 'workspace-settings-name-note' : undefined
              }
              aria-invalid={!isNameValid}
              onChange={(event) => setName(event.target.value)}
            />
            {workspace.isDefault && (
              <p
                id="workspace-settings-name-note"
                className="text-caption text-foreground-secondary"
              >
                기본 워크스페이스의 이름은 변경할 수 없어요.
              </p>
            )}
          </div>
          {updateMutation.error && (
            <p className="text-caption text-status-danger" role="alert">
              워크스페이스 이름을 저장하지 못했어요. 다시 시도해주세요.
            </p>
          )}
          <Button type="submit" disabled={!canSave}>
            저장
          </Button>
        </form>
      </section>

      {!workspace.isDefault && (
        <section
          aria-labelledby="workspace-settings-danger-zone"
          className="mt-12 rounded-xl border border-border bg-background-default p-6"
        >
          <div className="flex items-start gap-3">
            <span className="flex size-10 shrink-0 items-center justify-center rounded-full bg-status-danger-subtle-bg text-status-danger">
              <CircleAlert aria-hidden="true" className="size-5" />
            </span>
            <div>
              <h2
                id="workspace-settings-danger-zone"
                className="text-foreground-default text-[16px] leading-6 font-semibold"
              >
                위험 구역
              </h2>
              <p className="text-caption text-foreground-secondary mt-1">
                워크스페이스와 내부 데이터가 함께 삭제됩니다.
              </p>
            </div>
          </div>
          <div className="mt-5 flex flex-col gap-4 rounded-lg border border-border p-4 sm:flex-row sm:items-center sm:justify-between">
            <div className="min-w-0">
              <h3 className="text-foreground-default text-label font-semibold">
                워크스페이스 삭제
              </h3>
              <p className="text-caption text-foreground-secondary mt-1">
                프로젝트와 화이트보드 문서를 삭제하고, 이 작업은 되돌릴 수 없어요.
              </p>
            </div>
            <Button
              type="button"
              variant="destructive"
              className="w-full shrink-0 sm:w-auto"
              onClick={() => setDeleteDialogOpen(true)}
            >
              워크스페이스 삭제
            </Button>
          </div>
        </section>
      )}

      <Dialog
        open={deleteDialogOpen}
        onOpenChange={(open) => {
          if (!deleteMutation.isPending) setDeleteDialogOpen(open)
        }}
      >
        <DialogContent className="max-w-[440px] gap-0 overflow-hidden p-0">
          <div className="p-6">
            <span className="flex size-11 items-center justify-center rounded-full bg-status-danger-subtle-bg text-status-danger">
              <CircleAlert aria-hidden="true" className="size-6" />
            </span>
            <DialogTitle className="mt-4 text-[20px] leading-7 font-bold tracking-[-0.012em]">
              {workspace.name}를 삭제할까요?
            </DialogTitle>
            <DialogDescription className="mt-2">
              워크스페이스 안의 모든 프로젝트와 화이트보드 문서가 함께 삭제돼요.
            </DialogDescription>
            <p className="text-caption text-status-danger mt-4 rounded-md bg-status-danger-subtle-bg p-3">
              삭제 후에는 복구할 수 없어요.
            </p>
            {deleteMutation.error && (
              <p className="text-caption text-status-danger mt-3" role="alert">
                워크스페이스를 삭제하지 못했어요. 다시 시도해주세요.
              </p>
            )}
          </div>
          <DialogFooter
            role="group"
            aria-label="워크스페이스 삭제 확인"
            className="border-t border-border px-6 py-4"
          >
            <Button
              type="button"
              variant="tertiary"
              disabled={deleteMutation.isPending}
              onClick={() => setDeleteDialogOpen(false)}
            >
              취소
            </Button>
            <Button
              type="button"
              variant="destructive"
              loading={deleteMutation.isPending}
              onClick={() => void handleDelete()}
            >
              워크스페이스 삭제
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  )
}

export { WorkspaceSettingsContent }
