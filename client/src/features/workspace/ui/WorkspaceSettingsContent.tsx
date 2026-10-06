import { useState, type FormEvent } from 'react'
import { CircleAlert } from 'lucide-react'

import type { WorkspaceSummary } from '@/entities/workspace'
import { useDeleteWorkspace, useUpdateWorkspace } from '@/features/workspace'
import { Button } from '@in2white/ui/button'
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogTitle,
} from '@in2white/ui/dialog'
import { Input } from '@in2white/ui/input'
import { toast } from '@in2white/ui/toast'
import { MESSAGES } from '@/shared/constants/messages'

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
      toast.success(MESSAGES.workspace.toast.renamed)
    } catch {
      // Keep the entered name and let the mutation error explain the retry.
    }
  }

  async function handleDelete() {
    try {
      await deleteMutation.mutateAsync(workspace.id)
      toast.success(MESSAGES.workspace.toast.deleted)
      onDeleted()
    } catch {
      // Keep the dialog open so the user can retry.
    }
  }

  return (
    <div className="flex flex-col">
      <h1 className="text-foreground-strong text-[20px] leading-7 font-semibold tracking-[-0.012em]">
        {MESSAGES.workspace.heading.settings}
      </h1>
      <section aria-labelledby="workspace-settings-general" className="mt-6">
        <h2
          id="workspace-settings-general"
          className="text-foreground-default text-[16px] leading-6 font-semibold"
        >
          {MESSAGES.workspace.heading.generalSection}
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
              {MESSAGES.workspace.form.nameLabel}
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
                {MESSAGES.workspace.form.defaultNameLocked}
              </p>
            )}
          </div>
          {updateMutation.error && (
            <p className="text-caption text-status-danger" role="alert">
              {MESSAGES.workspace.error.renameFailed}
            </p>
          )}
          <Button type="submit" disabled={!canSave}>
            {MESSAGES.common.action.save}
          </Button>
        </form>
      </section>

      {!workspace.isDefault && (
        <section
          aria-labelledby="workspace-settings-danger-zone"
          className="border-border bg-background-default mt-12 rounded-xl border p-6"
        >
          <div className="flex items-start gap-3">
            <span className="bg-status-danger-subtle-bg text-status-danger flex size-10 shrink-0 items-center justify-center rounded-full">
              <CircleAlert aria-hidden="true" className="size-5" />
            </span>
            <div>
              <h2
                id="workspace-settings-danger-zone"
                className="text-foreground-default text-[16px] leading-6 font-semibold"
              >
                {MESSAGES.workspace.heading.dangerZone}
              </h2>
              <p className="text-caption text-foreground-secondary mt-1">
                {MESSAGES.workspace.confirm.dangerZoneDescription}
              </p>
            </div>
          </div>
          <div className="border-border mt-5 flex flex-col gap-4 rounded-lg border p-4 sm:flex-row sm:items-center sm:justify-between">
            <div className="min-w-0">
              <h3 className="text-foreground-default text-label font-semibold">
                {MESSAGES.workspace.action.delete}
              </h3>
              <p className="text-caption text-foreground-secondary mt-1">
                {MESSAGES.workspace.confirm.deleteScope}
              </p>
            </div>
            <Button
              type="button"
              variant="destructive"
              className="w-full shrink-0 sm:w-auto"
              onClick={() => setDeleteDialogOpen(true)}
            >
              {MESSAGES.workspace.action.delete}
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
        <DialogContent className="max-h-[calc(100dvh-2rem)] w-[calc(100%-2rem)] max-w-[440px] overflow-y-auto p-0 [&>div]:gap-0">
          <div className="flex flex-col px-6 py-7 text-center">
            <span className="bg-status-danger-subtle-bg text-status-danger flex size-12 items-center justify-center self-center rounded-full">
              <CircleAlert aria-hidden="true" className="size-6" />
            </span>
            <DialogTitle className="mt-4 text-[20px] leading-7 font-semibold break-words">
              {MESSAGES.workspace.confirm.deleteTitle(workspace.name)}
            </DialogTitle>
            <DialogDescription className="mt-2 break-words">
              {MESSAGES.workspace.confirm.deleteDescription}
            </DialogDescription>
            <p className="text-caption text-status-danger bg-status-danger-subtle-bg mt-4 w-full rounded-md p-3">
              {MESSAGES.workspace.confirm.deleteIrreversible}
            </p>
            {deleteMutation.error && (
              <p className="text-caption text-status-danger mt-3" role="alert">
                {MESSAGES.workspace.error.deleteFailed}
              </p>
            )}
          </div>
          <DialogFooter
            role="group"
            aria-label={MESSAGES.workspace.a11y.deleteConfirm}
            className="border-border w-full border-t px-6 py-4"
          >
            <Button
              type="button"
              variant="tertiary"
              disabled={deleteMutation.isPending}
              onClick={() => setDeleteDialogOpen(false)}
            >
              {MESSAGES.common.action.cancel}
            </Button>
            <Button
              type="button"
              variant="destructive"
              loading={deleteMutation.isPending}
              onClick={() => void handleDelete()}
            >
              {MESSAGES.workspace.action.delete}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  )
}

export { WorkspaceSettingsContent }
