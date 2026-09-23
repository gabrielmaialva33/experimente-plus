import { Link, useForm } from '@inertiajs/react'
import { AlertTriangle, EyeOff, Loader2, ShieldQuestion, Star, UserX } from 'lucide-react'
import { useState } from 'react'

import {
  EditorField,
  editorSelectClassName,
} from '~/components/portal/establishment_editor/editor_field'
import { Button } from '~/components/ui/button'
import { Textarea } from '~/components/ui/textarea'
import { useAuth } from '~/hooks/use_auth'
import { collection, numeric, record, text, type JsonRecord } from '~/lib/json'
import {
  formatReportDate,
  isOverdue,
  isReportReason,
  isReportStatus,
  isReportTargetType,
  reportReasonLabels,
  reportResolutionActions,
  reportStatusMeta,
  reportTargetLabels,
  targetPublicPath,
} from '~/lib/content_reports'
import { cn } from '~/lib/utils'

function nullableText(source: JsonRecord | null, key: string): string | null {
  const value = text(source, key)
  return value.length > 0 ? value : null
}

/**
 * One case in the report queue.
 *
 * The reported content is rendered beside the report rather than behind a link,
 * because the decision is about the text: a moderator asked to judge "offensive"
 * from a protocol number and an identifier is being asked to guess.
 */
export function ContentReportCard({ report }: { report: JsonRecord }) {
  const { can } = useAuth()
  const canResolve = can('establishments.update')

  const id = numeric(report, 'id')
  const protocol = text(report, 'protocol_number')
  const rawStatus = text(report, 'status', 'pending')
  const status = isReportStatus(rawStatus) ? rawStatus : 'pending'
  const statusMeta = reportStatusMeta[status]
  const rawReason = text(report, 'reason', 'other')
  const reason = isReportReason(rawReason) ? rawReason : 'other'
  const dueAt = nullableText(report, 'due_at')
  const overdue = isOverdue(dueAt, status)
  const isAnonymous = report.is_anonymous === true
  const reporter = record(report.reporter)
  const resolver = record(report.resolver)
  const details = nullableText(report, 'details')

  const target = record(report.target)
  const rawTargetType = text(report, 'target_type', 'review')
  const targetType = isReportTargetType(rawTargetType) ? rawTargetType : 'review'
  const targetExists = target?.exists === true
  const canHide = target?.can_hide === true && targetExists
  const targetTitle = nullableText(target, 'title')
  const targetPhotos = collection(target?.photos)
  const targetText = nullableText(target, 'text')
  const targetAuthor = nullableText(target, 'author_name')
  const targetEstablishment = nullableText(target, 'establishment_name')
  const targetStatus = nullableText(target, 'status')
  const authorId = target && target.author_id ? numeric(target, 'author_id') : null
  const authorBanned = target?.author_banned === true
  const targetRating = target && target.rating !== null ? numeric(target, 'rating') : null
  const publicPath = targetPublicPath(text(target, 'city_slug'), text(target, 'establishment_slug'))

  const settled = status === 'resolved' || status === 'dismissed'
  const actions = reportResolutionActions.filter((action) => !action.hides || canHide)

  const form = useForm({
    resolution_action: actions[0]?.value ?? 'no_violation',
    resolution_notes: '',
  })
  const selected = reportResolutionActions.find(
    (action) => action.value === form.data.resolution_action
  )
  const hidesContent = selected?.hides === true

  const submit = (nextStatus: 'resolved' | 'dismissed') => {
    form.transform((data) => ({ ...data, status: nextStatus }))
    form.post(`/backoffice/reports/${id}/resolve`, { preserveScroll: true })
  }

  return (
    <article className="rounded-lg border border-border bg-card p-5">
      <header className="flex flex-wrap items-start justify-between gap-3">
        <div className="min-w-0">
          <p className="font-mono text-sm font-bold">{protocol}</p>
          <p className="mt-1 text-sm text-muted-foreground">
            {reportReasonLabels[reason]} · {reportTargetLabels[targetType]}
          </p>
        </div>
        <div className="flex flex-wrap items-center gap-2">
          {overdue ? (
            <span className="inline-flex items-center gap-1.5 rounded-md border border-danger/25 bg-danger/10 px-2 py-1 text-xs font-semibold text-danger">
              <AlertTriangle aria-hidden="true" className="size-3.5" />
              Prazo vencido
            </span>
          ) : null}
          <span
            className={cn(
              'inline-flex rounded-md border px-2 py-1 text-xs font-semibold',
              statusMeta.className
            )}
          >
            {statusMeta.label}
          </span>
        </div>
      </header>

      <dl className="mt-4 grid gap-3 text-sm sm:grid-cols-3">
        <div>
          <dt className="text-xs font-semibold uppercase tracking-[0.12em] text-muted-foreground">
            Recebida em
          </dt>
          <dd className="mt-0.5">{formatReportDate(nullableText(report, 'created_at')) ?? '—'}</dd>
        </div>
        <div>
          <dt className="text-xs font-semibold uppercase tracking-[0.12em] text-muted-foreground">
            Prazo
          </dt>
          <dd className={cn('mt-0.5', overdue && 'font-semibold text-danger')}>
            {formatReportDate(dueAt) ?? '—'}
          </dd>
        </div>
        <div>
          <dt className="text-xs font-semibold uppercase tracking-[0.12em] text-muted-foreground">
            Denunciante
          </dt>
          <dd className="mt-0.5">
            {isAnonymous ? 'Denúncia anônima' : (nullableText(reporter, 'full_name') ?? '—')}
          </dd>
        </div>
      </dl>

      {details ? (
        <section className="mt-4 rounded-md border border-border bg-muted/40 p-4">
          <h3 className="text-xs font-semibold uppercase tracking-[0.12em] text-muted-foreground">
            O que o denunciante escreveu
          </h3>
          <p className="mt-1.5 whitespace-pre-line text-sm leading-6">{details}</p>
        </section>
      ) : null}

      <section className="mt-4 rounded-md border border-border p-4">
        <div className="flex flex-wrap items-center justify-between gap-2">
          <h3 className="text-xs font-semibold uppercase tracking-[0.12em] text-muted-foreground">
            Conteúdo denunciado
          </h3>
          {targetStatus === 'hidden' ? (
            <span className="inline-flex items-center gap-1.5 rounded-md border border-border bg-muted px-2 py-1 text-xs font-semibold text-muted-foreground">
              <EyeOff aria-hidden="true" className="size-3.5" />
              Já oculto
            </span>
          ) : null}
        </div>

        {targetExists ? (
          <div className="mt-2 space-y-2">
            {targetTitle ? <p className="text-base font-semibold">{targetTitle}</p> : null}
            <p className="text-sm font-semibold">
              {targetAuthor ?? reportTargetLabels[targetType]}
              {targetEstablishment ? (
                <span className="font-normal text-muted-foreground"> · {targetEstablishment}</span>
              ) : null}
            </p>

            {targetRating !== null ? (
              <p className="flex items-center gap-1.5 text-sm">
                <Star aria-hidden="true" className="size-4 text-warning" />
                <span aria-label={`${targetRating} de 5`}>{targetRating} de 5</span>
              </p>
            ) : null}

            {targetPhotos.length > 0 ? (
              <ul className="flex list-none flex-wrap gap-2 p-0" aria-label="Fotos da avaliação">
                {targetPhotos.map((photo) => (
                  <li key={numeric(photo, 'id')}>
                    <a href={text(photo, 'url')} target="_blank" rel="noreferrer">
                      <img
                        src={text(photo, 'url')}
                        alt={text(photo, 'alt_text') || 'Foto enviada com a avaliação'}
                        className="size-20 rounded-md border border-border object-cover"
                        loading="lazy"
                      />
                    </a>
                  </li>
                ))}
              </ul>
            ) : null}

            {targetText ? (
              <p className="whitespace-pre-line text-sm leading-6">{targetText}</p>
            ) : (
              <p className="text-sm italic text-muted-foreground">
                Este conteúdo não tem texto próprio.
              </p>
            )}

            {publicPath ? (
              <Link
                href={publicPath}
                className="inline-block text-sm font-semibold text-primary underline-offset-4 hover:underline"
              >
                Abrir a página pública da unidade
              </Link>
            ) : null}

            {targetType === 'review' && authorId !== null && canResolve ? (
              <BanAuthorControl
                authorId={authorId}
                authorName={targetAuthor}
                banned={authorBanned}
              />
            ) : null}
          </div>
        ) : (
          <p className="mt-2 flex items-center gap-2 text-sm text-muted-foreground">
            <ShieldQuestion aria-hidden="true" className="size-4" />
            O conteúdo denunciado não existe mais. O caso permanece na fila porque o protocolo
            continua válido.
          </p>
        )}
      </section>

      {settled ? (
        <section className="mt-4 rounded-md border border-border bg-muted/40 p-4">
          <h3 className="text-xs font-semibold uppercase tracking-[0.12em] text-muted-foreground">
            Desfecho
          </h3>
          <p className="mt-1.5 text-sm">
            {nullableText(report, 'resolution_action') ?? 'Sem ação registrada'}
            {resolver ? ` · ${text(resolver, 'full_name')}` : ''}
            {nullableText(report, 'resolved_at')
              ? ` · ${formatReportDate(nullableText(report, 'resolved_at'))}`
              : ''}
          </p>
          {nullableText(report, 'resolution_notes') ? (
            <p className="mt-1.5 whitespace-pre-line text-sm leading-6 text-muted-foreground">
              {text(report, 'resolution_notes')}
            </p>
          ) : null}
        </section>
      ) : canResolve ? (
        <form
          className="mt-4 grid gap-4 border-t border-border pt-4 md:grid-cols-[1fr_1fr_auto] md:items-start"
          aria-label={`Decidir a denúncia ${protocol}`}
          onSubmit={(event) => {
            event.preventDefault()
            submit('resolved')
          }}
        >
          <EditorField htmlFor={`report-${id}-action`} label="Desfecho">
            <select
              id={`report-${id}-action`}
              value={form.data.resolution_action}
              disabled={form.processing}
              onChange={(event) => form.setData('resolution_action', event.target.value)}
              className={editorSelectClassName}
            >
              {actions.map((action) => (
                <option key={action.value} value={action.value}>
                  {action.label}
                </option>
              ))}
            </select>
          </EditorField>

          <EditorField
            htmlFor={`report-${id}-notes`}
            label="Nota da decisão"
            error={form.errors.resolution_notes ?? null}
          >
            <Textarea
              id={`report-${id}-notes`}
              rows={2}
              maxLength={4000}
              disabled={form.processing}
              value={form.data.resolution_notes}
              onChange={(event) => form.setData('resolution_notes', event.target.value)}
              placeholder="Registre o que sustentou a decisão"
              className="resize-y"
            />
          </EditorField>

          <div className="flex flex-col gap-2 md:mt-7">
            <Button type="submit" variant="primary" disabled={form.processing}>
              {form.processing ? (
                <>
                  <Loader2 aria-hidden="true" className="size-4 animate-spin" />
                  Registrando…
                </>
              ) : (
                'Resolver'
              )}
            </Button>
            <Button
              type="button"
              variant="outline"
              // Dismissing says the report did not hold. Hiding the content says
              // it did. Allowing both at once would hide a review on the
              // strength of a report the same click rejected.
              disabled={form.processing || hidesContent}
              title={
                hidesContent
                  ? 'Descartar não combina com ocultar o conteúdo: escolha outro desfecho.'
                  : undefined
              }
              onClick={() => submit('dismissed')}
            >
              Descartar
            </Button>
          </div>
        </form>
      ) : (
        <p className="mt-4 border-t border-border pt-4 text-sm text-muted-foreground">
          Você não tem permissão para decidir denúncias nesta operação.
        </p>
      )}
    </article>
  )
}

/**
 * Banning the author of a reported review — ADR-0027 §6.
 *
 * Separate from resolving the report on purpose. Resolving decides about one
 * review; a ban reaches every review the person wrote in this operation, so it
 * gets its own reason and its own confirmation, and the effect is stated before
 * the click rather than discovered after it.
 */
function BanAuthorControl({
  authorId,
  authorName,
  banned,
}: {
  authorId: number
  authorName: string | null
  banned: boolean
}) {
  const [confirming, setConfirming] = useState(false)
  const ban = useForm({ reason: '' })
  const unban = useForm({ reason: '' })
  const who = authorName ?? 'esta pessoa'

  if (banned) {
    return (
      <div className="mt-3 flex flex-wrap items-center gap-2 border-t border-border pt-3">
        <span className="inline-flex items-center gap-1.5 rounded-md border border-danger/25 bg-danger/10 px-2 py-1 text-xs font-semibold text-danger">
          <UserX aria-hidden="true" className="size-3.5" />
          Autor banido nesta operação
        </span>
        <Button
          type="button"
          variant="outline"
          size="sm"
          disabled={unban.processing}
          onClick={() =>
            unban.post(`/backoffice/users/${authorId}/unban`, { preserveScroll: true })
          }
        >
          Retirar banimento
        </Button>
      </div>
    )
  }

  if (!confirming) {
    return (
      <div className="mt-3 border-t border-border pt-3">
        <Button type="button" variant="outline" size="sm" onClick={() => setConfirming(true)}>
          <UserX aria-hidden="true" className="size-4" />
          Banir autor
        </Button>
      </div>
    )
  }

  return (
    <form
      className="mt-3 space-y-3 border-t border-border pt-3"
      aria-label={`Banir ${who}`}
      onSubmit={(event) => {
        event.preventDefault()
        ban.post(`/backoffice/users/${authorId}/ban`, {
          preserveScroll: true,
          onSuccess: () => setConfirming(false),
        })
      }}
    >
      <p className="text-sm leading-6">
        Todas as avaliações de <strong>{who}</strong> nesta operação saem das áreas públicas e das
        médias. Nada é apagado, e retirar o banimento devolve exatamente o que estava publicado.
      </p>
      <EditorField
        htmlFor={`ban-${authorId}-reason`}
        label="Motivo do banimento"
        error={ban.errors.reason ?? null}
      >
        <Textarea
          id={`ban-${authorId}-reason`}
          rows={2}
          minLength={3}
          maxLength={500}
          required
          disabled={ban.processing}
          value={ban.data.reason}
          onChange={(event) => ban.setData('reason', event.target.value)}
          placeholder="Fica no histórico e é o que o próximo moderador lê"
          className="resize-y"
        />
      </EditorField>
      <div className="flex gap-2">
        <Button
          type="submit"
          variant="destructive"
          size="sm"
          disabled={ban.processing || ban.data.reason.trim().length < 3}
        >
          Confirmar banimento
        </Button>
        <Button type="button" variant="outline" size="sm" onClick={() => setConfirming(false)}>
          Cancelar
        </Button>
      </div>
    </form>
  )
}
