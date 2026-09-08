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

  function handleOpenChange(nextOpen: boolean) {
    if (!nextOpen) setRequiredError(false)
    onOpenChange(nextOpen)
  }

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
      <DialogContent className="min-h-[227px] max-w-90 p-8">
        <DialogTitle className="text-[20px] leading-7 font-bold tracking-[-0.012em]">
          새 워크스페이스 만들기
        </DialogTitle>
        <form onSubmit={handleSubmit}>
          <div className="flex flex-col gap-1.5">
            <label
              className="text-foreground-default text-[14px] leading-[17px] font-semibold tracking-[0.0145em]"
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
          <DialogFooter
            role="group"
            aria-label="워크스페이스 생성 액션"
            className="mt-5"
          >
            <Button
              type="button"
              variant="tertiary"
              className="h-9 rounded-md px-4"
              disabled={loading}
              onClick={() => handleOpenChange(false)}
            >
              취소
            </Button>
            <Button
              type="submit"
              loading={loading}
              className="h-9 rounded-md px-4"
            >
              만들기
            </Button>
          </DialogFooter>
        </form>
      </DialogContent>
    </Dialog>
  )
}

export { WorkspaceCreateDialog }
