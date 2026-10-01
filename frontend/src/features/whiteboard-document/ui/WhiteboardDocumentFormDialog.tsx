import { useState, type FormEvent } from 'react'

import type { WhiteboardDocumentInput } from '@/entities/whiteboard-document'
import { MESSAGES } from '@/shared/constants/messages'
import { Button } from '@in2white/ui/button'
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogTitle,
} from '@in2white/ui/dialog'
import { Input } from '@in2white/ui/input'

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
      setValidationError(MESSAGES.whiteboard.form.nameRequired)
      return
    }
    if (trimmedName.length > 50) {
      setValidationError(MESSAGES.whiteboard.form.nameTooLong)
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
            {MESSAGES.whiteboard.form.dialogDescription}
          </DialogDescription>
        </div>
        <form onSubmit={handleSubmit}>
          <div className="flex flex-col gap-1.5">
            <label
              className="text-label text-foreground-default font-medium"
              htmlFor="whiteboard-document-name"
            >
              {MESSAGES.common.label.name}
            </label>
            <Input
              id="whiteboard-document-name"
              value={name}
              disabled={loading}
              onChange={(event) => {
                setName(event.target.value)
                if (validationError) setValidationError(null)
              }}
              placeholder={MESSAGES.whiteboard.form.namePlaceholder}
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
              {MESSAGES.common.action.cancel}
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
