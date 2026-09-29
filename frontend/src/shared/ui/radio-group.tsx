import * as React from 'react'
import { cn } from '@/shared/lib/utils'
import { RadioGroup as RadioGroupPrimitive } from 'radix-ui'

function RadioGroup({
  className,
  ...props
}: React.ComponentProps<typeof RadioGroupPrimitive.Root>) {
  return (
    <RadioGroupPrimitive.Root
      data-slot="radio-group"
      className={cn('grid gap-2', className)}
      {...props}
    />
  )
}

function RadioGroupItem({
  className,
  ...props
}: React.ComponentProps<typeof RadioGroupPrimitive.Item>) {
  return (
    <RadioGroupPrimitive.Item
      data-slot="radio-group-item"
      className={cn(
        'group peer border-border-strong bg-background-default focus-visible:ring-action-focus-ring data-[state=checked]:border-action-primary aria-invalid:!border-status-danger disabled:!border-border-subtle disabled:!bg-background-subtle size-5 shrink-0 rounded-full border transition-colors outline-none focus-visible:ring-3 motion-reduce:transition-none',
        className,
      )}
      {...props}
    >
      <RadioGroupPrimitive.Indicator className="flex items-center justify-center">
        <span className="bg-action-primary group-disabled:!bg-foreground-disabled size-2.5 rounded-full" />
      </RadioGroupPrimitive.Indicator>
    </RadioGroupPrimitive.Item>
  )
}

export { RadioGroup, RadioGroupItem }
