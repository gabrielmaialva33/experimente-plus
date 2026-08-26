import { cloneElement, type ReactElement } from 'react'

import { cn } from '~/lib/utils'

interface EditorControlProps {
  'aria-describedby'?: string
  'aria-invalid'?: boolean | 'false' | 'true'
  'aria-required'?: boolean | 'false' | 'true'
}

interface EditorFieldProps {
  htmlFor: string
  label: string
  children: ReactElement<EditorControlProps>
  hint?: string
  error?: string | null
  required?: boolean
  className?: string
}

export const editorSelectClassName =
  'flex h-10 w-full rounded-md border border-input bg-background px-3 text-sm text-foreground shadow-xs shadow-black/5 outline-none transition-[color,box-shadow] focus:border-ring focus:ring-[3px] focus:ring-ring/30 disabled:cursor-not-allowed disabled:opacity-60 aria-invalid:border-destructive/60 aria-invalid:ring-destructive/10 dark:aria-invalid:border-destructive dark:aria-invalid:ring-destructive/20'

export function EditorField({
  htmlFor,
  label,
  children,
  hint,
  error,
  required = false,
  className,
}: EditorFieldProps) {
  const hintId = hint ? `${htmlFor}-hint` : undefined
  const errorId = error ? `${htmlFor}-error` : undefined
  const describedBy = [children.props['aria-describedby'], hintId, errorId]
    .filter(Boolean)
    .join(' ')
  const control = cloneElement(children, {
    'aria-describedby': describedBy || undefined,
    'aria-invalid': error ? true : children.props['aria-invalid'],
    'aria-required': required || children.props['aria-required'] || undefined,
  })

  return (
    <div className={cn('space-y-2', className)}>
      <div className="flex flex-wrap items-center justify-between gap-2">
        <label htmlFor={htmlFor} className="text-sm font-medium">
          {label}
          {required ? (
            <>
              <span aria-hidden="true" className="ms-1 text-destructive">
                *
              </span>
              <span className="sr-only"> (obrigatório)</span>
            </>
          ) : null}
        </label>
        {hint ? (
          <span id={hintId} className="text-xs text-muted-foreground">
            {hint}
          </span>
        ) : null}
      </div>
      {control}
      {error ? (
        <p id={errorId} role="alert" className="text-xs text-destructive">
          {error}
        </p>
      ) : null}
    </div>
  )
}
