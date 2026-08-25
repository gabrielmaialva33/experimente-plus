import { useForm } from '@inertiajs/react'
import type { FormEvent } from 'react'

export type EffectiveAttributeDataType =
  | 'text'
  | 'long_text'
  | 'boolean'
  | 'integer'
  | 'decimal'
  | 'single_select'
  | 'multi_select'
  | 'url'

export interface EffectiveAttributeOption {
  id: number
  label: string
  value: string
}

export interface EffectiveAttribute {
  id: number
  key: string
  name: string
  description: string | null
  data_type: EffectiveAttributeDataType
  unit: string | null
  is_required: boolean
  source_category_id: number
  inherited: boolean
  options: EffectiveAttributeOption[]
  value: string | number | boolean | null
  option_ids: number[]
}

interface AttributeFormItem {
  attribute_definition_id: number
  value: string | number | boolean | null
  option_ids: number[]
}

interface AttributeFormData {
  attributes: AttributeFormItem[]
}

interface EffectiveAttributesFormProps {
  establishmentId: number
  attributes: EffectiveAttribute[]
  editable: boolean
}

const fieldClassName =
  'w-full rounded-xl border border-input bg-background px-3 py-2 disabled:opacity-60'

export default function EffectiveAttributesForm({
  establishmentId,
  attributes,
  editable,
}: EffectiveAttributesFormProps) {
  const form = useForm<AttributeFormData>({
    attributes: attributes.map((attribute) => ({
      attribute_definition_id: attribute.id,
      value: attribute.value,
      option_ids: attribute.option_ids,
    })),
  })

  function updateValue(index: number, value: AttributeFormItem['value']) {
    form.setData(
      'attributes',
      form.data.attributes.map((item, itemIndex) =>
        itemIndex === index ? { ...item, value } : item
      )
    )
  }

  function updateOptions(index: number, optionIds: number[]) {
    form.setData(
      'attributes',
      form.data.attributes.map((item, itemIndex) =>
        itemIndex === index ? { ...item, option_ids: optionIds } : item
      )
    )
  }

  function toggleOption(index: number, optionId: number) {
    const selected = form.data.attributes[index].option_ids
    updateOptions(
      index,
      selected.includes(optionId)
        ? selected.filter((selectedId) => selectedId !== optionId)
        : [...selected, optionId]
    )
  }

  function submit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault()
    form.put(`/portal/establishments/${establishmentId}/attributes`, {
      preserveScroll: true,
    })
  }

  return (
    <form
      onSubmit={submit}
      className="space-y-5 rounded-3xl border border-border bg-card p-6 shadow-sm"
    >
      <div>
        <h2 className="text-xl font-semibold">Características da categoria</h2>
        <p className="mt-1 text-sm text-muted-foreground">
          Os campos são definidos pela categoria principal. Regras de tipo, herança e
          obrigatoriedade são validadas pelo servidor.
        </p>
      </div>

      {attributes.length === 0 ? (
        <div className="rounded-2xl bg-muted/50 p-4 text-sm text-muted-foreground">
          Selecione e salve uma categoria principal. Quando ela possuir características específicas,
          os campos aparecerão aqui.
        </div>
      ) : (
        <div className="grid gap-5 lg:grid-cols-2">
          {attributes.map((attribute, index) => {
            const item = form.data.attributes[index]
            const label = (
              <span className="flex flex-wrap items-center gap-2 font-medium">
                {attribute.name}
                {attribute.is_required ? (
                  <span className="rounded-full bg-destructive/10 px-2 py-0.5 text-xs text-destructive">
                    Obrigatório
                  </span>
                ) : null}
                <span className="rounded-full bg-muted px-2 py-0.5 text-xs font-normal text-muted-foreground">
                  {attribute.inherited ? 'Herdado' : 'Categoria principal'}
                </span>
              </span>
            )

            return (
              <div
                key={attribute.id}
                className={
                  attribute.data_type === 'long_text' || attribute.data_type === 'multi_select'
                    ? 'space-y-2 text-sm lg:col-span-2'
                    : 'space-y-2 text-sm'
                }
              >
                {attribute.data_type === 'boolean' ? (
                  <label className="block space-y-2">
                    {label}
                    <select
                      disabled={!editable}
                      value={
                        item.value === null || typeof item.value !== 'boolean'
                          ? ''
                          : item.value
                            ? 'true'
                            : 'false'
                      }
                      onChange={(event) =>
                        updateValue(
                          index,
                          event.target.value === '' ? null : event.target.value === 'true'
                        )
                      }
                      className={fieldClassName}
                    >
                      <option value="">Não informado</option>
                      <option value="true">Sim</option>
                      <option value="false">Não</option>
                    </select>
                  </label>
                ) : null}

                {attribute.data_type === 'text' || attribute.data_type === 'url' ? (
                  <label className="block space-y-2">
                    {label}
                    <input
                      type={attribute.data_type === 'url' ? 'url' : 'text'}
                      disabled={!editable}
                      value={typeof item.value === 'string' ? item.value : ''}
                      onChange={(event) => updateValue(index, event.target.value)}
                      className={fieldClassName}
                    />
                  </label>
                ) : null}

                {attribute.data_type === 'long_text' ? (
                  <label className="block space-y-2">
                    {label}
                    <textarea
                      rows={4}
                      disabled={!editable}
                      value={typeof item.value === 'string' ? item.value : ''}
                      onChange={(event) => updateValue(index, event.target.value)}
                      className={`${fieldClassName} resize-y`}
                    />
                  </label>
                ) : null}

                {attribute.data_type === 'integer' || attribute.data_type === 'decimal' ? (
                  <label className="block space-y-2">
                    {label}
                    <div className="flex items-center gap-2">
                      <input
                        type="number"
                        step={attribute.data_type === 'integer' ? '1' : 'any'}
                        disabled={!editable}
                        value={typeof item.value === 'number' ? item.value : ''}
                        onChange={(event) =>
                          updateValue(
                            index,
                            event.target.value === '' ? null : Number(event.target.value)
                          )
                        }
                        className={fieldClassName}
                      />
                      {attribute.unit ? (
                        <span className="shrink-0 text-muted-foreground">{attribute.unit}</span>
                      ) : null}
                    </div>
                  </label>
                ) : null}

                {attribute.data_type === 'single_select' ? (
                  <label className="block space-y-2">
                    {label}
                    <select
                      disabled={!editable}
                      value={item.option_ids[0] ?? ''}
                      onChange={(event) =>
                        updateOptions(index, event.target.value ? [Number(event.target.value)] : [])
                      }
                      className={fieldClassName}
                    >
                      <option value="">Selecione</option>
                      {attribute.options.map((option) => (
                        <option key={option.id} value={option.id}>
                          {option.label}
                        </option>
                      ))}
                    </select>
                  </label>
                ) : null}

                {attribute.data_type === 'multi_select' ? (
                  <fieldset className="space-y-3">
                    <legend>{label}</legend>
                    <div className="grid gap-2 sm:grid-cols-2 lg:grid-cols-3">
                      {attribute.options.map((option) => (
                        <label
                          key={option.id}
                          className="flex items-center gap-2 rounded-xl border border-border p-3"
                        >
                          <input
                            type="checkbox"
                            disabled={!editable}
                            checked={item.option_ids.includes(option.id)}
                            onChange={() => toggleOption(index, option.id)}
                          />
                          <span>{option.label}</span>
                        </label>
                      ))}
                    </div>
                  </fieldset>
                ) : null}

                {attribute.description ? (
                  <p className="text-xs text-muted-foreground">{attribute.description}</p>
                ) : null}
              </div>
            )
          })}
        </div>
      )}

      {form.errors.attributes ? (
        <p className="text-sm text-destructive">{form.errors.attributes}</p>
      ) : null}

      {editable && attributes.length > 0 ? (
        <button
          type="submit"
          disabled={form.processing}
          className="rounded-xl bg-primary px-4 py-2 text-sm font-semibold text-primary-foreground disabled:opacity-60"
        >
          {form.processing ? 'Salvando…' : 'Salvar características'}
        </button>
      ) : null}
    </form>
  )
}
