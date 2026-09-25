import { FolderX } from 'lucide-react'
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogTitle,
} from '@/shared/ui/dialog'
import { Button } from '@/shared/ui/button'

type ProjectDeleteDialogProps = {
  open: boolean
  projectName: string
  onOpenChange: (open: boolean) => void
  onConfirm: () => void
  loading?: boolean
  error?: string
}

function ProjectDeleteDialog({
  open,
  projectName,
  onOpenChange,
  onConfirm,
  loading = false,
  error,
}: ProjectDeleteDialogProps) {
  return (
    <Dialog
      open={open}
      onOpenChange={(nextOpen) => {
        if (!loading) onOpenChange(nextOpen)
      }}
    >
      <DialogContent className="max-h-[calc(100dvh-2rem)] w-[calc(100%-2rem)] max-w-[440px] overflow-y-auto p-0 [&>div]:gap-0">
        <div className="flex flex-col px-6 py-7 text-center">
          <span className="bg-status-danger-subtle-bg text-status-danger flex size-12 items-center justify-center self-center rounded-full">
            <FolderX aria-hidden="true" className="size-6" />
          </span>
          <DialogTitle className="mt-4 text-[20px] leading-7 font-semibold break-words">
            프로젝트 삭제
          </DialogTitle>
          <DialogDescription className="mt-2 break-words">
            <strong className="text-foreground-default">{projectName}</strong>
            을(를) 삭제하면 되돌릴 수 없어요.
          </DialogDescription>
          {error && (
            <p className="text-caption text-status-danger mt-4" role="alert">
              {error}
            </p>
          )}
        </div>
        <DialogFooter className="border-border w-full border-t px-6 py-4">
          <Button
            type="button"
            variant="tertiary"
            disabled={loading}
            onClick={() => onOpenChange(false)}
          >
            취소
          </Button>
          <Button
            type="button"
            variant="destructive"
            loading={loading}
            onClick={onConfirm}
          >
            삭제
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  )
}

export { ProjectDeleteDialog }
