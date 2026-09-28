import { FileX } from 'lucide-react'
import { Button } from '@/shared/ui/button'
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogTitle,
} from '@/shared/ui/dialog'
import { MESSAGES } from '@/shared/constants/messages'

type WhiteboardDocumentDeleteDialogProps = {
  open: boolean
  documentName: string
  onOpenChange: (open: boolean) => void
  onConfirm: () => void
  loading?: boolean
  error?: string
}

function WhiteboardDocumentDeleteDialog({
  open,
  documentName,
  onOpenChange,
  onConfirm,
  loading = false,
  error,
}: WhiteboardDocumentDeleteDialogProps) {
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
            <FileX aria-hidden="true" className="size-6" />
          </span>
          <DialogTitle className="mt-4 text-[20px] leading-7 font-semibold break-words">
            {MESSAGES.whiteboard.heading.deleteDialog}
          </DialogTitle>
          <DialogDescription className="mt-2 break-words">
            <strong className="text-foreground-default">{documentName}</strong>
            {MESSAGES.common.confirm.deleteSuffix}
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
            {MESSAGES.common.action.cancel}
          </Button>
          <Button
            type="button"
            variant="destructive"
            loading={loading}
            onClick={onConfirm}
          >
            {MESSAGES.common.action.delete}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  )
}

export { WhiteboardDocumentDeleteDialog }
