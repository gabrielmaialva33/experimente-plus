import { Head, Link } from '@inertiajs/react'
import { ArrowLeft, Check, Clock3, Copy, RefreshCw, ShieldCheck, TicketCheck } from 'lucide-react'
import { useEffect, useMemo, useState } from 'react'

import { ConsumerShell } from '~/components/consumer/consumer_shell'
import { Button } from '~/components/ui/button'
import type { RedemptionPresentation } from '~/types/benefit_redemption'

interface PresentBenefitPageProps {
  presentation: RedemptionPresentation
}

function formatRemaining(seconds: number): string {
  const safeSeconds = Math.max(0, seconds)
  const minutes = Math.floor(safeSeconds / 60)
  const remainder = safeSeconds % 60
  return `${minutes}:${String(remainder).padStart(2, '0')}`
}

export default function PresentBenefitPage({ presentation }: PresentBenefitPageProps) {
  const expiry = useMemo(
    () => new Date(presentation.expires_at).getTime(),
    [presentation.expires_at]
  )
  const [remaining, setRemaining] = useState(() =>
    Math.max(0, Math.ceil((expiry - Date.now()) / 1000))
  )
  const [copyStatus, setCopyStatus] = useState<'idle' | 'copied' | 'error'>('idle')

  useEffect(() => {
    const timer = window.setInterval(() => {
      setRemaining(Math.max(0, Math.ceil((expiry - Date.now()) / 1000)))
    }, 1000)

    return () => window.clearInterval(timer)
  }, [expiry])

  const expired = remaining === 0
  const { benefit } = presentation

  async function copyValidationLink() {
    try {
      await navigator.clipboard.writeText(presentation.validation_url)
      setCopyStatus('copied')
    } catch {
      setCopyStatus('error')
    }
  }

  return (
    <ConsumerShell>
      <Head title={`Usar ${benefit.offer_title}`} />

      <div className="mx-auto w-full max-w-5xl">
        <div className="mb-5 flex flex-wrap items-center justify-between gap-3">
          <Button asChild variant="ghost" className="-ml-3 min-h-11">
            <Link href="/wallet">
              <ArrowLeft />
              Voltar à carteira
            </Link>
          </Button>
          <Button asChild variant="outline" className="min-h-11">
            <Link href="/wallet/history">
              <TicketCheck />
              Utilizações
            </Link>
          </Button>
        </div>

        <section className="overflow-hidden rounded-3xl border border-border/70 bg-card shadow-sm">
          <div className="grid lg:grid-cols-[minmax(0,1fr)_24rem]">
            <div className="p-5 sm:p-8 lg:p-10">
              <div className="flex items-center gap-2 text-sm font-semibold text-primary">
                <ShieldCheck className="size-4" />
                Apresentação segura
              </div>
              <p className="mt-5 text-sm font-semibold uppercase tracking-[0.14em] text-muted-foreground">
                {benefit.establishment_name}
              </p>
              <h1 className="mt-2 text-3xl font-black tracking-[-0.04em] sm:text-4xl">
                {benefit.offer_title}
              </h1>
              <p className="mt-4 max-w-2xl text-base leading-7 text-muted-foreground">
                {benefit.offer_description}
              </p>

              <dl className="mt-7 grid gap-3 sm:grid-cols-2">
                <div className="rounded-2xl bg-muted/45 p-4">
                  <dt className="text-xs font-semibold uppercase tracking-[0.1em] text-muted-foreground">
                    Edição
                  </dt>
                  <dd className="mt-1 font-semibold">{benefit.edition_name}</dd>
                </div>
                <div className="rounded-2xl bg-muted/45 p-4">
                  <dt className="text-xs font-semibold uppercase tracking-[0.1em] text-muted-foreground">
                    Utilizações restantes
                  </dt>
                  <dd className="mt-1 font-semibold">{benefit.remaining_redemptions}</dd>
                </div>
              </dl>

              {benefit.terms ? (
                <div className="mt-6 rounded-2xl border border-border/70 p-4">
                  <p className="text-xs font-semibold uppercase tracking-[0.1em] text-muted-foreground">
                    Regras do benefício
                  </p>
                  <p className="mt-2 whitespace-pre-line text-sm leading-6">{benefit.terms}</p>
                </div>
              ) : null}

              <div className="mt-6 rounded-2xl border border-primary/20 bg-primary/5 p-4 text-sm leading-6">
                Mostre este código somente ao atendimento do estabelecimento. A confirmação final é
                feita pelo parceiro no servidor.
              </div>
            </div>

            <div className="flex flex-col items-center justify-center border-t border-border/70 bg-muted/25 p-6 sm:p-8 lg:border-l lg:border-t-0">
              <div className="w-full max-w-[20rem] rounded-3xl bg-white p-4 shadow-sm">
                <img
                  src={presentation.qr_data_url}
                  alt="QR Code temporário para validar o benefício"
                  className="aspect-square w-full"
                />
              </div>

              <div className="mt-5 flex items-center gap-2 text-sm font-semibold">
                <Clock3 className="size-4 text-primary" />
                {expired ? 'Código expirado' : `Expira em ${formatRemaining(remaining)}`}
              </div>

              {!expired ? (
                <Button
                  type="button"
                  variant="outline"
                  className="mt-4 min-h-12 w-full max-w-[20rem]"
                  onClick={copyValidationLink}
                >
                  {copyStatus === 'copied' ? <Check /> : <Copy />}
                  {copyStatus === 'copied'
                    ? 'Link copiado'
                    : copyStatus === 'error'
                      ? 'Não foi possível copiar'
                      : 'Copiar link de validação'}
                </Button>
              ) : null}

              {expired ? (
                <Button
                  type="button"
                  size="lg"
                  className="mt-4 min-h-12 w-full max-w-[20rem]"
                  onClick={() => window.location.reload()}
                >
                  <RefreshCw />
                  Gerar novo código
                </Button>
              ) : null}
            </div>
          </div>
        </section>
      </div>
    </ConsumerShell>
  )
}
