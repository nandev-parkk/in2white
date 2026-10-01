import { zodResolver } from '@hookform/resolvers/zod'
import { useEffect } from 'react'
import { useForm } from 'react-hook-form'

import type {
  AdminWorkspaceSummary,
  UpdateWorkspaceInput,
} from '@/entities/workspace'
import { MESSAGES } from '@/shared/constants/messages'
import { Button } from '@in2white/ui/button'
import {
  Dialog,
  DialogContent,
  DialogFooter,
  DialogTitle,
} from '@in2white/ui/dialog'
import { Input } from '@in2white/ui/input'

import {
  updateWorkspaceFormSchema,
  type UpdateWorkspaceFormValues,
} from '../model/workspace-form-schema'

const NAME_FIELD_ID = 'workspace-edit-name'
const NAME_ERROR_ID = `${NAME_FIELD_ID}-error`

type WorkspaceEditDialogProps = {
  open: boolean
  workspace: Pick<AdminWorkspaceSummary, 'name'>
  onOpenChange: (open: boolean) => void
  onSubmit: (input: UpdateWorkspaceInput) => void
  loading?: boolean
  error?: string
}

function WorkspaceEditDialog({
  open,
  workspace,
  onOpenChange,
  onSubmit,
  loading = false,
  error,
}: WorkspaceEditDialogProps) {
  const {
    register,
    handleSubmit,
    reset,
    formState: { errors, isDirty, isSubmitted },
  } = useForm<UpdateWorkspaceFormValues>({
    resolver: zodResolver(updateWorkspaceFormSchema),
    defaultValues: { name: workspace.name },
  })

  /* 대상이 바뀌거나 모달을 닫으면 현재 이름으로 되돌린다. */
  useEffect(() => {
    reset({ name: workspace.name })
  }, [open, workspace.name, reset])

  const handleValidSubmit = (values: UpdateWorkspaceFormValues) => {
    if (loading) return

    const name = values.name.trim()
    if (name === workspace.name) {
      /* 공백만 바꾼 경우다. 기준 값으로 되돌려 바꿀 내용이 없다고 알린다. */
      reset({ name: workspace.name }, { keepIsSubmitted: true })
      return
    }

    onSubmit({ name })
  }

  return (
    <Dialog
      open={open}
      onOpenChange={(nextOpen) => {
        if (!loading) onOpenChange(nextOpen)
      }}
    >
      <DialogContent className="w-[calc(100%-2rem)] max-w-[440px]">
        <DialogTitle>{MESSAGES.workspace.heading.edit}</DialogTitle>
        <form
          onSubmit={handleSubmit(handleValidSubmit)}
          className="flex flex-col gap-4"
          noValidate
        >
          <div className="flex w-full flex-col items-start gap-1">
            <label
              htmlFor={NAME_FIELD_ID}
              className="text-foreground-default text-[14px] leading-[1.429] font-semibold tracking-[0.0145em]"
            >
              {MESSAGES.workspace.form.nameLabel}
            </label>
            <Input
              id={NAME_FIELD_ID}
              autoComplete="off"
              aria-invalid={Boolean(errors.name)}
              aria-describedby={errors.name ? NAME_ERROR_ID : undefined}
              {...register('name')}
            />
            {errors.name && (
              <p id={NAME_ERROR_ID} className="text-status-danger text-[12px]">
                {errors.name.message}
              </p>
            )}
          </div>

          {(error ?? (isSubmitted && !isDirty)) && (
            <p className="text-status-danger text-[12px]" role="alert">
              {error ?? MESSAGES.workspace.form.updateFieldsRequired}
            </p>
          )}

          <DialogFooter>
            <Button
              type="button"
              variant="tertiary"
              disabled={loading}
              onClick={() => onOpenChange(false)}
            >
              {MESSAGES.common.action.cancel}
            </Button>
            <Button type="submit" loading={loading}>
              {MESSAGES.common.action.save}
            </Button>
          </DialogFooter>
        </form>
      </DialogContent>
    </Dialog>
  )
}

export { WorkspaceEditDialog }
