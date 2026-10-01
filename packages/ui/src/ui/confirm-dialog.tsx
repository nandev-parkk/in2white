import { Button } from './button'
import { cn } from '../lib/utils'
import { COMMON_MESSAGES } from '../constants/common-messages'
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogTitle,
} from './dialog'

/*
 * 입력 없이 확인만 받는 모달이다. 어드민의 정지·삭제·복구와 멤버 제거가 모두 같은 모양을
 * 쓰므로 문구만 받는다. 삭제처럼 되돌릴 수 없는 작업은 `destructive`로 버튼 색을 바꾼다.
 */
type ConfirmDialogProps = {
  open: boolean
  title: string
  description: string
  confirmLabel: string
  onOpenChange: (open: boolean) => void
  onConfirm: () => void
  destructive?: boolean
  loading?: boolean
  error?: string
  className?: string
}

function ConfirmDialog({
  open,
  title,
  description,
  confirmLabel,
  onOpenChange,
  onConfirm,
  destructive = false,
  loading = false,
  error,
  className,
}: ConfirmDialogProps) {
  return (
    <Dialog
      open={open}
      onOpenChange={(nextOpen) => {
        /* 요청 중에는 바깥 클릭·Escape로도 닫지 않는다. 결과를 보여주고 닫는다. */
        if (!loading) onOpenChange(nextOpen)
      }}
    >
      {/* 좁은 화면에서도 양쪽 여백을 남긴다. 확인 문구만 담으므로 폭을 넓히지 않는다. */}
      <DialogContent
        className={cn('w-[calc(100%-2rem)] max-w-[440px]', className)}
      >
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
            {COMMON_MESSAGES.action.cancel}
          </Button>
          <Button
            type="button"
            variant={destructive ? 'destructive' : 'primary'}
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

export { ConfirmDialog }
export type { ConfirmDialogProps }
