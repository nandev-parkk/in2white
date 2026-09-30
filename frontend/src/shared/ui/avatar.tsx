import * as React from 'react'
import { cva, type VariantProps } from 'class-variance-authority'
import { cn } from '@in2white/ui/lib/utils'
import { Avatar as AvatarPrimitive } from 'radix-ui'

const avatarVariants = cva(
  'relative flex shrink-0 overflow-hidden rounded-full',
  {
    variants: {
      size: {
        small: 'size-6',
        default: 'size-8',
        large: 'size-10',
      },
    },
    defaultVariants: {
      size: 'default',
    },
  },
)

const avatarFallbackVariants = cva(
  'flex size-full items-center justify-center bg-linear-45 from-presence-4 to-presence-6 font-bold text-action-primary-foreground',
  {
    variants: {
      size: {
        small: 'text-[10px]',
        default: 'text-xs',
        large: 'text-sm',
      },
    },
    defaultVariants: {
      size: 'default',
    },
  },
)

function Avatar({
  className,
  size = 'default',
  ...props
}: React.ComponentProps<typeof AvatarPrimitive.Root> &
  VariantProps<typeof avatarVariants>) {
  return (
    <AvatarPrimitive.Root
      data-slot="avatar"
      className={cn(avatarVariants({ size, className }))}
      {...props}
    />
  )
}

function AvatarImage({
  className,
  ...props
}: React.ComponentProps<typeof AvatarPrimitive.Image>) {
  return (
    <AvatarPrimitive.Image
      data-slot="avatar-image"
      className={cn('size-full object-cover', className)}
      {...props}
    />
  )
}

function AvatarFallback({
  className,
  size = 'default',
  ...props
}: React.ComponentProps<typeof AvatarPrimitive.Fallback> &
  VariantProps<typeof avatarFallbackVariants>) {
  return (
    <AvatarPrimitive.Fallback
      data-slot="avatar-fallback"
      className={cn(avatarFallbackVariants({ size, className }))}
      {...props}
    />
  )
}

export { Avatar, AvatarImage, AvatarFallback }
