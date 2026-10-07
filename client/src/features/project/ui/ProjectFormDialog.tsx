import { useState, type FormEvent } from 'react'

import type { CreateProjectInput } from '@/entities/project'
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
import { Textarea } from '@in2white/ui/textarea'

type ProjectFormDialogProps = {
  open: boolean
  title: string
  submitLabel: string
  onOpenChange: (open: boolean) => void
  onSubmit: (input: CreateProjectInput) => void
  initialName?: string
  initialDescription?: string | null
  loading?: boolean
  error?: string
}

type ValidationError = {
  field: 'name' | 'description'
  message: string
}

function ProjectFormDialog({
  open,
  title,
  submitLabel,
  onOpenChange,
  onSubmit,
  initialName = '',
  initialDescription = null,
  loading = false,
  error,
}: ProjectFormDialogProps) {
  const [name, setName] = useState(initialName)
  const [description, setDescription] = useState(initialDescription ?? '')
  const [validationError, setValidationError] =
    useState<ValidationError | null>(null)

  function handleSubmit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault()

    if (loading) return

    const trimmedName = name.trim()
    if (!trimmedName) {
      setValidationError({
        field: 'name',
        message: MESSAGES.project.form.nameRequired,
      })
      return
    }
    if (trimmedName.length > 50) {
      setValidationError({
        field: 'name',
        message: MESSAGES.project.form.nameTooLong,
      })
      return
    }

    const trimmedDescription = description.trim()
    if (trimmedDescription.length > 200) {
      setValidationError({
        field: 'description',
        message: MESSAGES.project.form.descriptionTooLong,
      })
      return
    }

    setValidationError(null)
    onSubmit({
      name: trimmedName,
      description: trimmedDescription || null,
    })
  }

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent
        className="max-h-[calc(100dvh-2rem)] w-[calc(100%-2rem)] max-w-[440px] overflow-y-auto p-7"
        onOpenAutoFocus={(event) => {
          if (initialName) return

          const content = event.currentTarget
          if (!(content instanceof HTMLElement)) return

          const nameInput =
            content.querySelector<HTMLInputElement>('#project-name')
          if (!nameInput) return

          event.preventDefault()
          nameInput.focus({ preventScroll: true })
        }}
      >
        <div>
          <DialogTitle className="text-[20px] leading-7 font-semibold">
            {title}
          </DialogTitle>
          <DialogDescription className="mt-2">
            {MESSAGES.project.form.dialogDescription}
          </DialogDescription>
        </div>
        <form onSubmit={handleSubmit}>
          <div className="flex flex-col gap-5">
            <div className="flex flex-col gap-1.5">
              <label
                className="text-label text-foreground-default font-medium"
                htmlFor="project-name"
              >
                {MESSAGES.common.label.name}
              </label>
              <Input
                id="project-name"
                value={name}
                disabled={loading}
                onChange={(event) => {
                  setName(event.target.value)
                  if (validationError?.field === 'name')
                    setValidationError(null)
                }}
                placeholder={MESSAGES.project.form.namePlaceholder}
                maxLength={50}
                aria-invalid={validationError?.field === 'name'}
                aria-describedby={
                  validationError?.field === 'name'
                    ? 'project-name-error'
                    : undefined
                }
              />
              {validationError?.field === 'name' && (
                <p
                  id="project-name-error"
                  className="text-caption text-status-danger"
                >
                  {validationError.message}
                </p>
              )}
            </div>
            <div className="flex flex-col gap-1.5">
              <label
                className="text-label text-foreground-default font-medium"
                htmlFor="project-description"
              >
                {MESSAGES.project.form.descriptionLabel}{' '}
                <span className="text-foreground-tertiary">
                  {MESSAGES.project.form.optionalSuffix}
                </span>
              </label>
              <Textarea
                id="project-description"
                value={description}
                disabled={loading}
                onChange={(event) => {
                  setDescription(event.target.value)
                  if (validationError?.field === 'description') {
                    setValidationError(null)
                  }
                }}
                placeholder={MESSAGES.project.form.descriptionPlaceholder}
                maxLength={200}
                rows={3}
                aria-invalid={validationError?.field === 'description'}
                aria-describedby={
                  validationError?.field === 'description'
                    ? 'project-description-error'
                    : undefined
                }
              />
              {validationError?.field === 'description' && (
                <p
                  id="project-description-error"
                  className="text-caption text-status-danger"
                >
                  {validationError.message}
                </p>
              )}
            </div>
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

export { ProjectFormDialog }
