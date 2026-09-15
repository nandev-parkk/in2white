import { Button } from '@/shared/ui/button'
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogTitle,
} from '@/shared/ui/dialog'

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
      <DialogContent className="max-w-90">
        <DialogTitle>화이트보드 삭제</DialogTitle>
        <DialogDescription>
          <strong className="text-foreground-default">{documentName}</strong>
          을(를) 삭제하면 되돌릴 수 없어요.
        </DialogDescription>
        {error && (
          <p className="text-caption text-status-danger" role="alert">
            {error}
          </p>
        )}
        <DialogFooter>
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

export { WhiteboardDocumentDeleteDialog }
