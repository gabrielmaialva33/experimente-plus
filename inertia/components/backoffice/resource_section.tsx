import { router } from '@inertiajs/react'
import { Pencil, Plus, type LucideIcon } from 'lucide-react'
import { useState } from 'react'

import { ResourceForm } from '~/components/backoffice/resource_form'
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
  canCreate: boolean
  canUpdate: boolean
}

/**
 * One administrative collection: list, create, edit in place, deactivate.
 *
 * There is no delete. The domain retires these records by deactivating them,
 * because published establishments and saved preferences still point at them,
 * and the screen offers exactly what the domain does.
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
  canCreate,
  canUpdate,
}: ResourceSectionProps) {
  const [creating, setCreating] = useState(false)
  const [editing, setEditing] = useState<number | null>(null)

  const toggleActive = (recordId: number, active: boolean) =>
    router.put(`${basePath}/${recordId}`, { is_active: !active }, { preserveScroll: true })

  return (
    <section aria-labelledby={`${id}-heading`} className="rounded-lg border border-border bg-card p-5 sm:p-6">
      <div className="flex flex-wrap items-start justify-between gap-3">
        <div className="flex items-start gap-3">
          <span className="flex size-10 shrink-0 items-center justify-center rounded-md border border-primary/15 bg-primary-soft text-primary-accent">
            <Icon aria-hidden="true" className="size-4.5" />
          </span>
          <div>
            <h2 id={`${id}-heading`} className="text-xl font-bold">
              {title}
            </h2>
            <p className="mt-1 text-sm text-muted-foreground">{description}</p>
          </div>
        </div>
        {canCreate && !creating ? (
          <Button type="button" variant="outline" onClick={() => setCreating(true)}>
            <Plus aria-hidden="true" className="size-4" />
            {createLabel}
          </Button>
        ) : null}
      </div>

      {creating ? (
        <div className="mt-5 rounded-md border border-dashed border-border p-4">
          <ResourceForm
            idPrefix={`${id}-new`}
            fields={fields}
            method="post"
            url={basePath}
            submitLabel={createLabel}
            onDone={() => setCreating(false)}
          />
        </div>
      ) : null}

      {records.length === 0 ? (
        <EmptyState
          headingLevel={3}
          title={emptyLabel}
          className="mt-5 rounded-lg border border-dashed border-border"
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
                        'rounded-md border px-2 py-1 text-xs font-semibold',
                        active
                          ? 'border-success/25 bg-success/10 text-success'
                          : 'border-border bg-muted text-muted-foreground'
                      )}
                    >
                      {active ? 'Ativo' : 'Inativo'}
                    </span>
                    {canUpdate ? (
                      <>
                        <Button
                          type="button"
                          variant="outline"
                          size="sm"
                          aria-label={`Editar ${name}`}
                          onClick={() => setEditing(editing === recordId ? null : recordId)}
                        >
                          <Pencil aria-hidden="true" className="size-4" />
                          Editar
                        </Button>
                        <Button
                          type="button"
                          variant="outline"
                          size="sm"
                          aria-label={active ? `Desativar ${name}` : `Ativar ${name}`}
                          onClick={() => toggleActive(recordId, active)}
                        >
                          {active ? 'Desativar' : 'Ativar'}
                        </Button>
                      </>
                    ) : null}
                  </div>
                </div>

                {editing === recordId ? (
                  <div className="mt-3 rounded-md border border-border p-4">
                    <ResourceForm
                      idPrefix={`${id}-${recordId}`}
                      fields={fields}
                      record={record}
                      method="put"
                      url={`${basePath}/${recordId}`}
                      submitLabel="Salvar alterações"
                      onDone={() => setEditing(null)}
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
