import { Head, router } from '@inertiajs/react'
import {
  Ban,
  CircleCheck,
  Filter,
  KeyRound,
  Loader2,
  Mail,
  Plus,
  Search,
  UserRound,
  WalletCards,
  X,
} from 'lucide-react'
import { useMemo, useState, type FormEvent } from 'react'

import { PageHeader } from '~/components/page_header'
import {
  EditorField,
  editorSelectClassName,
} from '~/components/portal/establishment_editor/editor_field'
import { Button } from '~/components/ui/button'
import { Input } from '~/components/ui/input'
import { Textarea } from '~/components/ui/textarea'
import { MainLayout } from '~/layouts/main_layout'
import { cn } from '~/lib/utils'

interface AccessEdition {
  id: number
  name: string
  status: string
  usage_starts_at: string
  usage_ends_at: string
  city: {
    id: number
    name: string
    state_code: string
  }
}

interface BenefitAccess {
  id: number
  source: 'manual' | 'courtesy' | 'payment' | 'promo_code' | 'migration'
  status: 'active' | 'revoked'
  external_reference: string | null
  notes: string | null
  granted_at: string
  revoked_at: string | null
  revocation_reason: string | null
  holder: {
    id: number
    email: string
  }
  edition: AccessEdition
}

interface AccessesPageProps {
  accesses: BenefitAccess[]
  editions: AccessEdition[]
  errors?: Record<string, string>
}

const sourceLabels: Record<BenefitAccess['source'], string> = {
  manual: 'Concessão manual',
  courtesy: 'Cortesia',
  payment: 'Pagamento',
  promo_code: 'Código promocional',
  migration: 'Migração',
}

function formatDate(value: string): string {
  return new Intl.DateTimeFormat('pt-BR', {
    day: '2-digit',
    month: 'short',
    year: 'numeric',
    hour: '2-digit',
    minute: '2-digit',
    timeZone: 'America/Sao_Paulo',
  }).format(new Date(value))
}

function formatShortDate(value: string): string {
  return new Intl.DateTimeFormat('pt-BR', {
    day: '2-digit',
    month: 'short',
    year: 'numeric',
    timeZone: 'America/Sao_Paulo',
  }).format(new Date(value))
}

export default function BenefitAccessesPage({
  accesses,
  editions,
  errors = {},
}: AccessesPageProps) {
  const [editionId, setEditionId] = useState('')
  const [email, setEmail] = useState('')
  const [source, setSource] = useState<'manual' | 'courtesy'>('manual')
  const [notes, setNotes] = useState('')
  const [processing, setProcessing] = useState(false)
  const [localError, setLocalError] = useState<string | null>(null)
  const [query, setQuery] = useState('')
  const [statusFilter, setStatusFilter] = useState<'all' | 'active' | 'revoked'>('all')
  const [editionFilter, setEditionFilter] = useState('all')
  const [revokingId, setRevokingId] = useState<number | null>(null)
  const [revocationReason, setRevocationReason] = useState('')

  const filteredAccesses = useMemo(() => {
    const normalizedQuery = query.trim().toLowerCase()
    return accesses.filter((access) => {
      if (statusFilter !== 'all' && access.status !== statusFilter) return false
      if (editionFilter !== 'all' && access.edition.id !== Number(editionFilter)) return false
      if (!normalizedQuery) return true
      return (
        access.holder.email.toLowerCase().includes(normalizedQuery) ||
        access.edition.name.toLowerCase().includes(normalizedQuery) ||
        access.edition.city.name.toLowerCase().includes(normalizedQuery)
      )
    })
  }, [accesses, editionFilter, query, statusFilter])

  const activeCount = accesses.filter((access) => access.status === 'active').length
  const courtesyCount = accesses.filter(
    (access) => access.status === 'active' && access.source === 'courtesy'
  ).length

  function submit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault()
    setLocalError(null)

    if (!editionId || !email.trim()) {
      setLocalError('Selecione a edição e informe o e-mail do titular.')
      return
    }

    setProcessing(true)
    router.post(
      '/backoffice/accesses',
      {
        edition_id: Number(editionId),
        email: email.trim(),
        source,
        notes: notes.trim() || null,
      },
      {
        preserveScroll: true,
        onSuccess: () => {
          setEmail('')
          setNotes('')
          setLocalError(null)
        },
        onFinish: () => setProcessing(false),
      }
    )
  }

  function revoke(accessId: number) {
    setProcessing(true)
    router.post(
      `/backoffice/accesses/${accessId}/revoke`,
      { reason: revocationReason.trim() || null },
      {
        preserveScroll: true,
        onSuccess: () => {
          setRevokingId(null)
          setRevocationReason('')
        },
        onFinish: () => setProcessing(false),
      }
    )
  }

  return (
    <MainLayout>
      <Head title="Acessos às edições" />

      <div className="space-y-7">
        <PageHeader
          eyebrow="Operação comercial"
          icon={WalletCards}
          title="Acessos às edições"
          description="Conceda uma edição a usuários já cadastrados na operação. A carteira é liberada imediatamente e seus benefícios são derivados das ofertas ativas."
          meta={
            <>
              <span className="rounded-full border border-success/20 bg-success/10 px-3 py-1 text-xs font-semibold text-success">
                {activeCount} {activeCount === 1 ? 'acesso ativo' : 'acessos ativos'}
              </span>
              <span className="rounded-full border border-border bg-card px-3 py-1 text-xs font-semibold">
                {courtesyCount} {courtesyCount === 1 ? 'cortesia' : 'cortesias'}
              </span>
            </>
          }
        />

        <div className="grid gap-6 xl:grid-cols-[minmax(19rem,0.72fr)_minmax(0,1.28fr)] xl:items-start">
          <section className="rounded-3xl border border-border/70 bg-card p-5 shadow-xs sm:p-6 xl:sticky xl:top-6">
            <div className="flex items-start gap-4">
              <span className="flex size-11 shrink-0 items-center justify-center rounded-2xl bg-primary/10 text-primary">
                <KeyRound className="size-5" />
              </span>
              <div>
                <p className="text-xs font-semibold uppercase tracking-[0.14em] text-primary">
                  Nova concessão
                </p>
                <h2 className="mt-1 text-xl font-bold tracking-[-0.025em]">Liberar uma carteira</h2>
                <p className="mt-2 text-sm leading-6 text-muted-foreground">
                  O usuário precisa ter uma conta associada a esta operação. Reenvios ativos são
                  bloqueados automaticamente.
                </p>
              </div>
            </div>

            <form onSubmit={submit} className="mt-6 grid gap-4">
              <EditorField htmlFor="access-edition" label="Edição">
                <select
                  id="access-edition"
                  required
                  value={editionId}
                  onChange={(event) => setEditionId(event.target.value)}
                  className={editorSelectClassName}
                  disabled={processing || editions.length === 0}
                >
                  <option value="">Selecione uma edição</option>
                  {editions.map((edition) => (
                    <option key={edition.id} value={edition.id}>
                      {edition.name} — {edition.city.name}
                    </option>
                  ))}
                </select>
              </EditorField>

              <EditorField
                htmlFor="access-email"
                label="E-mail do titular"
                hint="Use o mesmo e-mail empregado no cadastro."
              >
                <div className="relative">
                  <Mail className="pointer-events-none absolute left-3 top-1/2 size-4 -translate-y-1/2 text-muted-foreground" />
                  <Input
                    id="access-email"
                    type="email"
                    required
                    autoComplete="email"
                    value={email}
                    onChange={(event) => setEmail(event.target.value)}
                    placeholder="cliente@exemplo.com"
                    className="pl-10"
                    disabled={processing}
                  />
                </div>
              </EditorField>

              <EditorField htmlFor="access-source" label="Origem">
                <select
                  id="access-source"
                  value={source}
                  onChange={(event) => setSource(event.target.value as 'manual' | 'courtesy')}
                  className={editorSelectClassName}
                  disabled={processing}
                >
                  <option value="manual">Concessão manual</option>
                  <option value="courtesy">Cortesia</option>
                </select>
              </EditorField>

              <EditorField
                htmlFor="access-notes"
                label="Observação interna"
                hint="Opcional e invisível para o consumidor."
              >
                <Textarea
                  id="access-notes"
                  rows={3}
                  value={notes}
                  onChange={(event) => setNotes(event.target.value)}
                  placeholder="Ex.: cortesia do evento de lançamento."
                  disabled={processing}
                />
              </EditorField>

              {localError ? (
                <p
                  role="alert"
                  className="rounded-xl bg-destructive/10 px-3 py-2 text-sm text-destructive"
                >
                  {localError}
                </p>
              ) : null}
              {Object.keys(errors).length > 0 ? (
                <p
                  role="alert"
                  className="rounded-xl bg-destructive/10 px-3 py-2 text-sm text-destructive"
                >
                  Não foi possível conceder o acesso. Confira o usuário, a edição e os campos.
                </p>
              ) : null}

              <Button
                type="submit"
                size="lg"
                className="min-h-11 w-full"
                disabled={processing || editions.length === 0}
              >
                {processing ? <Loader2 className="animate-spin" /> : <Plus />}
                {processing ? 'Concedendo…' : 'Conceder acesso'}
              </Button>

              {editions.length === 0 ? (
                <p className="rounded-xl border border-dashed border-border bg-muted/40 px-3 py-3 text-sm leading-6 text-muted-foreground">
                  Publique uma edição antes de liberar acessos.
                </p>
              ) : null}
            </form>
          </section>

          <section className="space-y-4" aria-label="Histórico de acessos">
            <div className="rounded-2xl border border-border/70 bg-card p-4 shadow-xs">
              <div className="grid gap-3 md:grid-cols-[minmax(0,1fr)_12rem_13rem]">
                <label className="relative block">
                  <span className="sr-only">Buscar acessos</span>
                  <Search className="pointer-events-none absolute left-3 top-1/2 size-4 -translate-y-1/2 text-muted-foreground" />
                  <Input
                    value={query}
                    onChange={(event) => setQuery(event.target.value)}
                    placeholder="Buscar por e-mail, edição ou cidade"
                    className="min-h-11 pl-10"
                  />
                </label>
                <label className="relative block">
                  <span className="sr-only">Filtrar por estado</span>
                  <Filter className="pointer-events-none absolute left-3 top-1/2 size-4 -translate-y-1/2 text-muted-foreground" />
                  <select
                    value={statusFilter}
                    onChange={(event) =>
                      setStatusFilter(event.target.value as 'all' | 'active' | 'revoked')
                    }
                    className={cn(editorSelectClassName, 'min-h-11 pl-10')}
                  >
                    <option value="all">Todos os estados</option>
                    <option value="active">Ativos</option>
                    <option value="revoked">Revogados</option>
                  </select>
                </label>
                <select
                  value={editionFilter}
                  onChange={(event) => setEditionFilter(event.target.value)}
                  className={cn(editorSelectClassName, 'min-h-11')}
                  aria-label="Filtrar por edição"
                >
                  <option value="all">Todas as edições</option>
                  {Array.from(
                    new Map(accesses.map((access) => [access.edition.id, access.edition])).values()
                  ).map((edition) => (
                    <option key={edition.id} value={edition.id}>
                      {edition.name}
                    </option>
                  ))}
                </select>
              </div>
            </div>

            {filteredAccesses.length === 0 ? (
              <div className="rounded-3xl border border-dashed border-border bg-card px-6 py-14 text-center shadow-xs">
                <span className="mx-auto flex size-14 items-center justify-center rounded-2xl bg-primary/10 text-primary">
                  <UserRound className="size-6" />
                </span>
                <h2 className="mt-5 text-lg font-bold">Nenhum acesso encontrado</h2>
                <p className="mx-auto mt-2 max-w-md text-sm leading-6 text-muted-foreground">
                  Ajuste os filtros ou use o formulário para conceder a primeira edição a um
                  consumidor.
                </p>
              </div>
            ) : (
              <div className="grid gap-4 md:grid-cols-2 2xl:grid-cols-3">
                {filteredAccesses.map((access) => {
                  const isActive = access.status === 'active'
                  const isRevoking = revokingId === access.id

                  return (
                    <article
                      key={access.id}
                      className={cn(
                        'flex min-h-full flex-col rounded-3xl border border-border/70 bg-card p-5 shadow-xs sm:p-6',
                        !isActive && 'opacity-75'
                      )}
                    >
                      <div className="flex items-start justify-between gap-3">
                        <span
                          className={cn(
                            'flex size-10 shrink-0 items-center justify-center rounded-2xl',
                            isActive
                              ? 'bg-success/10 text-success'
                              : 'bg-muted text-muted-foreground'
                          )}
                        >
                          {isActive ? (
                            <CircleCheck className="size-5" />
                          ) : (
                            <Ban className="size-5" />
                          )}
                        </span>
                        <span
                          className={cn(
                            'rounded-full border px-2.5 py-1 text-[0.7rem] font-semibold',
                            isActive
                              ? 'border-success/25 bg-success/10 text-success'
                              : 'border-border bg-muted text-muted-foreground'
                          )}
                        >
                          {isActive ? 'Ativo' : 'Revogado'}
                        </span>
                      </div>

                      <p className="mt-4 break-all text-sm font-semibold">{access.holder.email}</p>
                      <h2 className="mt-2 text-lg font-bold tracking-[-0.02em]">
                        {access.edition.name}
                      </h2>
                      <p className="mt-1 text-sm text-muted-foreground">
                        {access.edition.city.name} · {access.edition.city.state_code}
                      </p>

                      <dl className="mt-5 grid gap-3 rounded-2xl bg-muted/45 p-4 text-sm">
                        <div className="flex items-start justify-between gap-4">
                          <dt className="text-muted-foreground">Origem</dt>
                          <dd className="text-right font-semibold">
                            {sourceLabels[access.source]}
                          </dd>
                        </div>
                        <div className="flex items-start justify-between gap-4">
                          <dt className="text-muted-foreground">Concedido em</dt>
                          <dd className="text-right font-semibold">
                            {formatDate(access.granted_at)}
                          </dd>
                        </div>
                        <div className="flex items-start justify-between gap-4">
                          <dt className="text-muted-foreground">Válido até</dt>
                          <dd className="text-right font-semibold">
                            {formatShortDate(access.edition.usage_ends_at)}
                          </dd>
                        </div>
                      </dl>

                      {access.notes ? (
                        <p className="mt-4 rounded-2xl border border-border/70 p-3 text-sm leading-6">
                          {access.notes}
                        </p>
                      ) : null}

                      {!isActive && access.revocation_reason ? (
                        <p className="mt-4 text-sm leading-6 text-muted-foreground">
                          <strong className="text-foreground">Motivo:</strong>{' '}
                          {access.revocation_reason}
                        </p>
                      ) : null}

                      {isActive ? (
                        <div className="mt-auto pt-5">
                          {isRevoking ? (
                            <div className="space-y-3 rounded-2xl border border-destructive/25 bg-destructive/5 p-4">
                              <div className="flex items-start justify-between gap-3">
                                <div>
                                  <p className="text-sm font-semibold">Confirmar revogação</p>
                                  <p className="mt-1 text-xs leading-5 text-muted-foreground">
                                    A carteira deixa de disponibilizar esta edição imediatamente.
                                  </p>
                                </div>
                                <Button
                                  type="button"
                                  variant="ghost"
                                  size="icon"
                                  onClick={() => {
                                    setRevokingId(null)
                                    setRevocationReason('')
                                  }}
                                >
                                  <X />
                                </Button>
                              </div>
                              <Textarea
                                rows={2}
                                value={revocationReason}
                                onChange={(event) => setRevocationReason(event.target.value)}
                                placeholder="Motivo opcional"
                              />
                              <Button
                                type="button"
                                variant="destructive"
                                className="min-h-10 w-full"
                                onClick={() => revoke(access.id)}
                                disabled={processing}
                              >
                                {processing ? <Loader2 className="animate-spin" /> : <Ban />}
                                Revogar acesso
                              </Button>
                            </div>
                          ) : (
                            <Button
                              type="button"
                              variant="outline"
                              className="min-h-10 w-full"
                              onClick={() => setRevokingId(access.id)}
                            >
                              <Ban />
                              Revogar
                            </Button>
                          )}
                        </div>
                      ) : null}
                    </article>
                  )
                })}
              </div>
            )}
          </section>
        </div>
      </div>
    </MainLayout>
  )
}
