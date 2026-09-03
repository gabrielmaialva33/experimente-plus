import type { LucideIcon } from 'lucide-react'
import { AlertTriangle, CheckCircle2, RotateCcw, Save } from 'lucide-react'
import type { ReactNode } from 'react'

import { Badge } from '~/components/ui/badge'
import { Button } from '~/components/ui/button'
import { Card, CardContent, CardHeader } from '~/components/ui/card'
import { cn } from '~/lib/utils'

export interface EditorDisplayIssue {
  key: string
  message: string
  field?: string
  source?: 'checklist' | 'moderation'
  severity?: string
}

interface EditorSectionProps {
  id: string
  icon: LucideIcon
  title: string
  description: string
  issues?: EditorDisplayIssue[]
  toolbar?: ReactNode
  children: ReactNode
  className?: string
}

export function EditorSection({
  id,
  icon: Icon,
  title,
  description,
  issues = [],
  toolbar,
  children,
  className,
}: EditorSectionProps) {
  const titleId = `${id}-title`
  const descriptionId = `${id}-description`
  const issuesId = issues.length > 0 ? `${id}-issues` : undefined

  return (
    <section
      id={id}
      data-editor-section
      aria-labelledby={titleId}
      aria-describedby={[descriptionId, issuesId].filter(Boolean).join(' ')}
      className={cn('scroll-mt-36 lg:scroll-mt-24', className)}
    >
      <Card className="overflow-hidden border-border/70">
        <CardHeader className="min-h-0 items-start px-5 py-5 sm:flex-nowrap sm:px-6">
          <div className="flex min-w-0 items-start gap-3.5">
            <span className="flex size-10 shrink-0 items-center justify-center rounded-md bg-primary/10 text-primary">
              <Icon aria-hidden="true" className="size-5" />
            </span>
            <div className="min-w-0">
              <h2 id={titleId} className="text-lg font-semibold tracking-[-0.02em]">
                {title}
              </h2>
              <p
                id={descriptionId}
                className="mt-1 max-w-3xl text-sm leading-5 text-muted-foreground"
              >
                {description}
              </p>
            </div>
          </div>
          <div className="flex shrink-0 flex-wrap items-center justify-end gap-2">
            {issues.length > 0 ? (
              <Badge variant="warning" appearance="light" size="sm">
                <AlertTriangle />
                {issues.length} {issues.length === 1 ? 'pendência' : 'pendências'}
              </Badge>
            ) : (
              <Badge variant="success" appearance="light" size="sm">
                <CheckCircle2 />
                Em dia
              </Badge>
            )}
            {toolbar}
          </div>
        </CardHeader>

        {issues.length > 0 ? (
          <div
            id={issuesId}
            role="status"
            aria-live="polite"
            className="border-b border-border/70 bg-warning/5 px-5 py-4 sm:px-6"
          >
            <div className="grid gap-2 sm:grid-cols-2">
              {issues.map((issue) => (
                <div
                  key={issue.key}
                  className="flex items-start gap-2.5 rounded-lg border border-warning/20 bg-background/75 px-3 py-2.5"
                >
                  <AlertTriangle className="mt-0.5 size-4 shrink-0 text-warning-foreground" />
                  <div className="min-w-0">
                    <p className="text-sm font-medium leading-5">{issue.message}</p>
                    <div className="mt-1 flex flex-wrap items-center gap-1.5 text-[0.68rem] text-muted-foreground">
                      {issue.source === 'moderation' ? (
                        <span className="font-semibold uppercase tracking-[0.12em] text-warning-foreground">
                          Moderação
                        </span>
                      ) : (
                        <span className="font-semibold uppercase tracking-[0.12em]">Checklist</span>
                      )}
                      {issue.field ? <span>· {issue.field}</span> : null}
                    </div>
                  </div>
                </div>
              ))}
            </div>
          </div>
        ) : null}

        <CardContent className="p-0">{children}</CardContent>
      </Card>
    </section>
  )
}

interface EditorSaveBarProps {
  processing: boolean
  recentlySuccessful: boolean
  dirty: boolean
  disabled?: boolean
  label: string
  processingLabel?: string
  discardLabel?: string
  onDiscard?: () => void
  children?: ReactNode
}

export function EditorSaveBar({
  processing,
  recentlySuccessful,
  dirty,
  disabled = false,
  label,
  processingLabel = 'Salvando…',
  discardLabel = 'Descartar alterações',
  onDiscard,
  children,
}: EditorSaveBarProps) {
  const status = processing
    ? 'Salvando alterações…'
    : recentlySuccessful
      ? 'Alterações salvas.'
      : dirty
        ? 'Há alterações que ainda não foram salvas.'
        : 'Nenhuma alteração pendente.'

  return (
    <div className="flex flex-col gap-3 border-t border-border/70 bg-muted/20 px-5 py-4 sm:flex-row sm:items-center sm:justify-between sm:px-6">
      <div
        className="flex min-w-0 items-center gap-2 text-xs text-muted-foreground"
        role="status"
        aria-live="polite"
        aria-atomic="true"
      >
        <span
          className={cn(
            'size-2 shrink-0 rounded-full',
            processing
              ? 'animate-pulse bg-primary'
              : recentlySuccessful
                ? 'bg-success'
                : dirty
                  ? 'bg-warning'
                  : 'bg-muted-foreground/30'
          )}
        />
        <span>{status}</span>
      </div>
      <div className="flex flex-wrap items-center justify-end gap-2">
        {children}
        {dirty && onDiscard ? (
          <Button
            type="button"
            variant="outline"
            size="lg"
            disabled={disabled || processing}
            onClick={onDiscard}
          >
            <RotateCcw />
            {discardLabel}
          </Button>
        ) : null}
        <Button type="submit" size="lg" disabled={disabled || processing || !dirty}>
          <Save />
          {processing ? processingLabel : label}
        </Button>
      </div>
    </div>
  )
}
