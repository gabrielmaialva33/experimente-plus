import { Head, Link, router, usePage } from '@inertiajs/react'
import {
  ArrowLeft,
  CheckCircle2,
  Loader2,
  LockKeyhole,
  ScanLine,
  Store,
  UserRound,
} from 'lucide-react'
import { useState, type FormEvent } from 'react'

import { ConfirmDialog } from '~/components/confirm_dialog'
import { EmptyState } from '~/components/empty_state'
import { PageHeader } from '~/components/page_header'
import { Alert, AlertDescription, AlertTitle } from '~/components/ui/alert'
import { Button } from '~/components/ui/button'
import { Input } from '~/components/ui/input'
import { MainLayout } from '~/layouts/main_layout'
import { firstError } from '~/lib/form_errors'
import type { OrganizationAllowedActions } from '~/types'
import type { RedemptionPreview } from '~/types/benefit_redemption'

interface PartnerValidationPageProps {
  token: string
  preview: RedemptionPreview | null
  allowed_actions: OrganizationAllowedActions
}

function extractToken(input: string): string {
  const value = input.trim()
  if (!value) return ''

  try {
    const url = new URL(value)
    const queryToken = url.searchParams.get('token')
    if (queryToken) return queryToken

    const fragment = new URLSearchParams(url.hash.replace(/^#/, ''))
    return fragment.get('token') ?? value
  } catch {
    return value
  }
}

export default function PartnerValidationPage({
  token,
  preview,
  allowed_actions: allowedActions,
}: PartnerValidationPageProps) {
  const { errors } = usePage().props as { errors?: Record<string, unknown> }
  const canValidate = allowedActions.redemptions.validate
  const presentationError = firstError(errors?.presentation)
  const [input, setInput] = useState(token)
  const [inspecting, setInspecting] = useState(false)
  const [processing, setProcessing] = useState(false)

  function inspect(event: FormEvent<HTMLFormElement>) {
    event.preventDefault()
    const normalized = extractToken(input)
    if (!normalized) return

    setInspecting(true)
    router.get(
      '/portal/redemptions/validate',
      { token: normalized },
      {
        preserveState: false,
        onFinish: () => setInspecting(false),
      }
    )
  }

  function confirm() {
    if (!preview) return

    setProcessing(true)
    router.post(
      '/portal/redemptions',
      { token: preview.token },
      { onFinish: () => setProcessing(false) }
    )
  }

  return (
    <MainLayout>
      <Head title="Validar benefício" />

      <div className="space-y-6">
        <PageHeader
          title="Validar benefício"
          description="Cole o link que o cliente mostrar no app, ou o link lido do QR Code. O uso só é registrado quando você confirmar."
          actions={
            <Button asChild variant="ghost" size="lg" shape="pill">
              <Link href="/portal/redemptions">
                <ArrowLeft />
                Utilizações
              </Link>
            </Button>
          }
        />

        {presentationError ? (
          <Alert variant="destructive" appearance="light" role="alert">
            <AlertTitle>Apresentação indisponível</AlertTitle>
            <AlertDescription>{presentationError}</AlertDescription>
          </Alert>
        ) : null}

        {canValidate ? (
          <form
            onSubmit={inspect}
            className="rounded-card border border-border-subtle bg-card p-5 sm:p-6"
            aria-busy={inspecting}
          >
            <label htmlFor="presentation-token" className="text-sm font-bold">
              Link da apresentação
            </label>
            <div className="mt-2 flex flex-col gap-3 sm:flex-row">
              <Input
                id="presentation-token"
                value={input}
                onChange={(event) => setInput(event.target.value)}
                autoComplete="off"
                spellCheck={false}
                placeholder="https://… ou o código do cliente"
                className="h-12 rounded-full px-5 sm:flex-1"
                disabled={inspecting}
              />
              <Button
                type="submit"
                variant={preview ? 'outline' : 'primary'}
                size="xl"
                shape="pill"
                disabled={!input.trim() || inspecting}
                aria-busy={inspecting}
              >
                {inspecting ? <Loader2 className="animate-spin" /> : <ScanLine />}
                {inspecting ? 'Conferindo…' : preview ? 'Conferir outro' : 'Conferir'}
              </Button>
            </div>
          </form>
        ) : (
          <EmptyState
            className="rounded-card border border-dashed border-border bg-card"
            headingLevel={2}
            icon={LockKeyhole}
            title="Validação indisponível"
            description="Seu acesso permite consultar utilizações, mas não confirmá-las."
          />
        )}

        {canValidate && preview ? (
          <section
            aria-label="Benefício apresentado"
            className="grid gap-5 lg:grid-cols-[minmax(0,1fr)_20rem] lg:items-start"
          >
            <article className="overflow-hidden rounded-card border border-border-subtle bg-card sm:flex">
              <div className="bg-chrome p-5 text-chrome-foreground sm:w-60 sm:shrink-0 sm:p-6">
                <p className="text-xs font-bold uppercase tracking-[0.14em] opacity-80">
                  Benefício
                </p>
                <h2 className="mt-2 font-display text-2xl font-extrabold leading-tight tracking-[-0.02em]">
                  {preview.benefit.offer_title}
                </h2>
                <p className="mt-3 text-sm opacity-85">{preview.benefit.edition_name}</p>
              </div>
              <div className="min-w-0 flex-1 border-t-2 border-dashed border-border-subtle p-5 sm:border-s-2 sm:border-t-0 sm:p-6">
                {preview.benefit.offer_description ? (
                  <p className="text-[0.9375rem] leading-7 text-muted-foreground">
                    {preview.benefit.offer_description}
                  </p>
                ) : null}

                <dl className="mt-5 grid gap-4 sm:grid-cols-2">
                  <div>
                    <dt className="flex items-center gap-1.5 text-xs font-bold uppercase tracking-[0.1em] text-muted-foreground">
                      <Store aria-hidden="true" className="size-3.5" /> Lugar
                    </dt>
                    <dd className="mt-1 font-semibold">{preview.benefit.establishment_name}</dd>
                  </div>
                  <div className="min-w-0">
                    <dt className="flex items-center gap-1.5 text-xs font-bold uppercase tracking-[0.1em] text-muted-foreground">
                      <UserRound aria-hidden="true" className="size-3.5" /> Titular
                    </dt>
                    <dd className="mt-1 font-semibold">{preview.holder.full_name}</dd>
                    <dd className="truncate text-sm text-muted-foreground">
                      {preview.holder.email}
                    </dd>
                  </div>
                </dl>

                {preview.benefit.terms ? (
                  <div className="mt-5 rounded-2xl bg-background p-4">
                    <p className="text-xs font-bold uppercase tracking-[0.1em] text-muted-foreground">
                      Regras
                    </p>
                    <p className="mt-2 whitespace-pre-line text-sm leading-6">
                      {preview.benefit.terms}
                    </p>
                  </div>
                ) : null}
              </div>
            </article>

            <aside className="rounded-card border border-success/25 bg-success-soft p-5 sm:p-6 lg:sticky lg:top-6">
              <p className="flex items-center gap-2 font-display text-lg font-bold">
                <CheckCircle2 aria-hidden="true" className="size-6 text-success" />
                Apresentação válida
              </p>
              <p className="mt-2 text-sm leading-6 text-foreground">
                Confira o titular e o benefício antes de confirmar.
              </p>
              <p className="mt-4 font-display text-3xl font-extrabold tabular-nums">
                {preview.benefit.remaining_redemptions}
              </p>
              <p className="text-sm text-foreground">
                {preview.benefit.remaining_redemptions === 1
                  ? 'utilização restante'
                  : 'utilizações restantes'}
              </p>
              <ConfirmDialog
                title="Confirmar utilização?"
                description={`Benefício de ${preview.holder.full_name} em ${preview.benefit.establishment_name}. Depois de confirmar, o comprovante é emitido e o uso não pode ser desfeito.`}
                confirmLabel="Confirmar utilização"
                processing={processing}
                onConfirm={confirm}
                trigger={
                  <Button
                    type="button"
                    variant="cta"
                    size="2xl"
                    shape="pill"
                    className="mt-5 w-full"
                    disabled={processing}
                    aria-busy={processing}
                  >
                    {processing ? <Loader2 className="animate-spin" /> : <CheckCircle2 />}
                    {processing ? 'Confirmando…' : 'Confirmar utilização'}
                  </Button>
                }
              />
            </aside>
          </section>
        ) : null}
      </div>
    </MainLayout>
  )
}
