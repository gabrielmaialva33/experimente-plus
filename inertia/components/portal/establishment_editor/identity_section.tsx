import type { FormEventHandler } from 'react'
import { Store } from 'lucide-react'

import {
  EditorSaveBar,
  EditorSection,
  type EditorDisplayIssue,
} from '~/components/portal/editor_section'
import { Badge } from '~/components/ui/badge'
import { Input } from '~/components/ui/input'
import { Textarea } from '~/components/ui/textarea'
import { firstError } from '~/lib/form_errors'
import { stringValue, type JsonRecord } from '~/lib/establishment_editor'
import { EditorField, editorSelectClassName } from './editor_field'
import type { IdentityForm } from './types'

interface IdentitySectionProps {
  form: IdentityForm
  cities: JsonRecord[]
  editable: boolean
  busy: boolean
  issues: EditorDisplayIssue[]
  availabilityLabel: string
  onSubmit: FormEventHandler<HTMLFormElement>
}

export function IdentitySection({
  form,
  cities,
  editable,
  busy,
  issues,
  availabilityLabel,
  onSubmit,
}: IdentitySectionProps) {
  const controlsDisabled = !editable || busy

  return (
    <EditorSection
      id="identity"
      icon={Store}
      title="Identidade, atendimento e contatos"
      description="Defina como a unidade aparece no catálogo e quais canais o visitante pode usar para entrar em contato."
      issues={issues}
      toolbar={
        <Badge variant="outline" size="sm">
          {availabilityLabel}
        </Badge>
      }
    >
      <form onSubmit={onSubmit} aria-busy={form.processing}>
        <div className="space-y-6 p-5 sm:p-6">
          <div className="grid gap-4 md:grid-cols-2">
            <EditorField
              htmlFor="public-name"
              label="Nome público"
              required
              error={firstError(form.errors.public_name)}
              className="md:col-span-2"
            >
              <Input
                id="public-name"
                name="public_name"
                autoComplete="organization"
                variant="lg"
                disabled={controlsDisabled}
                value={form.data.public_name}
                onChange={(event) => form.setData('public_name', event.target.value)}
                aria-invalid={Boolean(form.errors.public_name)}
                placeholder="Nome reconhecido pelos clientes"
              />
            </EditorField>

            <EditorField
              htmlFor="city"
              label="Cidade"
              required
              error={firstError(form.errors.city_id)}
            >
              <select
                id="city"
                name="city_id"
                autoComplete="address-level2"
                disabled={controlsDisabled}
                value={form.data.city_id ?? ''}
                onChange={(event) =>
                  form.setData('city_id', event.target.value ? Number(event.target.value) : null)
                }
                className={editorSelectClassName}
              >
                <option value="">Selecione uma cidade</option>
                {cities.map((city) => (
                  <option key={Number(city.id)} value={Number(city.id)}>
                    {stringValue(city, 'name')}
                  </option>
                ))}
              </select>
            </EditorField>

            <EditorField
              htmlFor="availability-type"
              label="Forma de atendimento"
              required
              error={firstError(form.errors.availability_type)}
            >
              <select
                id="availability-type"
                name="availability_type"
                disabled={controlsDisabled}
                value={form.data.availability_type}
                onChange={(event) => form.setData('availability_type', event.target.value)}
                className={editorSelectClassName}
              >
                <option value="regular_hours">Horários regulares</option>
                <option value="always_open">Sempre aberto</option>
                <option value="appointment_only">Somente com agendamento</option>
              </select>
            </EditorField>
          </div>

          <EditorField
            htmlFor="short-description"
            label="Descrição curta"
            hint={`${form.data.short_description.length}/280`}
            error={firstError(form.errors.short_description)}
          >
            <Textarea
              id="short-description"
              name="short_description"
              variant="lg"
              rows={3}
              maxLength={280}
              disabled={controlsDisabled}
              value={form.data.short_description}
              onChange={(event) => form.setData('short_description', event.target.value)}
              className="resize-y"
              placeholder="Uma frase objetiva para apresentar a unidade nos resultados."
            />
          </EditorField>

          <EditorField
            htmlFor="description"
            label="Descrição completa"
            hint={`${form.data.description.length}/4000`}
            error={firstError(form.errors.description)}
          >
            <Textarea
              id="description"
              name="description"
              variant="lg"
              rows={6}
              maxLength={4000}
              disabled={controlsDisabled}
              value={form.data.description}
              onChange={(event) => form.setData('description', event.target.value)}
              className="resize-y"
              placeholder="Conte o que torna esta unidade relevante, para quem ela é e o que o visitante encontra."
            />
          </EditorField>

          <div>
            <div className="mb-4">
              <p className="text-sm font-semibold">Canais públicos</p>
              <p className="mt-1 text-xs leading-5 text-muted-foreground">
                Informe ao menos um contato. Para atendimento por agendamento, use telefone,
                WhatsApp ou link de reserva.
              </p>
            </div>
            <div className="grid gap-4 md:grid-cols-2">
              {(
                [
                  ['public_email', 'E-mail público', 'email', 'contato@empresa.com.br'],
                  ['public_phone', 'Telefone público', 'tel', '(43) 0000-0000'],
                  ['whatsapp', 'WhatsApp', 'tel', '(43) 90000-0000'],
                  ['website', 'Website', 'url', 'https://empresa.com.br'],
                  ['instagram', 'Instagram', 'text', '@empresa'],
                  ['booking_url', 'Link de agendamento', 'url', 'https://reserva.exemplo.com'],
                ] as const
              ).map(([name, label, type, placeholder]) => (
                <EditorField
                  key={name}
                  htmlFor={name}
                  label={label}
                  error={firstError(form.errors[name])}
                >
                  <Input
                    id={name}
                    name={name}
                    variant="lg"
                    type={type}
                    autoComplete={
                      name === 'public_email'
                        ? 'email'
                        : name === 'public_phone' || name === 'whatsapp'
                          ? 'tel'
                          : name === 'website'
                            ? 'url'
                            : 'off'
                    }
                    disabled={controlsDisabled}
                    value={form.data[name]}
                    onChange={(event) => form.setData(name, event.target.value)}
                    placeholder={placeholder}
                    aria-invalid={Boolean(form.errors[name])}
                  />
                </EditorField>
              ))}
            </div>
          </div>

          {form.hasErrors ? (
            <p
              role="alert"
              className="rounded-lg border border-destructive/20 bg-destructive/10 px-3 py-2 text-sm text-destructive"
            >
              {firstError(form.errors)}
            </p>
          ) : null}
        </div>

        {editable ? (
          <EditorSaveBar
            processing={form.processing}
            recentlySuccessful={form.recentlySuccessful}
            dirty={form.isDirty}
            disabled={busy && !form.processing}
            label="Salvar identidade"
            onDiscard={() => {
              form.reset()
              form.clearErrors()
            }}
          />
        ) : null}
      </form>
    </EditorSection>
  )
}
