import { useEffect, useState, type FormEvent } from 'react'

import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogTitle,
} from '@/shared/ui/dialog'
import { Input } from '@/shared/ui/input'
import { Button } from '@/shared/ui/button'
import { MESSAGES } from '@/shared/constants/messages'

type WorkspaceCreateDialogProps = {
  open: boolean
  onOpenChange: (open: boolean) => void
  onSubmit: (name: string) => void
  loading?: boolean
  error?: string
}

function WorkspaceCreateDialog({
  open,
  onOpenChange,
  onSubmit,
  loading = false,
  error,
}: WorkspaceCreateDialogProps) {
  const [name, setName] = useState('')
  const [requiredError, setRequiredError] = useState(false)

  function resetForm() {
    setName('')
    setRequiredError(false)
  }

  function handleOpenChange(nextOpen: boolean) {
    if (!nextOpen) resetForm()
    onOpenChange(nextOpen)
  }

  useEffect(() => {
    if (!open) {
      queueMicrotask(() => {
        setName('')
        setRequiredError(false)
      })
    }
  }, [open])

  function handleSubmit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault()

    if (loading) return

    const trimmedName = name.trim()
    if (!trimmedName) {
      setRequiredError(true)
      return
    }

    setRequiredError(false)
    onSubmit(trimmedName)
  }

  return (
    <Dialog open={open} onOpenChange={handleOpenChange}>
      <DialogContent className="max-h-[calc(100dvh-2rem)] w-[calc(100%-2rem)] max-w-[440px] overflow-y-auto p-7">
        <div>
          <DialogTitle className="text-[20px] leading-7 font-semibold">
            {MESSAGES.workspace.action.create}
          </DialogTitle>
          <DialogDescription className="mt-2">
            {MESSAGES.workspace.form.dialogDescription}
          </DialogDescription>
        </div>
        <form onSubmit={handleSubmit}>
          <div className="flex flex-col gap-1.5">
            <label
              className="text-label text-foreground-default font-medium"
              htmlFor="workspace-name"
            >
              {MESSAGES.common.label.name}
            </label>
            <Input
              id="workspace-name"
              value={name}
              onChange={(event) => {
                setName(event.target.value)
                if (requiredError) setRequiredError(false)
              }}
              placeholder={MESSAGES.workspace.form.namePlaceholder}
              aria-invalid={requiredError}
              aria-describedby={
                requiredError ? 'workspace-name-error' : undefined
              }
            />
            {requiredError && (
              <p
                id="workspace-name-error"
                className="text-caption text-status-danger"
              >
                {MESSAGES.workspace.form.nameRequired}
              </p>
            )}
          </div>
          {error && (
            <p className="text-caption text-status-danger mt-3" role="alert">
              {error}
            </p>
          )}
          <DialogFooter
            role="group"
            aria-label={MESSAGES.workspace.a11y.createActions}
            className="border-border mt-6 border-t pt-5"
          >
            <Button
              type="button"
              variant="tertiary"
              disabled={loading}
              onClick={() => handleOpenChange(false)}
            >
              {MESSAGES.common.action.cancel}
            </Button>
            <Button type="submit" loading={loading}>
              {MESSAGES.common.action.create}
            </Button>
          </DialogFooter>
        </form>
      </DialogContent>
    </Dialog>
  )
}

export { WorkspaceCreateDialog }
