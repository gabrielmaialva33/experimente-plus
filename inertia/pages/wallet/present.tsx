import { Head, Link } from '@inertiajs/react'
import { ArrowLeft, Check, Clock3, Copy, RefreshCw, ShieldCheck } from 'lucide-react'
import { useEffect, useMemo, useState } from 'react'

import { ConsumerFlowShell } from '~/components/consumer/consumer_flow_shell'
import { Button } from '~/components/ui/button'
import { Card, CardContent } from '~/components/ui/card'
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
    <ConsumerFlowShell
      title="Usar benefício"
      description="Mostre a apresentação temporária somente quando estiver no estabelecimento."
      actions={
        <Button asChild variant="outline">
          <Link href="/wallet">
            <ArrowLeft aria-hidden="true" />
            Voltar à carteira
          </Link>
        </Button>
      }
    >
      <Head title={`Usar ${benefit.offer_title}`}>
        <meta name="robots" content="noindex,nofollow" />
      </Head>

      <Card className="mx-auto max-w-5xl overflow-hidden">
        <CardContent className="grid p-0 lg:grid-cols-[minmax(0,1fr)_22rem]">
          <div className="p-5 sm:p-7">
            <p className="text-xs font-semibold uppercase tracking-[0.1em] text-primary">
              {benefit.establishment_name}
            </p>
            <h2 className="mt-2 text-2xl font-semibold tracking-tight">{benefit.offer_title}</h2>
            <p className="mt-3 text-sm leading-6 text-muted-foreground">
              {benefit.offer_description}
            </p>

            <dl className="mt-6 grid gap-3 sm:grid-cols-2">
              <div className="rounded-md border bg-muted/35 p-4">
                <dt className="text-xs text-muted-foreground">Edição</dt>
                <dd className="mt-1 font-medium">{benefit.edition_name}</dd>
              </div>
              <div className="rounded-md border bg-muted/35 p-4">
                <dt className="text-xs text-muted-foreground">Utilizações restantes</dt>
                <dd className="mt-1 font-medium tabular-nums">{benefit.remaining_redemptions}</dd>
              </div>
            </dl>

            {benefit.terms ? (
              <section aria-labelledby="benefit-terms-title" className="mt-5 rounded-md border p-4">
                <h3 id="benefit-terms-title" className="text-sm font-semibold">
                  Regras do benefício
                </h3>
                <p className="mt-2 whitespace-pre-line text-sm leading-6 text-muted-foreground">
                  {benefit.terms}
                </p>
              </section>
            ) : null}

            <div className="mt-5 flex items-start gap-3 rounded-md border border-primary/25 bg-primary-soft p-4 text-sm leading-6 text-primary-accent">
              <ShieldCheck className="mt-0.5 size-4 shrink-0" aria-hidden="true" />A apresentação
              não conclui o uso sozinha. A confirmação final é feita no servidor por uma pessoa
              autorizada da organização.
            </div>
          </div>

          <div className="flex flex-col items-center justify-center border-t bg-muted/30 p-5 sm:p-7 lg:border-l lg:border-t-0">
            <div className="w-full max-w-[18rem] rounded-md border bg-white p-3">
              <img
                src={presentation.qr_data_url}
                alt="QR Code temporário para validar o benefício"
                className="aspect-square w-full"
              />
            </div>

            <p className="mt-4 flex items-center gap-2 text-sm font-medium" aria-hidden="true">
              <Clock3 className="size-4 text-primary" />
              {expired ? 'Código expirado' : `Expira em ${formatRemaining(remaining)}`}
            </p>
            <p className="sr-only" role="status">
              {expired ? 'O código expirou.' : 'Código temporário válido.'}
            </p>

            {!expired ? (
              <Button
                type="button"
                variant="outline"
                className="mt-4 w-full max-w-[18rem]"
                onClick={copyValidationLink}
              >
                {copyStatus === 'copied' ? (
                  <Check aria-hidden="true" />
                ) : (
                  <Copy aria-hidden="true" />
                )}
                <span aria-live="polite">
                  {copyStatus === 'copied'
                    ? 'Link copiado'
                    : copyStatus === 'error'
                      ? 'Não foi possível copiar'
                      : 'Copiar link de validação'}
                </span>
              </Button>
            ) : (
              <Button
                type="button"
                variant="primary"
                className="mt-4 w-full max-w-[18rem]"
                onClick={() => window.location.reload()}
              >
                <RefreshCw aria-hidden="true" />
                Gerar novo código
              </Button>
            )}
          </div>
        </CardContent>
      </Card>
    </ConsumerFlowShell>
  )
}
