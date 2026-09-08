import { useState, type FormEvent } from 'react'

import {
  Dialog,
  DialogContent,
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
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="h-[227px] max-w-90 overflow-y-auto p-8">
        <DialogTitle>새 워크스페이스 만들기</DialogTitle>
        <form onSubmit={handleSubmit}>
          <div className="flex flex-col gap-2">
            <label
              className="text-label text-foreground-default"
              htmlFor="workspace-name"
            >
              이름
            </label>
            <Input
              id="workspace-name"
              value={name}
              onChange={(event) => {
                setName(event.target.value)
                if (requiredError) setRequiredError(false)
              }}
              placeholder="예: 마케팅팀"
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
                {MESSAGES.WORKSPACE_NAME_REQUIRED}
              </p>
            )}
          </div>
          {error && (
            <p className="text-caption text-status-danger" role="alert">
              {error}
            </p>
          )}
          <DialogFooter className="mt-1">
            <Button
              type="button"
              variant="tertiary"
              disabled={loading}
              onClick={() => onOpenChange(false)}
            >
              취소
            </Button>
            <Button type="submit" loading={loading}>
              만들기
            </Button>
          </DialogFooter>
        </form>
      </DialogContent>
    </Dialog>
  )
}

export { WorkspaceCreateDialog }
