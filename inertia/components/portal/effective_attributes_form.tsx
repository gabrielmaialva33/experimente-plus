import { useForm } from '@inertiajs/react'
import { SlidersHorizontal } from 'lucide-react'
import type { FormEvent } from 'react'
import { useEffect, useMemo } from 'react'

import {
  EditorSaveBar,
  EditorSection,
  type EditorDisplayIssue,
} from '~/components/portal/editor_section'
import { Badge } from '~/components/ui/badge'
import { Input } from '~/components/ui/input'
import { Progress } from '~/components/ui/progress'
import { Textarea } from '~/components/ui/textarea'
import { EditorDependencyNotice } from '~/components/portal/establishment_editor/dependency_notice'
import { editorSelectClassName } from '~/components/portal/establishment_editor/editor_field'
import type { EditorFormStateChange } from '~/components/portal/establishment_editor/types'
import { hasAttributeInputValue } from '~/lib/establishment_editor'
import { firstError } from '~/lib/form_errors'
import { cn } from '~/lib/utils'

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
  busy?: boolean
  categoriesDirty?: boolean
  issues?: EditorDisplayIssue[]
  onStateChange?: EditorFormStateChange
  onBeforeSubmit?: () => boolean
  onSubmitFinish?: () => void
  onReviewCategories?: () => void
}

export default function EffectiveAttributesForm({
  establishmentId,
  attributes,
  editable,
  busy = false,
  categoriesDirty = false,
  issues = [],
  onStateChange,
  onBeforeSubmit,
  onSubmitFinish,
  onReviewCategories,
}: EffectiveAttributesFormProps) {
  const form = useForm<AttributeFormData>({
    attributes: attributes.map((attribute) => ({
      attribute_definition_id: attribute.id,
      value: attribute.value,
      option_ids: attribute.option_ids,
    })),
  })

  useEffect(() => {
    onStateChange?.({ dirty: form.isDirty, processing: form.processing })
  }, [form.isDirty, form.processing, onStateChange])

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
    if (categoriesDirty) {
      onReviewCategories?.()
      return
    }
    if (busy && !form.processing) return
    if (onBeforeSubmit && !onBeforeSubmit()) return

    form.put(`/portal/establishments/${establishmentId}/attributes`, {
      preserveScroll: true,
      onSuccess: () => form.setDefaults(),
      onFinish: onSubmitFinish,
    })
  }

  const controlsDisabled = !editable || busy || categoriesDirty
  const formItemsById = useMemo(
    () =>
      new Map(form.data.attributes.map((item) => [item.attribute_definition_id, item] as const)),
    [form.data.attributes]
  )
  const requiredAttributes = attributes.filter((attribute) => attribute.is_required)
  const completedRequired = requiredAttributes.filter((attribute) => {
    const item = formItemsById.get(attribute.id)
    return item ? hasAttributeInputValue(item.value, item.option_ids) : false
  }).length
  const requiredProgress =
    requiredAttributes.length === 0
      ? 100
      : Math.round((completedRequired / requiredAttributes.length) * 100)
  const error = firstError(form.errors)

  return (
    <EditorSection
      id="attributes"
      icon={SlidersHorizontal}
      title="Características da categoria"
      description="Os campos são resolvidos pelo servidor a partir da categoria principal, incluindo herança, tipo, opções e obrigatoriedade."
      issues={issues}
      toolbar={
        attributes.length > 0 ? (
          <Badge variant="secondary" appearance="light" size="sm">
            {attributes.length} {attributes.length === 1 ? 'campo' : 'campos'}
          </Badge>
        ) : null
      }
    >
      <form onSubmit={submit} aria-busy={form.processing}>
        <div className="space-y-6 p-5 sm:p-6">
          {categoriesDirty ? (
            <EditorDependencyNotice
              title="Salve as categorias para recalcular as características"
              description="Os campos abaixo ainda representam a categoria principal salva no servidor. Salve a seleção atual antes de continuar."
              actionLabel="Ir para categorias"
              onAction={() => onReviewCategories?.()}
            />
          ) : null}

          {requiredAttributes.length > 0 ? (
            <div className="rounded-xl border border-border/70 bg-muted/25 p-4">
              <div className="flex items-center justify-between gap-4 text-sm">
                <div>
                  <p className="font-medium">Campos obrigatórios</p>
                  <p className="mt-0.5 text-xs text-muted-foreground">
                    {completedRequired} de {requiredAttributes.length} preenchidos
                  </p>
                </div>
                <span className="font-semibold tabular-nums text-primary">{requiredProgress}%</span>
              </div>
              <Progress value={requiredProgress} className="mt-3" />
            </div>
          ) : null}

          {attributes.length === 0 ? (
            <div className="rounded-xl border border-dashed border-border bg-muted/30 px-5 py-8 text-center">
              <p className="text-sm font-medium">Nenhuma característica configurada</p>
              <p className="mx-auto mt-1 max-w-lg text-sm leading-6 text-muted-foreground">
                Selecione e salve uma categoria principal. Quando ela possuir características
                específicas, os campos aparecerão aqui automaticamente.
              </p>
            </div>
          ) : (
            <div className="grid gap-5 lg:grid-cols-2">
              {attributes.map((attribute, index) => {
                const item = form.data.attributes[index]
                const wide =
                  attribute.data_type === 'long_text' || attribute.data_type === 'multi_select'
                const descriptionId = attribute.description
                  ? `attribute-${attribute.id}-description`
                  : undefined
                const attributeErrors = form.errors as Record<string, unknown>
                const fieldError =
                  firstError(attributeErrors[`attributes.${index}.value`]) ??
                  firstError(attributeErrors[`attributes.${index}.option_ids`]) ??
                  firstError(attributeErrors[`attributes.${index}.attribute_definition_id`])
                const errorId = fieldError ? `attribute-${attribute.id}-error` : undefined
                const describedBy = [descriptionId, errorId].filter(Boolean).join(' ') || undefined
                const inputAccessibility = {
                  'aria-describedby': describedBy,
                  'aria-invalid': fieldError ? (true as const) : undefined,
                  'aria-required': attribute.is_required || undefined,
                }

                return (
                  <div
                    key={attribute.id}
                    className={cn(
                      'space-y-2 rounded-xl border border-border/70 bg-background p-4',
                      wide && 'lg:col-span-2'
                    )}
                  >
                    <div className="flex flex-wrap items-center gap-2">
                      <label
                        htmlFor={`attribute-${attribute.id}`}
                        className="text-sm font-semibold"
                      >
                        {attribute.name}
                      </label>
                      {attribute.is_required ? (
                        <Badge variant="destructive" appearance="light" size="xs">
                          Obrigatório
                        </Badge>
                      ) : (
                        <Badge variant="secondary" appearance="light" size="xs">
                          Opcional
                        </Badge>
                      )}
                      <Badge variant="outline" size="xs">
                        {attribute.inherited ? 'Herdado' : 'Categoria principal'}
                      </Badge>
                    </div>

                    {attribute.description ? (
                      <p id={descriptionId} className="text-xs leading-5 text-muted-foreground">
                        {attribute.description}
                      </p>
                    ) : null}

                    {attribute.data_type === 'boolean' ? (
                      <select
                        id={`attribute-${attribute.id}`}
                        disabled={controlsDisabled}
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
                        className={editorSelectClassName}
                        {...inputAccessibility}
                      >
                        <option value="">Não informado</option>
                        <option value="true">Sim</option>
                        <option value="false">Não</option>
                      </select>
                    ) : null}

                    {attribute.data_type === 'text' || attribute.data_type === 'url' ? (
                      <Input
                        id={`attribute-${attribute.id}`}
                        variant="lg"
                        type={attribute.data_type === 'url' ? 'url' : 'text'}
                        disabled={controlsDisabled}
                        value={typeof item.value === 'string' ? item.value : ''}
                        onChange={(event) => updateValue(index, event.target.value)}
                        placeholder={
                          attribute.data_type === 'url'
                            ? 'https://exemplo.com.br'
                            : `Informe ${attribute.name.toLocaleLowerCase('pt-BR')}`
                        }
                        {...inputAccessibility}
                      />
                    ) : null}

                    {attribute.data_type === 'long_text' ? (
                      <Textarea
                        id={`attribute-${attribute.id}`}
                        variant="lg"
                        rows={4}
                        disabled={controlsDisabled}
                        value={typeof item.value === 'string' ? item.value : ''}
                        onChange={(event) => updateValue(index, event.target.value)}
                        className="resize-y"
                        {...inputAccessibility}
                      />
                    ) : null}

                    {attribute.data_type === 'integer' || attribute.data_type === 'decimal' ? (
                      <div className="flex items-center gap-2">
                        <Input
                          id={`attribute-${attribute.id}`}
                          variant="lg"
                          type="number"
                          step={attribute.data_type === 'integer' ? '1' : 'any'}
                          disabled={controlsDisabled}
                          value={typeof item.value === 'number' ? item.value : ''}
                          onChange={(event) =>
                            updateValue(
                              index,
                              event.target.value === '' ? null : Number(event.target.value)
                            )
                          }
                          {...inputAccessibility}
                        />
                        {attribute.unit ? (
                          <span className="shrink-0 rounded-md border border-border bg-muted px-3 py-2 text-sm font-medium text-muted-foreground">
                            {attribute.unit}
                          </span>
                        ) : null}
                      </div>
                    ) : null}

                    {attribute.data_type === 'single_select' ? (
                      <select
                        id={`attribute-${attribute.id}`}
                        disabled={controlsDisabled}
                        value={item.option_ids[0] ?? ''}
                        onChange={(event) =>
                          updateOptions(
                            index,
                            event.target.value ? [Number(event.target.value)] : []
                          )
                        }
                        className={editorSelectClassName}
                        {...inputAccessibility}
                      >
                        <option value="">Selecione uma opção</option>
                        {attribute.options.map((option) => (
                          <option key={option.id} value={option.id}>
                            {option.label}
                          </option>
                        ))}
                      </select>
                    ) : null}

                    {attribute.data_type === 'multi_select' ? (
                      <fieldset
                        className="space-y-3"
                        aria-describedby={describedBy}
                        aria-invalid={fieldError ? true : undefined}
                        aria-required={attribute.is_required || undefined}
                      >
                        <legend className="sr-only">{attribute.name}</legend>
                        <div className="grid gap-2 sm:grid-cols-2 lg:grid-cols-3">
                          {attribute.options.map((option) => {
                            const checked = item.option_ids.includes(option.id)
                            return (
                              <label
                                key={option.id}
                                className={cn(
                                  'flex cursor-pointer items-center gap-3 rounded-lg border p-3 text-sm transition-colors',
                                  checked
                                    ? 'border-primary/30 bg-primary/5 text-foreground'
                                    : 'border-border hover:bg-muted/50',
                                  controlsDisabled && 'cursor-not-allowed opacity-60'
                                )}
                              >
                                <input
                                  type="checkbox"
                                  disabled={controlsDisabled}
                                  checked={checked}
                                  onChange={() => toggleOption(index, option.id)}
                                  className="size-4 rounded border-input accent-primary"
                                  aria-describedby={describedBy}
                                />
                                <span>{option.label}</span>
                              </label>
                            )
                          })}
                        </div>
                      </fieldset>
                    ) : null}

                    {fieldError ? (
                      <p id={errorId} role="alert" className="text-xs text-destructive">
                        {fieldError}
                      </p>
                    ) : null}
                  </div>
                )
              })}
            </div>
          )}

          {error ? (
            <p
              role="alert"
              className="rounded-lg border border-destructive/20 bg-destructive/10 px-3 py-2 text-sm text-destructive"
            >
              {error}
            </p>
          ) : null}
        </div>

        {editable && attributes.length > 0 ? (
          <EditorSaveBar
            processing={form.processing}
            recentlySuccessful={form.recentlySuccessful}
            dirty={form.isDirty}
            disabled={categoriesDirty || (busy && !form.processing)}
            label="Salvar características"
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
