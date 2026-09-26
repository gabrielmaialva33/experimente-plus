import { Head, Link } from '@inertiajs/react'
import { ArrowLeft, CheckCircle2, ShieldCheck, UserRound } from 'lucide-react'

import { Button } from '~/components/ui/button'
import { MainLayout } from '~/layouts/main_layout'
import type { RedemptionReceipt } from '~/types/benefit_redemption'

interface PartnerReceiptPageProps {
  receipt: RedemptionReceipt
}

function formatDate(value: string): string {
  return new Intl.DateTimeFormat('pt-BR', {
    dateStyle: 'long',
    timeStyle: 'short',
    timeZone: 'America/Sao_Paulo',
  }).format(new Date(value))
}

export default function PartnerReceiptPage({ receipt }: PartnerReceiptPageProps) {
  return (
    <MainLayout>
      <Head title="Comprovante de utilização" />

      <div className="space-y-6">
        <Button asChild variant="ghost" size="md" shape="pill" className="-ms-3">
          <Link href="/portal/redemptions">
            <ArrowLeft />
            Voltar às utilizações
          </Link>
        </Button>

        <section
          aria-labelledby="receipt-title"
          className="mx-auto max-w-2xl overflow-hidden rounded-card border border-border-subtle bg-card"
        >
          <div className="bg-success-soft px-6 py-5 sm:px-8">
            <p className="flex items-center gap-2 font-bold text-success-accent">
              <CheckCircle2 aria-hidden="true" className="size-6" />
              Utilização confirmada
            </p>
            <h1
              id="receipt-title"
              className="mt-3 font-display text-2xl font-extrabold tracking-[-0.02em] sm:text-3xl"
            >
              {receipt.offer.title}
            </h1>
            <p className="mt-1 text-sm text-foreground">
              {receipt.establishment.name} · {receipt.edition.name}
            </p>
          </div>

          <div className="space-y-6 px-6 py-6 sm:px-8">
            <div>
              <p className="text-xs font-bold uppercase tracking-[0.1em] text-muted-foreground">
                Comprovante
              </p>
              <p className="mt-1 font-mono text-2xl font-black tracking-[0.06em] break-all">
                {receipt.receipt_code}
              </p>
              <p className="mt-1 text-sm text-muted-foreground">
                {formatDate(receipt.redeemed_at)}
              </p>
            </div>

            <dl className="grid gap-4 border-t border-dashed border-border-subtle pt-5 sm:grid-cols-2">
              <div className="min-w-0">
                <dt className="flex items-center gap-1.5 text-xs font-bold uppercase tracking-[0.1em] text-muted-foreground">
                  <UserRound aria-hidden="true" className="size-3.5" /> Titular
                </dt>
                <dd className="mt-1 font-semibold">{receipt.holder.full_name}</dd>
                <dd className="truncate text-sm text-muted-foreground">{receipt.holder.email}</dd>
              </div>
              <div>
                <dt className="flex items-center gap-1.5 text-xs font-bold uppercase tracking-[0.1em] text-muted-foreground">
                  <ShieldCheck aria-hidden="true" className="size-3.5" /> Uso registrado
                </dt>
                <dd className="mt-1 font-semibold">Utilização nº {receipt.redemption_number}</dd>
                <dd className="text-sm text-muted-foreground">Registrada pela equipe do lugar</dd>
              </div>
            </dl>

            {receipt.offer.terms ? (
              <div className="rounded-2xl bg-muted/50 p-4">
                <p className="text-xs font-bold uppercase tracking-[0.1em] text-muted-foreground">
                  Regras no momento do uso
                </p>
                <p className="mt-2 whitespace-pre-line text-sm leading-6">{receipt.offer.terms}</p>
              </div>
            ) : null}
          </div>
        </section>
      </div>
    </MainLayout>
  )
}
