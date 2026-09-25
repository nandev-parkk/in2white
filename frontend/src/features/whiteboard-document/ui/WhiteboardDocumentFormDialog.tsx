import { useState, type FormEvent } from 'react'

import type { WhiteboardDocumentInput } from '@/entities/whiteboard-document'
import { MESSAGES } from '@/shared/constants/messages'
import { Button } from '@/shared/ui/button'
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogTitle,
} from '@/shared/ui/dialog'
import { Input } from '@/shared/ui/input'

type WhiteboardDocumentFormDialogProps = {
  open: boolean
  title: string
  submitLabel: string
  onOpenChange: (open: boolean) => void
  onSubmit: (input: WhiteboardDocumentInput) => void
  initialName?: string
  loading?: boolean
  error?: string
}

function WhiteboardDocumentFormDialog({
  open,
  title,
  submitLabel,
  onOpenChange,
  onSubmit,
  initialName = '',
  loading = false,
  error,
}: WhiteboardDocumentFormDialogProps) {
  const [name, setName] = useState(initialName)
  const [validationError, setValidationError] = useState<string | null>(null)

  function handleSubmit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault()

    if (loading) return

    const trimmedName = name.trim()
    if (!trimmedName) {
      setValidationError(MESSAGES.WHITEBOARD_NAME_REQUIRED)
      return
    }
    if (trimmedName.length > 50) {
      setValidationError(MESSAGES.WHITEBOARD_NAME_TOO_LONG)
      return
    }

    setValidationError(null)
    onSubmit({ name: trimmedName })
  }

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-h-[calc(100dvh-2rem)] w-[calc(100%-2rem)] max-w-[440px] overflow-y-auto p-7">
        <div>
          <DialogTitle className="text-[20px] leading-7 font-semibold">
            {title}
          </DialogTitle>
          <DialogDescription className="mt-2">
            화이트보드의 이름을 정해 주세요.
          </DialogDescription>
        </div>
        <form onSubmit={handleSubmit}>
          <div className="flex flex-col gap-1.5">
            <label
              className="text-label text-foreground-default font-medium"
              htmlFor="whiteboard-document-name"
            >
              이름
            </label>
            <Input
              id="whiteboard-document-name"
              value={name}
              disabled={loading}
              onChange={(event) => {
                setName(event.target.value)
                if (validationError) setValidationError(null)
              }}
              placeholder="예: 킥오프 화이트보드"
              maxLength={50}
              aria-invalid={Boolean(validationError)}
              aria-describedby={
                validationError ? 'whiteboard-document-name-error' : undefined
              }
            />
            {validationError && (
              <p
                id="whiteboard-document-name-error"
                className="text-caption text-status-danger"
              >
                {validationError}
              </p>
            )}
          </div>
          {error && (
            <p className="text-caption text-status-danger mt-3" role="alert">
              {error}
            </p>
          )}
          <DialogFooter className="border-border mt-6 border-t pt-5">
            <Button
              type="button"
              variant="tertiary"
              disabled={loading}
              onClick={() => onOpenChange(false)}
            >
              취소
            </Button>
            <Button type="submit" loading={loading}>
              {submitLabel}
            </Button>
          </DialogFooter>
        </form>
      </DialogContent>
    </Dialog>
  )
}

export { WhiteboardDocumentFormDialog }
