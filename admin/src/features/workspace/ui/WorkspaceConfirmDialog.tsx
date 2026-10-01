import { MESSAGES } from '@/shared/constants/messages'
import { Button } from '@in2white/ui/button'
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogTitle,
} from '@in2white/ui/dialog'

/* 멤버 제거와 워크스페이스 삭제는 입력이 없다. 확인 문구만 바꿔 같은 모달을 쓴다. */
type WorkspaceConfirmDialogProps = {
  open: boolean
  title: string
  description: string
  confirmLabel: string
  onOpenChange: (open: boolean) => void
  onConfirm: () => void
  loading?: boolean
  error?: string
}

function WorkspaceConfirmDialog({
  open,
  title,
  description,
  confirmLabel,
  onOpenChange,
  onConfirm,
  loading = false,
  error,
}: WorkspaceConfirmDialogProps) {
  return (
    <Dialog
      open={open}
      onOpenChange={(nextOpen) => {
        if (!loading) onOpenChange(nextOpen)
      }}
    >
      <DialogContent className="w-[calc(100%-2rem)] max-w-[440px]">
        <DialogTitle>{title}</DialogTitle>
        <DialogDescription>{description}</DialogDescription>

        {error && (
          <p className="text-status-danger text-[12px]" role="alert">
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
            {MESSAGES.common.action.cancel}
          </Button>
          {/* 둘 다 되돌릴 수 없는 작업이라 항상 파괴적 버튼으로 둔다. */}
          <Button
            type="button"
            variant="destructive"
            loading={loading}
            onClick={onConfirm}
          >
            {confirmLabel}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  )
}

export { WorkspaceConfirmDialog }
