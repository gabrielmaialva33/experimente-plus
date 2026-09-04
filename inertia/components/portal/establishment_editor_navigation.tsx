import type { LucideIcon } from 'lucide-react'
import { AlertTriangle, CheckCircle2, LoaderCircle, LockKeyhole, Save, Send } from 'lucide-react'
import { useEffect, useRef } from 'react'

import { Badge } from '~/components/ui/badge'
import { Button } from '~/components/ui/button'
import { Card, CardContent, CardFooter } from '~/components/ui/card'
import { ProgressCircle } from '~/components/ui/progress'
import type { EditorSectionId } from '~/lib/establishment_editor'
import { cn } from '~/lib/utils'

export interface EditorNavigationItem {
  id: EditorSectionId
  label: string
  icon: LucideIcon
  issueCount: number
  optional?: boolean
}

interface EstablishmentEditorNavigationProps {
  variant: 'desktop' | 'mobile'
  items: EditorNavigationItem[]
  activeSection: EditorSectionId
  onNavigate: (section: EditorSectionId) => void
  score: number
  eligible: boolean
  submitAllowed: boolean
  submitting: boolean
  busy: boolean
  unsavedSectionCount: number
  onSubmit: () => void
  submitLabel: string
  statusLabel: string
  lockedLabel: string
}

function NavigationButton({
  item,
  active,
  compact,
  onClick,
}: {
  item: EditorNavigationItem
  active: boolean
  compact: boolean
  onClick: () => void
}) {
  const Icon = item.icon
  const complete = item.issueCount === 0 && !item.optional
  const accessibilityStatus =
    item.issueCount > 0
      ? `${item.issueCount} ${item.issueCount === 1 ? 'pendência' : 'pendências'}`
      : item.optional
        ? 'etapa opcional'
        : 'etapa concluída'

  return (
    <button
      type="button"
      data-editor-navigation-item={item.id}
      onClick={onClick}
      aria-current={active ? 'step' : undefined}
      aria-controls={item.id}
      aria-label={`${item.label}: ${accessibilityStatus}`}
      className={cn(
        'group flex items-center gap-2.5 rounded-lg text-left text-sm font-medium transition-colors',
        compact ? 'shrink-0 border px-3 py-2' : 'w-full px-3 py-2.5',
        active
          ? 'border-primary/20 bg-primary/10 text-primary'
          : compact
            ? 'border-border/70 bg-background text-muted-foreground hover:text-foreground'
            : 'text-muted-foreground hover:bg-muted hover:text-foreground'
      )}
    >
      <Icon className="size-4 shrink-0" />
      <span className="whitespace-nowrap">{item.label}</span>
      {item.issueCount > 0 ? (
        <span className="ms-auto inline-flex min-w-5 items-center justify-center rounded-full bg-warning/15 px-1.5 py-0.5 text-[0.65rem] font-bold text-warning-foreground">
          {item.issueCount}
        </span>
      ) : item.optional ? (
        compact ? null : (
          <span className="ms-auto text-[0.65rem] font-normal uppercase tracking-[0.08em] opacity-70">
            Opcional
          </span>
        )
      ) : complete ? (
        <CheckCircle2 className="ms-auto size-3.5 text-success" />
      ) : null}
    </button>
  )
}

export function EstablishmentEditorNavigation({
  variant,
  items,
  activeSection,
  onNavigate,
  score,
  eligible,
  submitAllowed,
  submitting,
  busy,
  unsavedSectionCount,
  onSubmit,
  submitLabel,
  statusLabel,
  lockedLabel,
}: EstablishmentEditorNavigationProps) {
  const mobileNavigationRef = useRef<HTMLElement>(null)
  const hasUnsavedChanges = unsavedSectionCount > 0
  const operationBusy = busy || submitting

  useEffect(() => {
    if (variant !== 'mobile') return

    const activeButton = mobileNavigationRef.current?.querySelector<HTMLElement>(
      `[data-editor-navigation-item="${activeSection}"]`
    )
    if (activeButton && typeof activeButton.scrollIntoView === 'function') {
      const reducedMotion = window.matchMedia?.('(prefers-reduced-motion: reduce)').matches ?? false
      activeButton.scrollIntoView({
        behavior: reducedMotion ? 'auto' : 'smooth',
        block: 'nearest',
        inline: 'center',
      })
    }
  }, [activeSection, variant])

  if (variant === 'mobile') {
    return (
      <div className="sticky top-[72px] z-30 -mx-4 border-y border-border bg-background px-4 py-2.5 sm:-mx-6 sm:px-6 lg:hidden">
        <nav
          ref={mobileNavigationRef}
          aria-label="Etapas do editor"
          className="flex gap-2 overflow-x-auto pb-0.5"
        >
          {items.map((item) => (
            <NavigationButton
              key={item.id}
              item={item}
              active={activeSection === item.id}
              compact
              onClick={() => onNavigate(item.id)}
            />
          ))}
        </nav>
      </div>
    )
  }

  const issueCount = items.reduce((total, item) => total + item.issueCount, 0)
  const submitButtonLabel = submitting
    ? 'Enviando…'
    : busy
      ? 'Aguarde…'
      : hasUnsavedChanges
        ? 'Salve antes de enviar'
        : submitLabel
  const helperText = hasUnsavedChanges
    ? `Salve ${unsavedSectionCount} ${unsavedSectionCount === 1 ? 'etapa pendente' : 'etapas pendentes'} antes do envio.`
    : busy
      ? 'Aguarde a operação atual terminar.'
      : null

  return (
    <aside className="hidden lg:block">
      <div className="sticky top-24 space-y-4">
        <Card className="overflow-hidden border-border">
          <CardContent className="space-y-5 p-5">
            <div className="flex items-center gap-4">
              <ProgressCircle
                value={score}
                size={72}
                strokeWidth={6}
                indicatorClassName={eligible ? 'text-success' : undefined}
              >
                <span className="text-sm font-bold tabular-nums">{score}%</span>
              </ProgressCircle>
              <div className="min-w-0">
                <p className="text-sm font-semibold">Prontidão da ficha</p>
                <p className="mt-1 text-xs leading-5 text-muted-foreground">{statusLabel}</p>
              </div>
            </div>

            {hasUnsavedChanges ? (
              <Badge variant="warning" appearance="light" className="w-full justify-start">
                <Save />
                {unsavedSectionCount}{' '}
                {unsavedSectionCount === 1 ? 'etapa não salva' : 'etapas não salvas'}
              </Badge>
            ) : busy ? (
              <Badge variant="secondary" appearance="light" className="w-full justify-start">
                <LoaderCircle className="animate-spin" />
                Atualizando a ficha
              </Badge>
            ) : eligible ? (
              <Badge variant="success" appearance="light" className="w-full justify-start">
                <CheckCircle2 />
                {submitAllowed ? 'Pronta para moderação' : 'Checklist concluído'}
              </Badge>
            ) : (
              <Badge variant="warning" appearance="light" className="w-full justify-start">
                <AlertTriangle />
                {issueCount} {issueCount === 1 ? 'ajuste necessário' : 'ajustes necessários'}
              </Badge>
            )}

            <nav aria-label="Etapas do editor" className="space-y-1">
              {items.map((item) => (
                <NavigationButton
                  key={item.id}
                  item={item}
                  active={activeSection === item.id}
                  compact={false}
                  onClick={() => onNavigate(item.id)}
                />
              ))}
            </nav>
          </CardContent>
          <CardFooter className="min-h-0 border-t border-border/70 bg-muted/20 p-4">
            {submitAllowed || submitting ? (
              <div className="w-full space-y-2">
                <Button
                  type="button"
                  size="lg"
                  className="w-full"
                  disabled={!eligible || operationBusy || hasUnsavedChanges}
                  aria-describedby={helperText ? 'editor-submit-help' : undefined}
                  onClick={onSubmit}
                >
                  {operationBusy ? (
                    <LoaderCircle className="animate-spin" />
                  ) : hasUnsavedChanges ? (
                    <Save />
                  ) : (
                    <Send />
                  )}
                  {submitButtonLabel}
                </Button>
                {helperText ? (
                  <p
                    id="editor-submit-help"
                    className="text-center text-[0.7rem] leading-4 text-muted-foreground"
                  >
                    {helperText}
                  </p>
                ) : null}
              </div>
            ) : (
              <p
                role="status"
                className="flex w-full items-center justify-center gap-2 text-center text-xs font-medium text-muted-foreground"
              >
                <LockKeyhole aria-hidden="true" className="size-4 shrink-0" />
                {lockedLabel}
              </p>
            )}
          </CardFooter>
        </Card>
      </div>
    </aside>
  )
}
