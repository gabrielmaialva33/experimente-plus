import { Head, Link, router } from '@inertiajs/react'
import { ArrowLeft, CheckCircle2, Loader2, MapPin, ScanLine, Store, UserRound } from 'lucide-react'
import { useState, type FormEvent } from 'react'

import { ConfirmDialog } from '~/components/confirm_dialog'
import { PageHeader } from '~/components/page_header'
import { Button } from '~/components/ui/button'
import { Input } from '~/components/ui/input'
import { MainLayout } from '~/layouts/main_layout'
import type { RedemptionPreview } from '~/types/benefit_redemption'

interface PartnerValidationPageProps {
  token: string
  preview: RedemptionPreview | null
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

export default function PartnerValidationPage({ token, preview }: PartnerValidationPageProps) {
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

      <div className="space-y-7">
        <PageHeader
          eyebrow="Portal do parceiro"
          icon={ScanLine}
          title="Validar benefício"
          description="Leia o QR Code ou cole o link apresentado pelo cliente. A utilização só é registrada após sua confirmação."
          actions={
            <Button asChild variant="outline" size="lg">
              <Link href="/portal/redemptions">
                <ArrowLeft />
                Utilizações
              </Link>
            </Button>
          }
        />

        <form
          onSubmit={inspect}
          className="rounded-lg border border-border bg-card p-5 sm:p-7"
          aria-busy={inspecting}
        >
          <label htmlFor="presentation-token" className="text-sm font-semibold">
            Link da apresentação
          </label>
          <div className="mt-2 flex flex-col gap-3 sm:flex-row">
            <Input
              id="presentation-token"
              value={input}
              onChange={(event) => setInput(event.target.value)}
              autoComplete="off"
              placeholder="Cole o link apresentado pelo cliente"
              className="min-h-12 flex-1"
              disabled={inspecting}
            />
            <Button
              type="submit"
              variant={preview ? 'outline' : 'primary'}
              size="lg"
              disabled={!input.trim() || inspecting}
              aria-busy={inspecting}
            >
              {inspecting ? <Loader2 className="animate-spin" /> : <ScanLine />}
              {inspecting ? 'Conferindo…' : 'Conferir'}
            </Button>
          </div>
        </form>

        {preview ? (
          <section className="grid gap-6 lg:grid-cols-[minmax(0,1fr)_20rem] lg:items-start">
            <div className="rounded-lg border border-border bg-card p-5 sm:p-7">
              <p className="text-xs font-bold uppercase tracking-[0.14em] text-primary">
                Benefício apresentado
              </p>
              <h2 className="mt-2 text-2xl font-black tracking-[-0.03em]">
                {preview.benefit.offer_title}
              </h2>
              <p className="mt-3 text-sm leading-7 text-muted-foreground">
                {preview.benefit.offer_description}
              </p>

              <dl className="mt-6 grid gap-3 sm:grid-cols-2">
                <div className="rounded-md border border-border bg-muted/40 p-4">
                  <dt className="flex items-center gap-2 text-xs text-muted-foreground">
                    <Store className="size-4" /> Estabelecimento
                  </dt>
                  <dd className="mt-2 font-semibold">{preview.benefit.establishment_name}</dd>
                </div>
                <div className="rounded-md border border-border bg-muted/40 p-4">
                  <dt className="flex items-center gap-2 text-xs text-muted-foreground">
                    <MapPin className="size-4" /> Edição
                  </dt>
                  <dd className="mt-2 font-semibold">{preview.benefit.edition_name}</dd>
                </div>
                <div className="rounded-md border border-border bg-muted/40 p-4 sm:col-span-2">
                  <dt className="flex items-center gap-2 text-xs text-muted-foreground">
                    <UserRound className="size-4" /> Titular
                  </dt>
                  <dd className="mt-2 font-semibold">
                    {preview.holder.full_name}
                    <span className="ms-2 text-sm font-normal text-muted-foreground">
                      {preview.holder.email}
                    </span>
                  </dd>
                </div>
              </dl>

              {preview.benefit.terms ? (
                <div className="mt-5 rounded-md border border-border p-4">
                  <p className="text-xs font-bold uppercase tracking-[0.1em] text-muted-foreground">
                    Regras
                  </p>
                  <p className="mt-3 whitespace-pre-line text-sm leading-7">
                    {preview.benefit.terms}
                  </p>
                </div>
              ) : null}
            </div>

            <aside className="rounded-lg border border-success/25 bg-success/8 p-5 sm:p-6 lg:sticky lg:top-6">
              <CheckCircle2 className="size-8 text-success" />
              <h2 className="mt-4 text-lg font-bold">Apresentação válida</h2>
              <p className="mt-2 text-sm leading-6 text-muted-foreground">
                Confira os dados ao lado antes de confirmar uma das utilizações disponíveis.
              </p>
              <p className="mt-4 text-sm font-semibold">
                {preview.benefit.remaining_redemptions}{' '}
                {preview.benefit.remaining_redemptions === 1
                  ? 'utilização restante'
                  : 'utilizações restantes'}
              </p>
              <ConfirmDialog
                title="Confirmar utilização?"
                description={`Confira o benefício de ${preview.holder.full_name} em ${preview.benefit.establishment_name}. Após a confirmação, o comprovante será emitido e a utilização não poderá ser desfeita.`}
                confirmLabel="Confirmar utilização"
                processing={processing}
                onConfirm={confirm}
                trigger={
                  <Button
                    type="button"
                    size="lg"
                    className="mt-5 min-h-12 w-full"
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
