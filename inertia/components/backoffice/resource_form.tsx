import { useForm } from '@inertiajs/react'
import { ChevronDown, Loader2, Save } from 'lucide-react'
import type { FormEvent } from 'react'

import {
  EditorField,
  editorSelectClassName,
} from '~/components/portal/establishment_editor/editor_field'
import { Button } from '~/components/ui/button'
import { Input } from '~/components/ui/input'
import { Textarea } from '~/components/ui/textarea'
import { useUnsavedChangesGuard } from '~/hooks/use_unsaved_changes_guard'
import { initialValues, toPayload, type FieldSpec, type FormValues } from '~/lib/resource_form'

interface ResourceFormProps {
  idPrefix: string
  fields: FieldSpec[]
  record?: Record<string, unknown> | null
  method: 'post' | 'put'
  url: string
  submitLabel: string
  onDone?: () => void
}

/**
 * Create or edit one administrative record through its web route.
 *
 * Validation stays on the server: its errors come back per field and are shown
 * next to the control that caused them, so the screen never holds a second copy
 * of the rules.
 *
 * Every backoffice form asks before a visit would throw away what was typed
 * (audit W68/W69), the same guard the partner editor uses. Its own save is let
 * through, and a saved form counts as clean again.
 */
export function ResourceForm({
  idPrefix,
  fields,
  record,
  method,
  url,
  submitLabel,
  onDone,
}: ResourceFormProps) {
  const form = useForm<FormValues>(initialValues(fields, record))
  const { allowNextVisit } = useUnsavedChangesGuard({
    enabled: () => form.isDirty === true && !form.processing,
  })

  function submit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault()
    form.transform((data) => toPayload(fields, data))
    allowNextVisit()
    form[method](url, {
      preserveScroll: true,
      onSuccess: () => {
        if (method === 'post') form.reset()
        else form.setDefaults?.()
        onDone?.()
      },
    })
  }

  function renderField(field: FieldSpec) {
    const id = `${idPrefix}-${field.name}`
    const error = (form.errors as Record<string, string | undefined>)[field.name] ?? null

    if (field.type === 'checkbox') {
      return (
        <label
          key={field.name}
          htmlFor={id}
          className="flex min-h-12 items-center justify-between gap-3 rounded-xl border border-border-subtle bg-card px-4 py-3 md:col-span-1"
        >
          <span className="text-sm font-medium">{field.label}</span>
          <input
            id={id}
            type="checkbox"
            checked={form.data[field.name] === true}
            disabled={form.processing}
            onChange={(event) => form.setData(field.name, event.target.checked)}
            className="size-4 accent-primary"
          />
        </label>
      )
    }

    const value = String(form.data[field.name] ?? '')
    const onChange = (next: string) => form.setData(field.name, next)

    return (
      <EditorField
        key={field.name}
        htmlFor={id}
        label={field.label}
        hint={field.hint}
        error={error}
        required={field.required}
        className={field.type === 'textarea' ? 'md:col-span-2' : undefined}
      >
        {field.type === 'textarea' ? (
          <Textarea
            id={id}
            rows={2}
            value={value}
            disabled={form.processing}
            onChange={(event) => onChange(event.target.value)}
            className="resize-y"
          />
        ) : field.type === 'select' ? (
          <select
            id={id}
            value={value}
            disabled={form.processing}
            onChange={(event) => onChange(event.target.value)}
            className={editorSelectClassName}
          >
            {field.required ? null : <option value="">—</option>}
            {(field.options ?? []).map((option) => (
              <option key={option.value} value={option.value}>
                {option.label}
              </option>
            ))}
          </select>
        ) : (
          <Input
            id={id}
            type={field.type === 'number' ? 'number' : 'text'}
            step={field.step}
            value={value}
            disabled={form.processing}
            onChange={(event) => onChange(event.target.value)}
          />
        )}
      </EditorField>
    )
  }

  const basicFields = fields.filter((field) => !field.advanced)
  const advancedFields = fields.filter((field) => field.advanced)
  const errors = form.errors as Record<string, string | undefined>
  const advancedHasError = advancedFields.some((field) => Boolean(errors[field.name]))

  return (
    <form onSubmit={submit} className="grid gap-4" aria-label={submitLabel}>
      <div className="grid gap-4 md:grid-cols-2">{basicFields.map(renderField)}</div>

      {advancedFields.length > 0 ? (
        <details open={advancedHasError || undefined} className="group rounded-xl bg-muted/50">
          <summary className="flex min-h-11 cursor-pointer list-none items-center justify-between gap-3 rounded-xl px-4 text-sm font-semibold focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring [&::-webkit-details-marker]:hidden">
            <span>
              Avançado
              <span className="ms-2 font-normal text-muted-foreground">
                {advancedFields.map((field) => field.label).join(', ')}
              </span>
            </span>
            <ChevronDown
              aria-hidden="true"
              className="size-4 shrink-0 text-muted-foreground transition-transform group-open:rotate-180"
            />
          </summary>
          <div className="grid gap-4 px-4 pb-4 md:grid-cols-2">
            {advancedFields.map(renderField)}
          </div>
        </details>
      ) : null}

      <div className="flex flex-wrap justify-end gap-2">
        {onDone ? (
          <Button
            type="button"
            variant="ghost"
            size="xl"
            shape="pill"
            onClick={onDone}
            disabled={form.processing}
          >
            Cancelar
          </Button>
        ) : null}
        <Button type="submit" variant="primary" size="xl" shape="pill" disabled={form.processing}>
          {form.processing ? (
            <Loader2 aria-hidden="true" className="size-4 animate-spin" />
          ) : (
            <Save aria-hidden="true" className="size-4" />
          )}
          {form.processing ? 'Salvando…' : submitLabel}
        </Button>
      </div>
    </form>
  )
}
