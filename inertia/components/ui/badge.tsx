import * as React from 'react'
import { cva, type VariantProps } from 'class-variance-authority'
import { Slot as SlotPrimitive } from 'radix-ui'

import { cn } from '~/lib/utils'

const badgeVariants = cva(
  'inline-flex min-w-0 items-center justify-center border font-semibold leading-none focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2 focus-visible:ring-offset-background aria-disabled:pointer-events-none aria-disabled:opacity-50 [&_svg]:shrink-0',
  {
    variants: {
      variant: {
        primary: 'border-transparent bg-primary text-primary-foreground',
        cta: 'border-transparent bg-cta text-cta-foreground',
        secondary: 'border-transparent bg-secondary text-secondary-foreground',
        success: 'border-transparent bg-success text-success-foreground',
        warning: 'border-transparent bg-warning text-warning-foreground',
        info: 'border-transparent bg-info text-info-foreground',
        outline: 'border-border bg-transparent text-secondary-foreground',
        destructive: 'border-transparent bg-destructive text-destructive-foreground',
      },
      appearance: {
        default: '',
        light: '',
        outline: '',
        ghost: 'border-transparent bg-transparent',
      },
      disabled: {
        true: 'pointer-events-none opacity-50',
        false: '',
      },
      size: {
        lg: 'h-7 min-w-7 gap-1.5 rounded-md px-2.5 text-xs [&_svg]:size-3.5',
        md: 'h-6 min-w-6 gap-1.5 rounded-md px-2 text-xs [&_svg]:size-3.5',
        sm: 'h-5 min-w-5 gap-1 rounded-sm px-1.5 text-[0.6875rem] [&_svg]:size-3',
        xs: 'h-4 min-w-4 gap-1 rounded-sm px-1 text-[0.625rem] [&_svg]:size-3',
      },
      shape: {
        default: '',
        circle: 'rounded-full',
      },
    },
    compoundVariants: [
      { variant: 'primary', appearance: 'light', className: 'bg-primary-soft text-primary-accent' },
      { variant: 'cta', appearance: 'light', className: 'bg-cta-soft text-cta-accent' },
      {
        variant: 'secondary',
        appearance: 'light',
        className: 'bg-secondary text-secondary-foreground',
      },
      { variant: 'success', appearance: 'light', className: 'bg-success-soft text-success-accent' },
      { variant: 'warning', appearance: 'light', className: 'bg-warning-soft text-warning-accent' },
      { variant: 'info', appearance: 'light', className: 'bg-info-soft text-info-accent' },
      {
        variant: 'destructive',
        appearance: 'light',
        className: 'bg-destructive-soft text-destructive-accent',
      },
      {
        variant: 'primary',
        appearance: 'outline',
        className: 'border-primary/25 bg-primary-soft text-primary-accent',
      },
      {
        variant: 'cta',
        appearance: 'outline',
        className: 'border-cta/25 bg-cta-soft text-cta-accent',
      },
      {
        variant: 'secondary',
        appearance: 'outline',
        className: 'border-border bg-secondary/60 text-secondary-foreground',
      },
      {
        variant: 'success',
        appearance: 'outline',
        className: 'border-success/25 bg-success-soft text-success-accent',
      },
      {
        variant: 'warning',
        appearance: 'outline',
        className: 'border-warning/30 bg-warning-soft text-warning-accent',
      },
      {
        variant: 'info',
        appearance: 'outline',
        className: 'border-info/25 bg-info-soft text-info-accent',
      },
      {
        variant: 'destructive',
        appearance: 'outline',
        className: 'border-destructive/25 bg-destructive-soft text-destructive-accent',
      },
      { variant: 'primary', appearance: 'ghost', className: 'text-primary-accent' },
      { variant: 'cta', appearance: 'ghost', className: 'text-cta-accent' },
      { variant: 'secondary', appearance: 'ghost', className: 'text-secondary-foreground' },
      { variant: 'success', appearance: 'ghost', className: 'text-success-accent' },
      { variant: 'warning', appearance: 'ghost', className: 'text-warning-accent' },
      { variant: 'info', appearance: 'ghost', className: 'text-info-accent' },
      { variant: 'destructive', appearance: 'ghost', className: 'text-destructive-accent' },
      { size: ['lg', 'md', 'sm', 'xs'], appearance: 'ghost', className: 'px-0' },
    ],
    defaultVariants: {
      variant: 'primary',
      appearance: 'default',
      disabled: false,
      size: 'md',
      shape: 'default',
    },
  }
)

const badgeButtonVariants = cva(
  'inline-flex size-5 cursor-pointer items-center justify-center rounded-sm border-0 bg-transparent p-0 opacity-70 transition-opacity hover:opacity-100 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring disabled:pointer-events-none disabled:opacity-40 motion-reduce:transition-none [&>svg]:size-3.5',
  {
    variants: {
      variant: { default: '' },
    },
    defaultVariants: { variant: 'default' },
  }
)

export interface BadgeProps
  extends React.ComponentProps<'span'>, VariantProps<typeof badgeVariants> {
  asChild?: boolean
}

export interface BadgeButtonProps
  extends React.ComponentProps<'button'>, VariantProps<typeof badgeButtonVariants> {
  asChild?: boolean
}

export type BadgeDotProps = React.ComponentProps<'span'>

function Badge({
  className,
  variant,
  size,
  appearance,
  shape,
  asChild = false,
  disabled,
  ...props
}: BadgeProps) {
  const Comp = asChild ? SlotPrimitive.Slot : 'span'

  return (
    <Comp
      {...props}
      data-slot="badge"
      className={cn(badgeVariants({ variant, size, appearance, shape, disabled }), className)}
      aria-disabled={disabled ? true : props['aria-disabled']}
      tabIndex={disabled ? -1 : props.tabIndex}
    />
  )
}

function BadgeButton({
  className,
  variant,
  asChild = false,
  type = 'button',
  ...props
}: BadgeButtonProps) {
  const Comp = asChild ? SlotPrimitive.Slot : 'button'

  return (
    <Comp
      {...props}
      data-slot="badge-button"
      className={cn(badgeButtonVariants({ variant }), className)}
      type={asChild ? undefined : type}
    />
  )
}

function BadgeDot({ className, ...props }: BadgeDotProps) {
  return (
    <span
      {...props}
      data-slot="badge-dot"
      className={cn('size-1.5 rounded-full bg-current opacity-75', className)}
    />
  )
}

export { Badge, BadgeButton, BadgeDot, badgeVariants }
