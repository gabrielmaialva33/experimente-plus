import { router } from '@inertiajs/react'
import { History, Loader2, Pencil } from 'lucide-react'
import { useState, type FormEvent } from 'react'

import { EditorField } from '~/components/portal/establishment_editor/editor_field'
import { Button } from '~/components/ui/button'
import { Input } from '~/components/ui/input'
import { Textarea } from '~/components/ui/textarea'
import {
  centsToReais,
  formatPartnerContentDate,
  isoToZonedLocal,
  reaisToCents,
  zonedLocalToIso,
  type PartnerContentPath,
  type PartnerContentStatus,
} from '~/lib/partner_content'
import {
  describeChanges,
  partnerContentEventLabels,
  partnerContentEvents,
  type PartnerContentEvent,
} from '~/lib/partner_content_history'

interface EditorProps {
  kind: PartnerContentPath
  contentId: number
  status: PartnerContentStatus
  title: string
  description: string | null
  startsAt: string | null
  endsAt: string | null
  priceCents: number | null
  timeZone: string | null
}

/**
 * An administrator's correction — Anexo I item 7, ADR-0028 §4.
 *
 * What saving does depends on where the item is, and the form says so before
 * the click: on published content the public reads the correction at once; on
 * a draft or an item awaiting approval nothing becomes public.
 */
export function PartnerContentAdminEditor({
  kind,
  contentId,
  status,
  title,
  description,
  startsAt,
  endsAt,
  priceCents,
  timeZone,
}: EditorProps) {
  const zone = timeZone || 'America/Sao_Paulo'
  const [open, setOpen] = useState(false)
  const [processing, setProcessing] = useState(false)
  const [form, setForm] = useState({
    title,
    description: description ?? '',
    startsAt: isoToZonedLocal(startsAt, zone),
    endsAt: isoToZonedLocal(endsAt, zone),
    price: centsToReais(priceCents),
  })

  if (status === 'archived') return null

  if (!open) {
    return (
      <Button type="button" variant="outline" size="sm" onClick={() => setOpen(true)}>
        <Pencil aria-hidden="true" className="size-3.5" />
        Corrigir
      </Button>
    )
  }

  function submit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault()
    const payload: Record<string, string | number | null> = {
      title: form.title.trim(),
      description: form.description.trim() || null,
    }
    if (kind === 'events') {
      const starts = zonedLocalToIso(form.startsAt, zone)
      const ends = zonedLocalToIso(form.endsAt, zone)
      if (starts) payload.starts_at = starts
      if (ends) payload.ends_at = ends
    }
    if (kind === 'showcase-items') {
      payload.informational_price_cents = reaisToCents(form.price)
    }

    setProcessing(true)
    router.put('/backoffice/content/' + kind + '/' + contentId, payload, {
      preserveScroll: true,
      onSuccess: () => setOpen(false),
      onFinish: () => setProcessing(false),
    })
  }

  const prefix = 'admin-edit-' + contentId

  return (
    <form
      onSubmit={submit}
      aria-label="Corrigir conteúdo"
      className="mt-4 grid gap-4 rounded-md border border-border bg-muted/30 p-4"
    >
      <p className="text-sm leading-6" data-testid={prefix + '-effect'}>
        {status === 'published'
          ? 'Este conteúdo está publicado: a correção fica visível ao público assim que for salva, sem passar pela fila. A data de publicação não muda.'
          : 'Este conteúdo não está publicado: a correção fica salva e o item continua onde o parceiro o deixou.'}
      </p>

      <EditorField htmlFor={prefix + '-title'} label="Título">
        <Input
          id={prefix + '-title'}
          required
          maxLength={180}
          value={form.title}
          onChange={(event) => setForm((current) => ({ ...current, title: event.target.value }))}
          disabled={processing}
        />
      </EditorField>

      <EditorField htmlFor={prefix + '-description'} label="Descrição">
        <Textarea
          id={prefix + '-description'}
          maxLength={4000}
          rows={3}
          value={form.description}
          onChange={(event) =>
            setForm((current) => ({ ...current, description: event.target.value }))
          }
          disabled={processing}
          className="resize-y"
        />
      </EditorField>

      {kind === 'events' ? (
        <div className="grid gap-4 sm:grid-cols-2">
          <EditorField
            htmlFor={prefix + '-starts'}
            label="Início"
            hint={'No fuso da cidade (' + zone + ')'}
          >
            <Input
              id={prefix + '-starts'}
              type="datetime-local"
              value={form.startsAt}
              onChange={(event) =>
                setForm((current) => ({ ...current, startsAt: event.target.value }))
              }
              disabled={processing}
            />
          </EditorField>
          <EditorField htmlFor={prefix + '-ends'} label="Fim">
            <Input
              id={prefix + '-ends'}
              type="datetime-local"
              value={form.endsAt}
              onChange={(event) =>
                setForm((current) => ({ ...current, endsAt: event.target.value }))
              }
              disabled={processing}
            />
          </EditorField>
        </div>
      ) : null}

      {kind === 'showcase-items' ? (
        <EditorField htmlFor={prefix + '-price'} label="Preço informativo (R$)">
          <Input
            id={prefix + '-price'}
            inputMode="decimal"
            value={form.price}
            onChange={(event) => setForm((current) => ({ ...current, price: event.target.value }))}
            disabled={processing}
          />
        </EditorField>
      ) : null}

      <div className="flex gap-2">
        <Button type="submit" size="sm" disabled={processing || !form.title.trim()}>
          {processing ? <Loader2 aria-hidden="true" className="size-3.5 animate-spin" /> : null}
          Salvar correção
        </Button>
        <Button
          type="button"
          variant="outline"
          size="sm"
          disabled={processing}
          onClick={() => setOpen(false)}
        >
          Cancelar
        </Button>
      </div>
    </form>
  )
}

/**
 * The append-only history of one item, loaded on demand from the admin API.
 *
 * On demand rather than with the page, because a queue of twenty items does not
 * need twenty histories to be useful, and the moderator opens the one in doubt.
 */
export function PartnerContentHistory({
  tenantId,
  kind,
  contentId,
  timeZone,
}: {
  tenantId: number
  kind: PartnerContentPath
  contentId: number
  timeZone: string | null
}) {
  const [events, setEvents] = useState<PartnerContentEvent[] | null>(null)
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState<string | null>(null)

  async function load() {
    setLoading(true)
    setError(null)
    try {
      const response = await fetch(
        '/api/v1/admin/content/' + kind + '/' + contentId + '/history',
        {
          credentials: 'same-origin',
          headers: { 'Accept': 'application/json', 'x-tenant-id': String(tenantId) },
        }
      )
      if (!response.ok) throw new Error('history request failed')
      setEvents(partnerContentEvents(await response.json()))
    } catch {
      setError('Não foi possível carregar o histórico agora.')
    } finally {
      setLoading(false)
    }
  }

  if (events === null) {
    return (
      <div className="flex flex-col items-start gap-2">
        <Button type="button" variant="ghost" size="sm" disabled={loading} onClick={load}>
          {loading ? (
            <Loader2 aria-hidden="true" className="size-3.5 animate-spin" />
          ) : (
            <History aria-hidden="true" className="size-3.5" />
          )}
          Histórico
        </Button>
        {error ? (
          <p role="alert" className="text-xs text-danger">
            {error}
          </p>
        ) : null}
      </div>
    )
  }

  return (
    <section aria-label="Histórico do conteúdo" className="mt-4 border-t border-border pt-4">
      <h3 className="text-xs font-semibold uppercase tracking-[0.12em] text-muted-foreground">
        Histórico
      </h3>
      {events.length === 0 ? (
        <p className="mt-2 text-sm text-muted-foreground">Nenhum registro ainda.</p>
      ) : (
        <ol className="mt-2 space-y-3">
          {events.map((event) => (
            <li key={event.id} className="text-sm">
              <p className="font-semibold">
                {partnerContentEventLabels[event.action] ?? event.action}
                {event.republished ? ' · publicado na hora' : ''}
              </p>
              <p className="text-xs text-muted-foreground">
                {event.actorName ?? 'Autor desconhecido'} ·{' '}
                {formatPartnerContentDate(event.createdAt, timeZone) ?? event.createdAt}
              </p>
              {describeChanges(event.changes, timeZone).map((line) => (
                <p key={line} className="mt-1 whitespace-pre-line text-xs leading-5">
                  {line}
                </p>
              ))}
            </li>
          ))}
        </ol>
      )}
    </section>
  )
}
