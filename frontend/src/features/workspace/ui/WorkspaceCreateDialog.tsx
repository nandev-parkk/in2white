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
            새 워크스페이스 만들기
          </DialogTitle>
          <DialogDescription className="mt-2">
            함께 작업할 워크스페이스의 이름을 정해 주세요.
          </DialogDescription>
        </div>
        <form onSubmit={handleSubmit}>
          <div className="flex flex-col gap-1.5">
            <label
              className="text-label text-foreground-default font-medium"
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
            <p className="text-caption text-status-danger mt-3" role="alert">
              {error}
            </p>
          )}
          <DialogFooter
            role="group"
            aria-label="워크스페이스 생성 액션"
            className="border-border mt-6 border-t pt-5"
          >
            <Button
              type="button"
              variant="tertiary"
              disabled={loading}
              onClick={() => handleOpenChange(false)}
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
