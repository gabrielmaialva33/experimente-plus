import type { FormEventHandler } from 'react'
import { ExternalLink, MapPin } from 'lucide-react'

import {
  EditorSaveBar,
  EditorSection,
  type EditorDisplayIssue,
} from '~/components/portal/editor_section'
import { Button } from '~/components/ui/button'
import { Checkbox } from '~/components/ui/checkbox'
import { Input } from '~/components/ui/input'
import { firstError } from '~/lib/form_errors'
import { EditorField } from './editor_field'
import type { AddressForm } from './types'

interface AddressSectionProps {
  form: AddressForm
  editable: boolean
  busy: boolean
  issues: EditorDisplayIssue[]
  onSubmit: FormEventHandler<HTMLFormElement>
}

export function AddressSection({ form, editable, busy, issues, onSubmit }: AddressSectionProps) {
  const controlsDisabled = !editable || busy
  const coordinatesAvailable =
    typeof form.data.latitude === 'number' && typeof form.data.longitude === 'number'

  return (
    <EditorSection
      id="address"
      icon={MapPin}
      title="Endereço e localização"
      description="O endereço sustenta a descoberta regional; as coordenadas posicionam corretamente a unidade no mapa."
      issues={issues}
      toolbar={
        coordinatesAvailable ? (
          <Button asChild variant="outline" size="sm">
            <a
              href={`https://www.google.com/maps?q=${form.data.latitude},${form.data.longitude}`}
              target="_blank"
              rel="noreferrer"
            >
              <ExternalLink />
              Ver no mapa
            </a>
          </Button>
        ) : null
      }
    >
      <form onSubmit={onSubmit} aria-busy={form.processing}>
        <div className="space-y-6 p-5 sm:p-6">
          <div className="grid gap-4 md:grid-cols-2">
            <EditorField
              htmlFor="postal-code"
              label="CEP"
              error={firstError(form.errors.postal_code)}
            >
              <Input
                id="postal-code"
                name="postal_code"
                autoComplete="postal-code"
                variant="lg"
                inputMode="numeric"
                disabled={controlsDisabled}
                value={form.data.postal_code}
                onChange={(event) => form.setData('postal_code', event.target.value)}
                placeholder="00000-000"
              />
            </EditorField>

            <EditorField htmlFor="state-code" label="UF" error={firstError(form.errors.state_code)}>
              <Input
                id="state-code"
                name="state_code"
                autoComplete="address-level1"
                variant="lg"
                maxLength={2}
                disabled={controlsDisabled}
                value={form.data.state_code}
                onChange={(event) => form.setData('state_code', event.target.value.toUpperCase())}
                placeholder="PR"
              />
            </EditorField>

            <EditorField
              htmlFor="street"
              label="Logradouro"
              required
              error={firstError(form.errors.street)}
              className="md:col-span-2"
            >
              <Input
                id="street"
                name="street"
                autoComplete="address-line1"
                variant="lg"
                disabled={controlsDisabled}
                value={form.data.street}
                onChange={(event) => form.setData('street', event.target.value)}
                placeholder="Rua, avenida ou estrada"
              />
            </EditorField>

            <EditorField htmlFor="number" label="Número" error={firstError(form.errors.number)}>
              <Input
                id="number"
                name="number"
                autoComplete="off"
                variant="lg"
                disabled={controlsDisabled || form.data.without_number}
                value={form.data.number}
                onChange={(event) => form.setData('number', event.target.value)}
                placeholder={form.data.without_number ? 'Sem número' : '120'}
              />
            </EditorField>

            <EditorField
              htmlFor="district"
              label="Bairro"
              required
              error={firstError(form.errors.district)}
            >
              <Input
                id="district"
                name="district"
                autoComplete="address-level3"
                variant="lg"
                disabled={controlsDisabled}
                value={form.data.district}
                onChange={(event) => form.setData('district', event.target.value)}
                placeholder="Centro"
              />
            </EditorField>

            <EditorField
              htmlFor="complement"
              label="Complemento"
              error={firstError(form.errors.complement)}
              className="md:col-span-2"
            >
              <Input
                id="complement"
                name="complement"
                autoComplete="address-line2"
                variant="lg"
                disabled={controlsDisabled}
                value={form.data.complement}
                onChange={(event) => form.setData('complement', event.target.value)}
                placeholder="Sala, bloco, piso ou ponto de referência"
              />
            </EditorField>
          </div>

          <label className="flex cursor-pointer items-start gap-3 rounded-xl border border-border/70 bg-muted/25 p-4">
            <Checkbox
              name="without_number"
              checked={form.data.without_number}
              disabled={controlsDisabled}
              onCheckedChange={(checked) =>
                form.setData((data) => ({
                  ...data,
                  without_number: checked === true,
                  number: checked === true ? '' : data.number,
                }))
              }
            />
            <span>
              <span className="block text-sm font-medium">Este endereço não tem número</span>
              <span className="mt-1 block text-xs leading-5 text-muted-foreground">
                Use somente quando a localização realmente for identificada sem numeração.
              </span>
            </span>
          </label>

          <div className="rounded-xl border border-border/70 bg-muted/20 p-4">
            <div className="mb-4">
              <p className="text-sm font-semibold">Coordenadas</p>
              <p className="mt-1 text-xs leading-5 text-muted-foreground">
                Informe valores decimais. O sistema valida o par e impede coordenadas incompletas.
              </p>
            </div>
            <div className="grid gap-4 md:grid-cols-2">
              <EditorField
                htmlFor="latitude"
                label="Latitude"
                error={firstError(form.errors.latitude)}
              >
                <Input
                  id="latitude"
                  name="latitude"
                  variant="lg"
                  type="number"
                  step="any"
                  disabled={controlsDisabled}
                  value={form.data.latitude ?? ''}
                  onChange={(event) =>
                    form.setData('latitude', event.target.value ? Number(event.target.value) : null)
                  }
                  placeholder="-23.1813"
                />
              </EditorField>
              <EditorField
                htmlFor="longitude"
                label="Longitude"
                error={firstError(form.errors.longitude)}
              >
                <Input
                  id="longitude"
                  name="longitude"
                  variant="lg"
                  type="number"
                  step="any"
                  disabled={controlsDisabled}
                  value={form.data.longitude ?? ''}
                  onChange={(event) =>
                    form.setData(
                      'longitude',
                      event.target.value ? Number(event.target.value) : null
                    )
                  }
                  placeholder="-50.6467"
                />
              </EditorField>
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
            label="Salvar endereço"
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
