import { router } from '@inertiajs/react'
import { Pencil, Plus, type LucideIcon } from 'lucide-react'
import { useEffect, useState } from 'react'

import { ResourceForm } from '~/components/backoffice/resource_form'
import { ConfirmDialog } from '~/components/confirm_dialog'
import { EmptyState } from '~/components/empty_state'
import { Button } from '~/components/ui/button'
import { numeric, type JsonRecord } from '~/lib/json'
import type { FieldSpec } from '~/lib/resource_form'
import { cn } from '~/lib/utils'

interface ResourceSectionProps {
  id: string
  title: string
  description: string
  icon: LucideIcon
  records: JsonRecord[]
  fields: FieldSpec[]
  /** The collection route; rows are updated at `${basePath}/${id}`. */
  basePath: string
  createLabel: string
  emptyLabel: string
  describe: (record: JsonRecord) => { name: string; meta: string }
  /** What deactivating does to discovery, said before it happens. */
  deactivateEffect: string
  canCreate: boolean
  canUpdate: boolean
}

/**
 * One administrative collection: list, create, edit in place, deactivate.
 *
 * There is no delete. The domain retires these records by deactivating them,
 * because published establishments and saved preferences still point at them,
 * and the screen offers exactly what the domain does. Deactivating asks first,
 * saying what leaves discovery (web audit W9); reactivating is immediate.
 */
export function ResourceSection({
  id,
  title,
  description,
  icon: Icon,
  records,
  fields,
  basePath,
  createLabel,
  emptyLabel,
  describe,
  deactivateEffect,
  canCreate,
  canUpdate,
}: ResourceSectionProps) {
  const [creating, setCreating] = useState(false)
  const [editing, setEditing] = useState<number | null>(null)
  // The inline form replaces the control that opened it; closing hands focus back to
  // that control instead of dropping it on the page.
  const [returnFocusTo, setReturnFocusTo] = useState<string | null>(null)

  useEffect(() => {
    if (returnFocusTo === null) return
    document.getElementById(returnFocusTo)?.focus()
    setReturnFocusTo(null)
  }, [returnFocusTo])

  const toggleActive = (recordId: number, active: boolean) =>
    router.put(`${basePath}/${recordId}`, { is_active: !active }, { preserveScroll: true })

  return (
    <section
      aria-labelledby={`${id}-heading`}
      className="rounded-card border border-border-subtle bg-card p-5 sm:p-6"
    >
      <div className="flex flex-wrap items-start justify-between gap-3">
        <div className="flex items-start gap-3">
          <span className="flex size-10 shrink-0 items-center justify-center rounded-full bg-primary-soft text-primary-accent">
            <Icon aria-hidden="true" className="size-4.5" />
          </span>
          <div>
            <h2
              id={`${id}-heading`}
              className="font-display text-xl font-extrabold tracking-[-0.01em]"
            >
              {title}
            </h2>
            <p className="mt-1 text-sm text-muted-foreground">{description}</p>
          </div>
        </div>
        {canCreate && !creating ? (
          <Button
            id={`${id}-create`}
            type="button"
            variant="outline"
            size="lg"
            shape="pill"
            onClick={() => setCreating(true)}
          >
            <Plus aria-hidden="true" className="size-4" />
            {createLabel}
          </Button>
        ) : null}
      </div>

      {creating ? (
        <div className="mt-5 rounded-xl border border-dashed border-border p-4">
          <ResourceForm
            idPrefix={`${id}-new`}
            fields={fields}
            method="post"
            url={basePath}
            submitLabel={createLabel}
            autoFocus
            onDone={() => {
              setCreating(false)
              setReturnFocusTo(`${id}-create`)
            }}
          />
        </div>
      ) : null}

      {records.length === 0 ? (
        <EmptyState
          headingLevel={3}
          title={emptyLabel}
          className="mt-5 rounded-card border border-dashed border-border"
        />
      ) : (
        <ul className="mt-5 divide-y divide-border" aria-label={title}>
          {records.map((record) => {
            const recordId = numeric(record, 'id')
            const active = record.is_active === true
            const { name, meta } = describe(record)

            return (
              <li key={recordId} className="py-3" data-testid={`${id}-row-${recordId}`}>
                <div className="flex flex-wrap items-center justify-between gap-3">
                  <div className="min-w-0">
                    <p className={cn('font-semibold', !active && 'text-muted-foreground')}>
                      {name}
                    </p>
                    <p className="text-xs text-muted-foreground">{meta}</p>
                  </div>
                  <div className="flex items-center gap-2">
                    <span
                      className={cn(
                        'rounded-full border px-2.5 py-1 text-xs font-semibold',
                        active
                          ? 'border-success/25 bg-success-soft text-success-accent'
                          : 'border-border bg-muted text-muted-foreground'
                      )}
                    >
                      {active ? 'Ativo' : 'Inativo'}
                    </span>
                    {canUpdate ? (
                      <>
                        <Button
                          id={`${id}-edit-${recordId}`}
                          type="button"
                          variant="outline"
                          size="md"
                          shape="pill"
                          aria-label={`Editar ${name}`}
                          aria-expanded={editing === recordId}
                          onClick={() => setEditing(editing === recordId ? null : recordId)}
                        >
                          <Pencil aria-hidden="true" className="size-4" />
                          Editar
                        </Button>
                        {active ? (
                          <ConfirmDialog
                            trigger={
                              <Button
                                type="button"
                                variant="dim"
                                size="md"
                                shape="pill"
                                aria-label={`Desativar ${name}`}
                              >
                                Desativar
                              </Button>
                            }
                            title={`Desativar ${name}?`}
                            description={deactivateEffect}
                            confirmLabel="Desativar"
                            destructive
                            onConfirm={() => toggleActive(recordId, active)}
                          />
                        ) : (
                          <Button
                            type="button"
                            variant="outline"
                            size="md"
                            shape="pill"
                            aria-label={`Ativar ${name}`}
                            onClick={() => toggleActive(recordId, active)}
                          >
                            Ativar
                          </Button>
                        )}
                      </>
                    ) : null}
                  </div>
                </div>

                {editing === recordId ? (
                  <div className="mt-3 rounded-xl border border-border-subtle p-4">
                    <ResourceForm
                      idPrefix={`${id}-${recordId}`}
                      fields={fields}
                      record={record}
                      method="put"
                      url={`${basePath}/${recordId}`}
                      submitLabel="Salvar alterações"
                      autoFocus
                      onDone={() => {
                        setEditing(null)
                        setReturnFocusTo(`${id}-edit-${recordId}`)
                      }}
                    />
                  </div>
                ) : null}
              </li>
            )
          })}
        </ul>
      )}
    </section>
  )
}
