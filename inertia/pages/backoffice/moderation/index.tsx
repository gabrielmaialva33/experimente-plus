import { Head, Link } from '@inertiajs/react'
import { ArrowRight, ClipboardCheck } from 'lucide-react'

import { MainLayout } from '~/layouts/main_layout'

type JsonRecord = Record<string, unknown>

interface ModerationIndexProps {
  revisions: unknown
  filters: JsonRecord
}

function record(value: unknown): JsonRecord | null {
  return value && typeof value === 'object' && !Array.isArray(value) ? (value as JsonRecord) : null
}

function collection(value: unknown): JsonRecord[] {
  if (Array.isArray(value)) return value.filter((item): item is JsonRecord => record(item) !== null)
  const source = record(value)
  const data = source?.data
  return Array.isArray(data) ? data.filter((item): item is JsonRecord => record(item) !== null) : []
}

function text(source: JsonRecord | null, key: string, fallback = ''): string {
  const value = source?.[key]
  return typeof value === 'string' ? value : fallback
}

function number(source: JsonRecord | null, key: string): number {
  const value = source?.[key]
  return typeof value === 'number' ? value : Number(value ?? 0)
}

export default function ModerationQueuePage({ revisions }: ModerationIndexProps) {
  const items = collection(revisions)
  const meta = record(record(revisions)?.meta)

  return (
    <MainLayout>
      <Head title="Fila de moderação" />

      <div className="space-y-7">
        <header>
          <p className="text-sm font-semibold text-primary">Backoffice</p>
          <h1 className="mt-1 text-3xl font-bold tracking-tight">Fila de moderação</h1>
          <p className="mt-2 max-w-2xl text-muted-foreground">
            Revisões submetidas permanecem congeladas até uma decisão auditável.
          </p>
        </header>

        <section className="rounded-2xl border border-border bg-card p-5">
          <div className="flex items-center gap-3">
            <ClipboardCheck className="size-5 text-primary" />
            <div>
              <p className="font-semibold">
                {number(meta, 'total') || items.length} revisões pendentes
              </p>
              <p className="text-sm text-muted-foreground">
                Ordem da submissão mais antiga para a mais recente.
              </p>
            </div>
          </div>
        </section>

        {items.length === 0 ? (
          <div className="rounded-3xl border border-dashed border-border bg-card p-10 text-center">
            <ClipboardCheck className="mx-auto size-10 text-muted-foreground" />
            <h2 className="mt-4 text-lg font-semibold">Fila vazia</h2>
            <p className="mt-2 text-sm text-muted-foreground">
              Não existem revisões aguardando decisão nesta operação.
            </p>
          </div>
        ) : (
          <div className="space-y-3">
            {items.map((item) => {
              const establishment = record(item.establishment)
              const organization = record(establishment?.organization)
              const city = record(item.city)
              const id = number(item, 'id')

              return (
                <Link
                  key={id}
                  href={`/backoffice/moderation/${id}`}
                  className="flex flex-col gap-4 rounded-2xl border border-border bg-card p-5 transition hover:border-primary/50 sm:flex-row sm:items-center sm:justify-between"
                >
                  <div>
                    <div className="flex flex-wrap items-center gap-2">
                      <h2 className="font-semibold">
                        {text(item, 'public_name', 'Unidade sem nome')}
                      </h2>
                      <span className="rounded-full bg-muted px-2.5 py-1 text-xs font-medium">
                        versão {number(item, 'version')}
                      </span>
                    </div>
                    <p className="mt-1 text-sm text-muted-foreground">
                      {text(organization, 'trade_name', 'Organização')} ·{' '}
                      {text(city, 'name', 'Cidade')}
                    </p>
                    <p className="mt-1 text-xs text-muted-foreground">
                      Submetida em {text(item, 'submitted_at', 'data indisponível')}
                    </p>
                  </div>
                  <span className="inline-flex items-center gap-2 text-sm font-semibold text-primary">
                    Revisar <ArrowRight className="size-4" />
                  </span>
                </Link>
              )
            })}
          </div>
        )}
      </div>
    </MainLayout>
  )
}
