import { useForm } from '@inertiajs/react'
import type { FormEvent } from 'react'

interface FeedbackTarget {
  id: number
  label: string
  organization_id?: number
}

interface FeedbackTargets {
  organizations: FeedbackTarget[]
  establishments: FeedbackTarget[]
}

interface PilotFeedbackFormProps {
  targets: FeedbackTargets
  context?:
    | 'general'
    | 'onboarding'
    | 'organization'
    | 'establishment'
    | 'catalog'
    | 'analytics'
    | 'moderation'
  organizationId?: number | null
  establishmentId?: number | null
  compact?: boolean
}

interface FeedbackFormData {
  context: PilotFeedbackFormProps['context']
  rating: number
  message: string
  organization_id: number | null
  establishment_id: number | null
}

export default function PilotFeedbackForm({
  targets,
  context = 'general',
  organizationId = null,
  establishmentId = null,
  compact = false,
}: PilotFeedbackFormProps) {
  const form = useForm<FeedbackFormData>({
    context,
    rating: 5,
    message: '',
    organization_id: organizationId,
    establishment_id: establishmentId,
  })

  const visibleEstablishments = form.data.organization_id
    ? targets.establishments.filter(
        (establishment) => establishment.organization_id === form.data.organization_id
      )
    : targets.establishments

  function submit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault()
    form.post('/portal/feedback', {
      preserveScroll: true,
      onSuccess: () => form.reset('message'),
    })
  }

  return (
    <form
      onSubmit={submit}
      className={
        compact
          ? 'space-y-4 rounded-2xl border border-border bg-card p-5'
          : 'space-y-5 rounded-3xl border border-border bg-card p-6 shadow-sm'
      }
    >
      <div>
        <p className="text-sm font-semibold">Feedback do piloto</p>
        <p className="mt-1 text-sm text-muted-foreground">
          Conte o que funcionou e o que ainda atrapalha sua operação.
        </p>
      </div>

      <div className="grid gap-4 sm:grid-cols-2">
        <label className="space-y-2 text-sm">
          <span className="font-medium">Nota</span>
          <select
            value={form.data.rating}
            onChange={(event) => form.setData('rating', Number(event.target.value))}
            className="w-full rounded-xl border border-input bg-background px-3 py-2"
          >
            {[5, 4, 3, 2, 1].map((rating) => (
              <option key={rating} value={rating}>
                {rating} de 5
              </option>
            ))}
          </select>
        </label>

        <label className="space-y-2 text-sm">
          <span className="font-medium">Organização</span>
          <select
            value={form.data.organization_id ?? ''}
            onChange={(event) => {
              const value = event.target.value ? Number(event.target.value) : null
              form.setData((data) => ({
                ...data,
                organization_id: value,
                establishment_id: null,
              }))
            }}
            className="w-full rounded-xl border border-input bg-background px-3 py-2"
          >
            <option value="">Geral</option>
            {targets.organizations.map((organization) => (
              <option key={organization.id} value={organization.id}>
                {organization.label}
              </option>
            ))}
          </select>
        </label>
      </div>

      {visibleEstablishments.length > 0 ? (
        <label className="block space-y-2 text-sm">
          <span className="font-medium">Unidade relacionada</span>
          <select
            value={form.data.establishment_id ?? ''}
            onChange={(event) =>
              form.setData(
                'establishment_id',
                event.target.value ? Number(event.target.value) : null
              )
            }
            className="w-full rounded-xl border border-input bg-background px-3 py-2"
          >
            <option value="">Nenhuma unidade específica</option>
            {visibleEstablishments.map((establishment) => (
              <option key={establishment.id} value={establishment.id}>
                {establishment.label}
              </option>
            ))}
          </select>
        </label>
      ) : null}

      <label className="block space-y-2 text-sm">
        <span className="font-medium">Mensagem</span>
        <textarea
          required
          minLength={10}
          maxLength={4000}
          rows={compact ? 3 : 5}
          value={form.data.message}
          onChange={(event) => form.setData('message', event.target.value)}
          placeholder="Descreva o fluxo, a dificuldade ou a melhoria sugerida."
          className="w-full resize-y rounded-xl border border-input bg-background px-3 py-2"
        />
        {form.errors.message ? (
          <span className="text-xs text-destructive">{form.errors.message}</span>
        ) : null}
      </label>

      <button
        type="submit"
        disabled={form.processing}
        className="rounded-xl bg-primary px-4 py-2 text-sm font-semibold text-primary-foreground disabled:opacity-60"
      >
        {form.processing ? 'Enviando…' : 'Enviar feedback'}
      </button>
    </form>
  )
}
