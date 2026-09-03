import * as React from 'react'
import { cva, type VariantProps } from 'class-variance-authority'
import { ChevronDown, type LucideIcon } from 'lucide-react'
import { Slot as SlotPrimitive } from 'radix-ui'

import { cn } from '~/lib/utils'

const buttonVariants = cva(
  'group inline-flex cursor-pointer items-center justify-center gap-2 whitespace-nowrap rounded-md border border-transparent text-sm font-semibold transition-[background-color,border-color,color,box-shadow] focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2 focus-visible:ring-offset-background disabled:pointer-events-none disabled:cursor-not-allowed disabled:opacity-50 aria-disabled:pointer-events-none aria-disabled:opacity-50 motion-reduce:transition-none [&_svg]:shrink-0 [&_svg:not([class*=size-])]:size-4',
  {
    variants: {
      variant: {
        primary:
          'bg-primary text-primary-foreground hover:bg-primary/92 data-[state=open]:bg-primary/92',
        cta: 'bg-cta text-cta-foreground hover:bg-cta-accent data-[state=open]:bg-cta-accent',
        mono: 'bg-foreground text-background hover:bg-foreground/90 data-[state=open]:bg-foreground/90',
        destructive:
          'bg-destructive text-destructive-foreground hover:bg-destructive/92 data-[state=open]:bg-destructive/92',
        secondary:
          'border-border bg-secondary text-secondary-foreground hover:bg-secondary/75 data-[state=open]:bg-secondary/75',
        outline:
          'border-input bg-background text-foreground hover:bg-accent hover:text-accent-foreground data-[state=open]:bg-accent',
        dashed:
          'border-input border-dashed bg-background text-foreground hover:bg-accent hover:text-accent-foreground data-[state=open]:bg-accent',
        ghost:
          'bg-transparent text-foreground hover:bg-accent hover:text-accent-foreground data-[state=open]:bg-accent data-[state=open]:text-accent-foreground',
        dim: 'bg-transparent text-muted-foreground hover:text-foreground data-[state=open]:text-foreground',
        foreground: 'text-foreground',
        inverse: 'text-inherit',
      },
      appearance: {
        default: '',
        ghost: '',
      },
      underline: {
        solid: 'hover:underline hover:decoration-solid hover:underline-offset-4',
        dashed:
          'hover:underline hover:decoration-dashed hover:decoration-1 hover:underline-offset-4',
      },
      underlined: {
        solid: 'underline decoration-solid underline-offset-4',
        dashed: 'underline decoration-1 decoration-dashed underline-offset-4',
      },
      size: {
        lg: 'h-11 px-5',
        md: 'h-10 px-4',
        sm: 'h-9 px-3 text-xs',
        icon: 'size-10 p-0',
      },
      autoHeight: {
        true: '',
        false: '',
      },
      shape: {
        default: '',
        circle: 'rounded-full',
      },
      mode: {
        default: '',
        icon: 'shrink-0 p-0',
        link: 'h-auto border-transparent bg-transparent p-0 text-primary hover:bg-transparent hover:text-primary/85 data-[state=open]:bg-transparent',
        input:
          'justify-start font-normal hover:bg-background data-[state=open]:bg-background focus-visible:border-ring aria-invalid:border-destructive aria-invalid:ring-destructive/25 in-data-[invalid=true]:border-destructive in-data-[invalid=true]:ring-destructive/25',
      },
      placeholder: {
        true: 'text-muted-foreground',
        false: '',
      },
    },
    compoundVariants: [
      {
        variant: 'primary',
        appearance: 'ghost',
        className:
          'bg-transparent text-primary hover:bg-primary-soft data-[state=open]:bg-primary-soft',
      },
      {
        variant: 'cta',
        appearance: 'ghost',
        className: 'bg-transparent text-cta-accent hover:bg-cta-soft data-[state=open]:bg-cta-soft',
      },
      {
        variant: 'destructive',
        appearance: 'ghost',
        className:
          'bg-transparent text-destructive-accent hover:bg-destructive-soft data-[state=open]:bg-destructive-soft',
      },
      { size: 'sm', autoHeight: true, className: 'h-auto min-h-9' },
      { size: 'md', autoHeight: true, className: 'h-auto min-h-10' },
      { size: 'lg', autoHeight: true, className: 'h-auto min-h-11' },
      { size: 'sm', mode: 'icon', className: 'size-9' },
      { size: 'md', mode: 'icon', className: 'size-10' },
      { size: 'icon', mode: 'icon', className: 'size-10' },
      { size: 'lg', mode: 'icon', className: 'size-11' },
    ],
    defaultVariants: {
      variant: 'primary',
      appearance: 'default',
      size: 'md',
      shape: 'default',
      mode: 'default',
      autoHeight: false,
      placeholder: false,
    },
  }
)

type ButtonProps = React.ComponentProps<'button'> &
  VariantProps<typeof buttonVariants> & {
    'selected'?: boolean
    'asChild'?: boolean
    'data-state'?: string
  }

function Button({
  className,
  selected,
  variant,
  shape,
  appearance,
  mode,
  size,
  autoHeight,
  underlined,
  underline,
  asChild = false,
  placeholder = false,
  disabled,
  onClick,
  onClickCapture,
  'data-state': dataState,
  ...props
}: ButtonProps) {
  const Comp = asChild ? SlotPrimitive.Slot : 'button'
  const disabledAsChild = asChild && disabled

  const handleClick: React.MouseEventHandler<HTMLButtonElement> = (event) => {
    if (disabled) {
      event.preventDefault()
      event.stopPropagation()
      return
    }

    onClick?.(event)
  }

  const handleClickCapture: React.MouseEventHandler<HTMLButtonElement> = (event) => {
    if (disabledAsChild) {
      event.preventDefault()
      event.stopPropagation()
      return
    }

    onClickCapture?.(event)
  }

  return (
    <Comp
      {...props}
      data-slot="button"
      data-state={selected === true ? 'open' : dataState}
      className={cn(
        buttonVariants({
          variant,
          size,
          shape,
          appearance,
          mode,
          autoHeight,
          placeholder,
          underlined,
          underline,
        }),
        className
      )}
      disabled={asChild ? undefined : disabled}
      aria-disabled={disabledAsChild ? true : props['aria-disabled']}
      tabIndex={disabledAsChild ? -1 : props.tabIndex}
      onClick={onClick || disabled ? handleClick : undefined}
      onClickCapture={onClickCapture || disabledAsChild ? handleClickCapture : undefined}
    />
  )
}

interface ButtonArrowProps extends React.SVGProps<SVGSVGElement> {
  icon?: LucideIcon
}

function ButtonArrow({ icon: Icon = ChevronDown, className, ...props }: ButtonArrowProps) {
  return <Icon data-slot="button-arrow" className={cn('ms-auto -me-1', className)} {...props} />
}

export { Button, ButtonArrow, buttonVariants }
export type { ButtonProps }
