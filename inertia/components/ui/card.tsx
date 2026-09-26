import * as React from 'react'
import { cn } from '~/lib/utils'
import { cva, type VariantProps } from 'class-variance-authority'

type CardContextType = {
  variant: 'default' | 'accent'
}

const CardContext = React.createContext<CardContextType>({
  variant: 'default',
})

const useCardContext = () => {
  const context = React.useContext(CardContext)
  if (!context) {
    throw new Error('useCardContext must be used within a Card component')
  }
  return context
}

const cardVariants = cva('flex flex-col items-stretch rounded-card text-card-foreground', {
  variants: {
    variant: {
      // The outline is decorative: controls inside keep their own 3:1 boundaries.
      default: 'border border-border-subtle bg-card',
      accent: 'border border-border-subtle bg-muted p-1',
    },
  },
  defaultVariants: {
    variant: 'default',
  },
})

const cardHeaderVariants = cva('flex flex-wrap items-start justify-between gap-3 p-5', {
  variants: {
    variant: {
      default: 'border-b border-border-subtle',
      accent: '',
    },
  },
  defaultVariants: {
    variant: 'default',
  },
})

const cardContentVariants = cva('grow p-5', {
  variants: {
    variant: {
      default: '',
      accent: 'rounded-md bg-card [&:last-child]:rounded-md',
    },
  },
  defaultVariants: {
    variant: 'default',
  },
})

const cardTableVariants = cva('grid grow', {
  variants: {
    variant: {
      default: '',
      accent: 'rounded-md bg-card',
    },
  },
  defaultVariants: {
    variant: 'default',
  },
})

const cardFooterVariants = cva('flex items-center gap-3 p-5', {
  variants: {
    variant: {
      default: 'border-t border-border-subtle',
      accent: 'mt-px rounded-md bg-card',
    },
  },
  defaultVariants: {
    variant: 'default',
  },
})

function Card({
  className,
  variant = 'default',
  ...props
}: React.HTMLAttributes<HTMLDivElement> & VariantProps<typeof cardVariants>) {
  return (
    <CardContext.Provider value={{ variant: variant || 'default' }}>
      <div data-slot="card" className={cn(cardVariants({ variant }), className)} {...props} />
    </CardContext.Provider>
  )
}

function CardHeader({ className, ...props }: React.HTMLAttributes<HTMLDivElement>) {
  const { variant } = useCardContext()
  return (
    <div
      data-slot="card-header"
      className={cn(cardHeaderVariants({ variant }), className)}
      {...props}
    />
  )
}

function CardContent({ className, ...props }: React.HTMLAttributes<HTMLDivElement>) {
  const { variant } = useCardContext()
  return (
    <div
      data-slot="card-content"
      className={cn(cardContentVariants({ variant }), className)}
      {...props}
    />
  )
}

function CardTable({ className, ...props }: React.HTMLAttributes<HTMLDivElement>) {
  const { variant } = useCardContext()
  return (
    <div
      data-slot="card-table"
      className={cn(cardTableVariants({ variant }), className)}
      {...props}
    />
  )
}

function CardFooter({ className, ...props }: React.HTMLAttributes<HTMLDivElement>) {
  const { variant } = useCardContext()
  return (
    <div
      data-slot="card-footer"
      className={cn(cardFooterVariants({ variant }), className)}
      {...props}
    />
  )
}

function CardHeading({ className, ...props }: React.HTMLAttributes<HTMLDivElement>) {
  return <div data-slot="card-heading" className={cn('space-y-1', className)} {...props} />
}

function CardToolbar({ className, ...props }: React.HTMLAttributes<HTMLDivElement>) {
  return (
    <div
      data-slot="card-toolbar"
      className={cn('flex items-center gap-2.5', className)}
      {...props}
    />
  )
}

function CardTitle({ className, ...props }: React.HTMLAttributes<HTMLHeadingElement>) {
  return (
    <h3
      data-slot="card-title"
      className={cn('font-display text-[1.0625rem] font-bold leading-6', className)}
      {...props}
    />
  )
}

function CardDescription({ className, ...props }: React.HTMLAttributes<HTMLDivElement>) {
  return (
    <div
      data-slot="card-description"
      className={cn('text-sm text-muted-foreground', className)}
      {...props}
    />
  )
}

export {
  Card,
  CardContent,
  CardDescription,
  CardFooter,
  CardHeader,
  CardHeading,
  CardTable,
  CardTitle,
  CardToolbar,
}
