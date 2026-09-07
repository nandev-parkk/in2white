import * as React from 'react'
import { cn } from 'cn'
import { Check } from 'lucide-react'
import { Checkbox as CheckboxPrimitive } from 'radix-ui'

function Checkbox({
  className,
  ...props
}: React.ComponentProps<typeof CheckboxPrimitive.Root>) {
  return (
    <CheckboxPrimitive.Root
      data-slot="checkbox"
      className={cn(
        'group peer border-border-strong bg-background-default focus-visible:ring-action-focus-ring data-[state=checked]:border-action-primary data-[state=checked]:bg-action-primary aria-invalid:!border-status-danger disabled:!border-border-subtle disabled:!bg-background-subtle size-5 shrink-0 rounded-sm border transition-colors outline-none focus-visible:ring-3',
        className,
      )}
      {...props}
    >
      <CheckboxPrimitive.Indicator className="text-action-primary-foreground group-disabled:!text-foreground-disabled flex items-center justify-center">
        <Check className="size-3" />
      </CheckboxPrimitive.Indicator>
    </CheckboxPrimitive.Root>
  )
}

export { Checkbox }
