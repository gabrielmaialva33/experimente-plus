import * as React from 'react'

import { Input, InputWrapper } from '~/components/ui/input'
import { Label } from '~/components/ui/label'
import { cn } from '~/lib/utils'

export interface FieldProps extends React.ComponentProps<typeof Input> {
  label: string
  error?: string
  hint?: string
  leftIcon?: React.ReactNode
  trailingAction?: React.ReactNode
  labelAction?: React.ReactNode
}

export const Field = React.forwardRef<HTMLInputElement, FieldProps>(function Field(
  {
    label,
    error,
    hint,
    id,
    name,
    className,
    leftIcon,
    trailingAction,
    labelAction,
    required,
    ...props
  },
  ref
) {
  const generatedId = React.useId()
  const fieldId = id ?? name ?? generatedId
  const hintId = hint && !error ? `${fieldId}-hint` : null
  const errorId = error ? `${fieldId}-error` : null
  const describedBy = [hintId, errorId].filter(Boolean).join(' ') || undefined

  const labelElement = (
    <div className="flex min-w-0 items-center gap-1">
      <Label htmlFor={fieldId}>{label}</Label>
      {required ? (
        <span aria-hidden="true" className="text-destructive">
          *
        </span>
      ) : null}
    </div>
  )

  const input = (
    <Input
      id={fieldId}
      name={name}
      ref={ref}
      required={required}
      aria-required={required || undefined}
      aria-invalid={!!error}
      aria-describedby={describedBy}
      aria-errormessage={errorId ?? undefined}
      className={cn(className)}
      {...props}
    />
  )

  return (
    <div className="space-y-2" data-invalid={error ? 'true' : undefined}>
      {labelAction ? (
        <div className="flex items-center justify-between gap-2">
          {labelElement}
          {labelAction}
        </div>
      ) : (
        labelElement
      )}

      {leftIcon || trailingAction ? (
        <InputWrapper aria-invalid={!!error}>
          {leftIcon}
          {input}
          {trailingAction}
        </InputWrapper>
      ) : (
        input
      )}

      {hintId ? (
        <p id={hintId} className="text-xs leading-5 text-muted-foreground">
          {hint}
        </p>
      ) : null}
      {errorId ? (
        <p id={errorId} role="alert" className="text-xs leading-5 text-destructive">
          {error}
        </p>
      ) : null}
    </div>
  )
})
