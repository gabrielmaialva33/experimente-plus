import { cloneElement, type ReactElement } from 'react'

import { cn } from '~/lib/utils'

interface EditorControlProps {
  'className'?: string
  'aria-describedby'?: string
  'aria-invalid'?: boolean | 'false' | 'true'
  'aria-required'?: boolean | 'false' | 'true'
}

/**
 * Read-only data (a published place, an analyst's access) must stay legible: the
 * primitives fade disabled controls to half opacity, which fails contrast (web audit W71).
 */
const READABLE_WHEN_DISABLED =
  'disabled:opacity-100 disabled:bg-muted/60 disabled:text-foreground disabled:border-border-subtle'

interface EditorFieldProps {
  htmlFor: string
  label: string
  children: ReactElement<EditorControlProps>
  hint?: string
  error?: string | null
  /** What the moderation asked to change in this field, shown where the edit happens. */
  note?: string | null
  required?: boolean
  className?: string
}

export const editorSelectClassName =
  'flex h-10 w-full pointer-coarse:h-11 rounded-md border border-input bg-background px-3 text-sm text-foreground shadow-xs shadow-black/5 outline-none transition-[color,box-shadow] focus:border-ring focus:ring-[3px] focus:ring-ring/30 disabled:cursor-not-allowed disabled:opacity-60 aria-invalid:border-destructive/60 aria-invalid:ring-destructive/10 dark:aria-invalid:border-destructive dark:aria-invalid:ring-destructive/20'

export function EditorField({
  htmlFor,
  label,
  children,
  hint,
  error,
  note,
  required = false,
  className,
}: EditorFieldProps) {
  const hintId = hint ? `${htmlFor}-hint` : undefined
  const noteId = note ? `${htmlFor}-note` : undefined
  const errorId = error ? `${htmlFor}-error` : undefined
  const describedBy = [children.props['aria-describedby'], hintId, noteId, errorId]
    .filter(Boolean)
    .join(' ')
  const control = cloneElement(children, {
    'className': cn(children.props.className, READABLE_WHEN_DISABLED),
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
      {note ? (
        <p
          id={noteId}
          className="rounded-xl border border-warning/30 bg-warning-soft px-3 py-2 text-[0.8125rem] leading-5 text-foreground"
        >
          <span className="font-bold text-warning-accent">Correção pedida pela moderação:</span>{' '}
          {note}
        </p>
      ) : null}
      {error ? (
        <p id={errorId} role="alert" className="text-xs text-destructive">
          {error}
        </p>
      ) : null}
    </div>
  )
}
