import { useForm } from '@inertiajs/react'
import { Loader2, MessageSquareText } from 'lucide-react'
import { useId, useMemo, useRef, useState, type FormEvent } from 'react'

import {
  EditorField,
  editorSelectClassName,
} from '~/components/portal/establishment_editor/editor_field'
import { Alert, AlertDescription, AlertTitle } from '~/components/ui/alert'
import { Button } from '~/components/ui/button'
import { Textarea } from '~/components/ui/textarea'
import { firstError } from '~/lib/form_errors'
import { pilotFeedbackContextLabel } from '~/lib/labels'
import { cn } from '~/lib/utils'

interface FeedbackTarget {
  id: number
  label: string
  organization_id?: number
}

interface FeedbackTargets {
  organizations: FeedbackTarget[]
  establishments: FeedbackTarget[]
}

export interface PilotFeedbackFormProps {
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
  context: NonNullable<PilotFeedbackFormProps['context']>
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
  const idPrefix = useId().replaceAll(':', '')
  const submittingRef = useRef(false)
  const [submitting, setSubmitting] = useState(false)
  const [successMessage, setSuccessMessage] = useState<string | null>(null)
  const form = useForm<FeedbackFormData>({
    context,
    rating: 5,
    message: '',
    organization_id: organizationId,
    establishment_id: establishmentId,
  })

  const visibleEstablishments = useMemo(
    () =>
      form.data.organization_id
        ? targets.establishments.filter(
            (establishment) => establishment.organization_id === form.data.organization_id
          )
        : targets.establishments,
    [form.data.organization_id, targets.establishments]
  )

  const selectedOrganization = targets.organizations.find(
    (organization) => organization.id === form.data.organization_id
  )
  const selectedEstablishment = targets.establishments.find(
    (establishment) => establishment.id === form.data.establishment_id
  )
  const errors = form.errors as Record<string, unknown>
  const generalError = firstError(errors.general ?? errors.feedback ?? errors.form)
  const busy = submitting || form.processing

  function fieldError(field: keyof FeedbackFormData) {
    return firstError(errors[field])
  }

  function submit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault()
    if (submittingRef.current) return

    submittingRef.current = true
    setSubmitting(true)
    setSuccessMessage(null)

    form.post('/portal/feedback', {
      preserveScroll: true,
      onSuccess: () => {
        form.reset('message')
        setSuccessMessage('Feedback enviado. Obrigado por ajudar a melhorar o piloto.')
      },
      onFinish: () => {
        submittingRef.current = false
        setSubmitting(false)
      },
    })
  }

  return (
    <form
      onSubmit={submit}
      className={cn(
        compact
          ? 'space-y-4 rounded-2xl border border-border bg-card p-5'
          : 'space-y-5 rounded-3xl border border-border bg-card p-6 shadow-sm'
      )}
      aria-busy={busy}
    >
      <div className="flex items-start gap-3">
        <span className="flex size-9 shrink-0 items-center justify-center rounded-xl bg-primary/10 text-primary">
          <MessageSquareText aria-hidden="true" className="size-4" />
        </span>
        <div>
          <p className="text-sm font-semibold">Feedback do piloto</p>
          <p className="mt-1 text-sm text-muted-foreground">
            Conte o que funcionou e o que ainda atrapalha sua operação.
          </p>
          <p className="mt-1 text-xs font-medium text-primary">
            Contexto: {pilotFeedbackContextLabel(context)}
          </p>
        </div>
      </div>

      {generalError ? (
        <Alert variant="destructive" role="alert">
          <AlertTitle>Não foi possível enviar o feedback</AlertTitle>
          <AlertDescription>{generalError}</AlertDescription>
        </Alert>
      ) : null}

      {successMessage ? (
        <Alert role="status" aria-live="polite">
          <AlertTitle>Feedback recebido</AlertTitle>
          <AlertDescription>{successMessage}</AlertDescription>
        </Alert>
      ) : null}

      <div className="grid gap-4 sm:grid-cols-2">
        <EditorField
          htmlFor={`${idPrefix}-rating`}
          label="Nota"
          hint="5 representa a melhor experiência."
          required
          error={fieldError('rating')}
        >
          <select
            id={`${idPrefix}-rating`}
            name="rating"
            required
            disabled={busy}
            value={form.data.rating}
            onChange={(event) => form.setData('rating', Number(event.target.value))}
            className={editorSelectClassName}
          >
            {[5, 4, 3, 2, 1].map((rating) => (
              <option key={rating} value={rating}>
                {rating} de 5
              </option>
            ))}
          </select>
        </EditorField>

        {organizationId ? (
          <div className="rounded-xl border border-border/70 bg-muted/35 px-4 py-3 text-sm">
            <p className="font-medium">Organização relacionada</p>
            <p className="mt-1 text-muted-foreground">
              {selectedOrganization?.label ?? `Organização ${organizationId}`}
            </p>
          </div>
        ) : (
          <EditorField
            htmlFor={`${idPrefix}-organization`}
            label="Organização"
            error={fieldError('organization_id')}
          >
            <select
              id={`${idPrefix}-organization`}
              name="organization_id"
              disabled={busy}
              value={form.data.organization_id ?? ''}
              onChange={(event) => {
                const value = event.target.value ? Number(event.target.value) : null
                form.setData((data) => ({
                  ...data,
                  organization_id: value,
                  establishment_id: null,
                }))
              }}
              className={editorSelectClassName}
            >
              <option value="">Geral</option>
              {targets.organizations.map((organization) => (
                <option key={organization.id} value={organization.id}>
                  {organization.label}
                </option>
              ))}
            </select>
          </EditorField>
        )}
      </div>

      {establishmentId ? (
        <div className="rounded-xl border border-border/70 bg-muted/35 px-4 py-3 text-sm">
          <p className="font-medium">Unidade relacionada</p>
          <p className="mt-1 text-muted-foreground">
            {selectedEstablishment?.label ?? `Unidade ${establishmentId}`}
          </p>
        </div>
      ) : visibleEstablishments.length > 0 ? (
        <EditorField
          htmlFor={`${idPrefix}-establishment`}
          label="Unidade relacionada"
          error={fieldError('establishment_id')}
        >
          <select
            id={`${idPrefix}-establishment`}
            name="establishment_id"
            disabled={busy}
            value={form.data.establishment_id ?? ''}
            onChange={(event) =>
              form.setData(
                'establishment_id',
                event.target.value ? Number(event.target.value) : null
              )
            }
            className={editorSelectClassName}
          >
            <option value="">Nenhuma unidade específica</option>
            {visibleEstablishments.map((establishment) => (
              <option key={establishment.id} value={establishment.id}>
                {establishment.label}
              </option>
            ))}
          </select>
        </EditorField>
      ) : null}

      <EditorField
        htmlFor={`${idPrefix}-message`}
        label="Mensagem"
        hint={`${form.data.message.length.toLocaleString('pt-BR')} de 4.000 caracteres`}
        required
        error={fieldError('message')}
      >
        <Textarea
          id={`${idPrefix}-message`}
          name="message"
          required
          minLength={10}
          maxLength={4000}
          rows={compact ? 3 : 5}
          disabled={busy}
          value={form.data.message}
          onChange={(event) => form.setData('message', event.target.value)}
          placeholder="Descreva o fluxo, a dificuldade ou a melhoria sugerida."
          className="resize-y"
        />
      </EditorField>

      <Button type="submit" disabled={busy} aria-disabled={busy}>
        {busy ? (
          <>
            <Loader2 aria-hidden="true" className="size-4 animate-spin" />
            Enviando…
          </>
        ) : (
          'Enviar feedback'
        )}
      </Button>
    </form>
  )
}
