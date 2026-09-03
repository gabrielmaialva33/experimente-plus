import * as React from 'react'
import { cn } from '~/lib/utils'
import { cva, type VariantProps } from 'class-variance-authority'

const inputShellClasses = `
  flex w-full rounded-md border border-input bg-background text-sm text-foreground
  transition-[border-color,box-shadow]
  aria-invalid:border-destructive aria-invalid:ring-destructive/25
  motion-reduce:transition-none
`

const inputShellSizeVariants = {
  lg: 'h-11 px-4',
  md: 'h-10 px-3',
  sm: 'h-9 px-3 text-xs',
}

const inputElementSizeVariants = {
  lg: `${inputShellSizeVariants.lg} file:me-4 file:pe-4`,
  md: `${inputShellSizeVariants.md} file:me-3 file:pe-3`,
  sm: `${inputShellSizeVariants.sm} file:me-3 file:pe-3`,
}

const inputVariants = cva(
  `
    ${inputShellClasses}
    placeholder:text-muted-foreground
    focus-visible:border-ring focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring/30
    disabled:cursor-not-allowed disabled:opacity-50
    read-only:cursor-not-allowed read-only:bg-muted/70
    file:h-full file:border-0 file:border-e file:border-solid file:border-input file:bg-transparent
    file:p-0 file:font-medium file:not-italic file:text-foreground [&[type=file]]:py-0
  `,
  {
    variants: {
      variant: inputElementSizeVariants,
    },
    defaultVariants: {
      variant: 'md',
    },
  }
)

const inputWrapperShellVariants = cva(inputShellClasses, {
  variants: {
    variant: inputShellSizeVariants,
  },
  defaultVariants: {
    variant: 'md',
  },
})

const inputAddonVariants = cva(
  'flex shrink-0 items-center justify-center border border-input bg-muted text-secondary-foreground [&_svg]:text-muted-foreground',
  {
    variants: {
      variant: {
        sm: 'h-9 min-w-9 rounded-md px-3 text-xs [&_svg:not([class*=size-])]:size-3.5',
        md: 'h-10 min-w-10 rounded-md px-3 text-sm [&_svg:not([class*=size-])]:size-4',
        lg: 'h-11 min-w-11 rounded-md px-4 text-sm [&_svg:not([class*=size-])]:size-4',
      },
      mode: {
        default: '',
        icon: 'px-0 justify-center',
      },
    },
    defaultVariants: {
      variant: 'md',
      mode: 'default',
    },
  }
)

const inputGroupVariants = cva(
  `
    flex items-stretch
    [&_[data-slot=input]]:grow
    [&_[data-slot=input-addon]:has(+[data-slot=input])]:rounded-e-none [&_[data-slot=input-addon]:has(+[data-slot=input])]:border-e-0
    [&_[data-slot=input-addon]:has(+[data-slot=datefield])]:rounded-e-none [&_[data-slot=input-addon]:has(+[data-slot=datefield])]:border-e-0 
    [&_[data-slot=input]+[data-slot=input-addon]]:rounded-s-none [&_[data-slot=input]+[data-slot=input-addon]]:border-s-0
    [&_[data-slot=input-addon]:has(+[data-slot=button])]:rounded-e-none
    [&_[data-slot=input]+[data-slot=button]]:rounded-s-none
    [&_[data-slot=button]+[data-slot=input]]:rounded-s-none
    [&_[data-slot=input-addon]+[data-slot=input]]:rounded-s-none
    [&_[data-slot=input-addon]+[data-slot=datefield]]:[&_[data-slot=input]]:rounded-s-none
    [&_[data-slot=datefield]:has(+[data-slot=input-addon])]:[&_[data-slot=input]]:rounded-e-none
    [&_[data-slot=input]:has(+[data-slot=button])]:rounded-e-none
    [&_[data-slot=input]:has(+[data-slot=input-addon])]:rounded-e-none
    [&_[data-slot=datefield]]:grow
    [&_[data-slot=datefield]+[data-slot=input-addon]]:rounded-s-none [&_[data-slot=datefield]+[data-slot=input-addon]]:border-s-0
  `,
  {
    variants: {},
    defaultVariants: {},
  }
)

const inputWrapperVariants = cva(
  `
    flex items-center gap-1.5
    has-[:focus-visible]:ring-ring/30
    has-[:focus-visible]:border-ring
    has-[:focus-visible]:outline-none 
    has-[:focus-visible]:ring-2

    [&_[data-slot=datefield]]:grow 
    [&_[data-slot=input]]:data-focus-within:ring-transparent  
    [&_[data-slot=input]]:data-focus-within:ring-0 
    [&_[data-slot=input]]:data-focus-within:border-0 
    [&_[data-slot=input]]:flex 
    [&_[data-slot=input]]:w-full 
    [&_[data-slot=input]]:outline-none 
    [&_[data-slot=input]]:transition-colors
    [&_[data-slot=input]]:text-foreground
    [&_[data-slot=input]]:placeholder:text-muted-foreground 
    [&_[data-slot=input]]:border-0 
    [&_[data-slot=input]]:bg-transparent 
    [&_[data-slot=input]]:p-0
    [&_[data-slot=input]]:shadow-none 
    [&_[data-slot=input]]:focus-visible:ring-0 
    [&_[data-slot=input]]:h-auto 
    [&_[data-slot=input]]:disabled:cursor-not-allowed
    [&_[data-slot=input]]:disabled:opacity-50

    [&_svg]:text-muted-foreground 
    [&_svg]:shrink-0
    motion-reduce:transition-none
  `,
  {
    variants: {
      variant: {
        sm: 'gap-1.25 [&_svg:not([class*=size-])]:size-3.5',
        md: 'gap-1.5 [&_svg:not([class*=size-])]:size-4',
        lg: 'gap-1.5 [&_svg:not([class*=size-])]:size-4',
      },
    },
    defaultVariants: {
      variant: 'md',
    },
  }
)

function Input({
  className,
  type,
  variant,
  ...props
}: React.ComponentProps<'input'> & VariantProps<typeof inputVariants>) {
  return (
    <input
      data-slot="input"
      type={type}
      className={cn(inputVariants({ variant }), className)}
      {...props}
    />
  )
}

function InputAddon({
  className,
  variant,
  mode,
  ...props
}: React.ComponentProps<'div'> & VariantProps<typeof inputAddonVariants>) {
  return (
    <div
      data-slot="input-addon"
      className={cn(inputAddonVariants({ variant, mode }), className)}
      {...props}
    />
  )
}

function InputGroup({
  className,
  ...props
}: React.ComponentProps<'div'> & VariantProps<typeof inputGroupVariants>) {
  return <div data-slot="input-group" className={cn(inputGroupVariants(), className)} {...props} />
}

function InputWrapper({
  className,
  variant,
  ...props
}: React.ComponentProps<'div'> & VariantProps<typeof inputWrapperVariants>) {
  return (
    <div
      data-slot="input-wrapper"
      className={cn(
        inputWrapperShellVariants({ variant }),
        inputWrapperVariants({ variant }),
        className
      )}
      {...props}
    />
  )
}

export { Input, InputAddon, InputGroup, InputWrapper, inputVariants, inputAddonVariants }
