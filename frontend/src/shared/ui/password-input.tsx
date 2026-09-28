import * as React from 'react'
import { Eye, EyeOff } from 'lucide-react'

import { Input, type InputProps } from './input'
import { MESSAGES } from '@/shared/constants/messages'

type PasswordInputProps = Omit<InputProps, 'type' | 'endAdornment'>

function PasswordInput({ className, ...props }: PasswordInputProps) {
  const [showPassword, setShowPassword] = React.useState(false)

  return (
    <Input
      {...props}
      type={showPassword ? 'text' : 'password'}
      className={className}
      endAdornment={
        <button
          type="button"
          aria-label={
            showPassword
              ? MESSAGES.common.a11y.hidePassword
              : MESSAGES.common.a11y.showPassword
          }
          aria-pressed={showPassword}
          className="text-foreground-tertiary hover:text-foreground-default focus-visible:ring-action-focus-ring inline-flex size-6 items-center justify-center rounded-sm outline-none focus-visible:ring-3"
          onClick={() => setShowPassword((visible) => !visible)}
        >
          {showPassword ? (
            <EyeOff aria-hidden="true" className="size-4" />
          ) : (
            <Eye aria-hidden="true" className="size-4" />
          )}
        </button>
      }
    />
  )
}

export { PasswordInput }
export type { PasswordInputProps }
