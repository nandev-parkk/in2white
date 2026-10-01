import type { ReactNode } from 'react'

/* 어드민 폼은 모두 같은 라벨·오류 배치를 쓴다. 필드마다 마크업을 반복하면 어긋난다. */
type UserFormFieldProps = {
  id: string
  label: string
  error?: string
  hint?: string
  children: (props: {
    id: string
    'aria-invalid': boolean
    'aria-describedby': string | undefined
  }) => ReactNode
}

function UserFormField({
  id,
  label,
  error,
  hint,
  children,
}: UserFormFieldProps) {
  const errorId = `${id}-error`
  const hintId = `${id}-hint`

  return (
    <div className="flex w-full flex-col items-start gap-1">
      <label
        htmlFor={id}
        className="text-foreground-default text-[14px] leading-[1.429] font-semibold tracking-[0.0145em]"
      >
        {label}
      </label>
      {children({
        id,
        'aria-invalid': Boolean(error),
        'aria-describedby': error ? errorId : hint ? hintId : undefined,
      })}
      {hint && !error && (
        <p id={hintId} className="text-foreground-secondary text-[12px]">
          {hint}
        </p>
      )}
      {error && (
        <p id={errorId} className="text-status-danger text-[12px]">
          {error}
        </p>
      )}
    </div>
  )
}

export { UserFormField }
