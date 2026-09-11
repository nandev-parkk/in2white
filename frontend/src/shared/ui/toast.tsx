import { CircleAlert, CircleCheck, Info, TriangleAlert } from 'lucide-react'
import { toast, Toaster as SonnerToaster, type ToasterProps } from 'sonner'
import 'sonner/dist/styles.css'
import { cn } from 'cn'

const DEFAULT_TOAST_DURATION = 4000

function Toaster({
  className,
  toastOptions,
  duration = DEFAULT_TOAST_DURATION,
  ...props
}: ToasterProps) {
  return (
    <SonnerToaster
      data-slot="toaster"
      position="top-right"
      offset={{ top: 24, right: 24 }}
      duration={duration}
      icons={{
        success: <CircleCheck className="text-status-success size-5" />,
        error: <CircleAlert className="text-status-danger size-5" />,
        info: <Info className="text-status-info size-5" />,
        warning: <TriangleAlert className="text-status-warning size-5" />,
      }}
      toastOptions={{
        unstyled: true,
        ...toastOptions,
        classNames: {
          ...toastOptions?.classNames,
          toast: cn(
            'text-body text-foreground-strong flex w-80 max-w-[calc(100vw-3rem)] min-w-0 items-center gap-2.5 rounded-md px-4 py-3 break-words shadow-sm',
            toastOptions?.classNames?.toast,
          ),
          content: cn('min-w-0', toastOptions?.classNames?.content),
          success: cn(
            'bg-status-success-subtle-bg',
            toastOptions?.classNames?.success,
          ),
          error: cn(
            'bg-status-danger-subtle-bg',
            toastOptions?.classNames?.error,
          ),
          info: cn('bg-status-info-subtle-bg', toastOptions?.classNames?.info),
          warning: cn(
            'bg-status-warning-subtle-bg',
            toastOptions?.classNames?.warning,
          ),
        },
      }}
      className={className}
      {...props}
    />
  )
}

export { Toaster, toast }
