import { useForm } from '@inertiajs/react'
import { Loader2, Star } from 'lucide-react'
import type { FormEvent } from 'react'

import {
  EditorField,
  editorSelectClassName,
} from '~/components/portal/establishment_editor/editor_field'
import { Button } from '~/components/ui/button'
import { Textarea } from '~/components/ui/textarea'
import { useAuth } from '~/hooks/use_auth'
import { collection, numeric, record, text, type JsonRecord } from '~/lib/json'
import {
  PILOT_FEEDBACK_STATUS_LABELS,
  formatDateTime,
  pilotFeedbackContextLabel,
  pilotFeedbackStatusLabel,
} from '~/lib/labels'
import { cn } from '~/lib/utils'

function statusClassName(status: string): string {
  const styles: Record<string, string> = {
    new: 'bg-info/10 text-info ring-info/15',
    in_review: 'bg-warning/15 text-warning-foreground ring-warning/15',
    resolved: 'bg-success/10 text-success ring-success/15',
    dismissed: 'bg-muted text-muted-foreground ring-border/70',
  }

  return styles[status] ?? 'bg-muted text-muted-foreground ring-border/70'
}

export function FeedbackCard({ item }: { item: JsonRecord }) {
  const { can } = useAuth()
  const canUpdate = can('pilot_feedback.update')
  const form = useForm({
    status: text(item, 'status', 'new'),
    internal_notes: text(item, 'internal_notes'),
  })
  const organization = record(item.organization)
  const establishment = record(item.establishment)
  const establishmentRevision = collection(establishment?.revisions)[0] ?? null
  const user = record(item.author) ?? record(item.user)
  const id = numeric(item, 'id')
  const status = text(item, 'status', 'new')
  const reportedAt = formatDateTime(text(item, 'created_at') || null)

  function submit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault()
    if (form.processing) return
    form.patch(`/backoffice/feedback/${id}`, { preserveScroll: true })
  }

  return (
    <article className="overflow-hidden rounded-lg border border-border bg-card">
      <div className="p-5 sm:p-6">
        <div className="flex flex-wrap items-start justify-between gap-4">
          <div className="min-w-0">
            <div className="flex flex-wrap items-center gap-2">
              <span className="rounded-full bg-muted px-2.5 py-1 text-[0.68rem] font-semibold text-muted-foreground">
                {pilotFeedbackContextLabel(text(item, 'context'))}
              </span>
              <span
                className={cn(
                  'rounded-full px-2.5 py-1 text-[0.68rem] font-semibold ring-1 ring-inset',
                  statusClassName(status)
                )}
              >
                {pilotFeedbackStatusLabel(status)}
              </span>
            </div>
            <p className="mt-3 truncate text-sm text-muted-foreground">
              {text(user, 'full_name', 'Usuário do piloto')}
              {organization ? ` · ${text(organization, 'trade_name')}` : ''}
              {establishment
                ? ` · ${text(
                    establishmentRevision,
                    'public_name',
                    text(establishment, 'public_name', 'Unidade sem nome')
                  )}`
                : ''}
            </p>
            <p className="mt-1 text-xs text-muted-foreground">
              {reportedAt ? `Relatado em ${reportedAt}` : 'Data do relato indisponível'}
            </p>
          </div>
          <div className="flex items-center gap-1 rounded-full bg-warning/15 px-3 py-1.5 text-sm font-bold text-warning-foreground ring-1 ring-warning/15">
            <Star aria-hidden="true" className="size-4 fill-current" />
            {numeric(item, 'rating')}/5
          </div>
        </div>

        <blockquote className="mt-5 border-s-2 border-primary/30 ps-4 text-sm leading-6 text-foreground">
          {text(item, 'message')}
        </blockquote>
      </div>

      {canUpdate ? (
        <form
          onSubmit={submit}
          aria-busy={form.processing}
          className="grid gap-4 border-t border-border bg-muted/20 p-5 sm:p-6 md:grid-cols-[0.4fr_1fr_auto] md:items-start"
        >
        <EditorField
          htmlFor={`feedback-${id}-status`}
          label="Status"
          error={form.errors.status ?? null}
        >
          <select
            id={`feedback-${id}-status`}
            value={form.data.status}
            disabled={form.processing}
            onChange={(event) => form.setData('status', event.target.value)}
            className={editorSelectClassName}
          >
            {Object.entries(PILOT_FEEDBACK_STATUS_LABELS).map(([value, label]) => (
              <option key={value} value={value}>
                {label}
              </option>
            ))}
          </select>
        </EditorField>
        <EditorField
          htmlFor={`feedback-${id}-notes`}
          label="Nota interna"
          error={form.errors.internal_notes ?? null}
        >
          <Textarea
            id={`feedback-${id}-notes`}
            rows={2}
            maxLength={4000}
            disabled={form.processing}
            value={form.data.internal_notes}
            onChange={(event) => form.setData('internal_notes', event.target.value)}
            placeholder="Registre contexto útil para a equipe"
            className="resize-y"
          />
        </EditorField>
        <div className="flex flex-col gap-2 md:mt-7">
          <Button type="submit" variant="primary" disabled={form.processing}>
            {form.processing ? (
              <>
                <Loader2 aria-hidden="true" className="size-4 animate-spin" />
                Salvando…
              </>
            ) : (
              'Atualizar'
            )}
          </Button>
          <p role="status" aria-live="polite" className="text-xs text-success">
            {form.recentlySuccessful ? 'Triagem atualizada.' : ''}
          </p>
        </div>
        </form>
      ) : null}
    </article>
  )
}
