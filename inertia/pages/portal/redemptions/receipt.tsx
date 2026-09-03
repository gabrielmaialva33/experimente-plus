import { Head, Link } from '@inertiajs/react'
import { ArrowLeft, CheckCircle2, ReceiptText, ShieldCheck, UserRound } from 'lucide-react'

import { PageHeader } from '~/components/page_header'
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

      <div className="space-y-7">
        <PageHeader
          eyebrow="Portal do parceiro"
          icon={ReceiptText}
          title="Comprovante de utilização"
          description={`${receipt.offer.title} · ${receipt.establishment.name} · ${receipt.edition.name}`}
          actions={
            <Button asChild variant="outline" size="lg">
              <Link href="/portal/redemptions">
                <ArrowLeft />
                Voltar às utilizações
              </Link>
            </Button>
          }
        />

        <section className="mx-auto max-w-3xl rounded-lg border border-success/25 bg-card p-6 sm:p-8">
          <div className="flex items-center gap-3 text-success">
            <CheckCircle2 className="size-7" />
            <p className="font-bold">Utilização confirmada</p>
          </div>

          <p className="mt-6 font-mono text-2xl font-black tracking-[0.08em]">
            {receipt.receipt_code}
          </p>
          <p className="mt-2 text-sm text-muted-foreground">{formatDate(receipt.redeemed_at)}</p>

          <dl className="mt-7 grid gap-3 sm:grid-cols-2">
            <div className="rounded-md border border-border bg-muted/40 p-4">
              <dt className="flex items-center gap-2 text-xs text-muted-foreground">
                <UserRound className="size-4" /> Titular
              </dt>
              <dd className="mt-2 font-semibold">{receipt.holder.full_name}</dd>
              <dd className="mt-1 text-sm text-muted-foreground">{receipt.holder.email}</dd>
            </div>
            <div className="rounded-md border border-border bg-muted/40 p-4">
              <dt className="flex items-center gap-2 text-xs text-muted-foreground">
                <ShieldCheck className="size-4" /> Uso registrado
              </dt>
              <dd className="mt-2 font-semibold">Utilização nº {receipt.redemption_number}</dd>
              <dd className="mt-1 text-sm text-muted-foreground">
                Registrada pela equipe da unidade
              </dd>
            </div>
          </dl>

          {receipt.offer.terms ? (
            <div className="mt-6 rounded-md border border-border p-4">
              <p className="text-xs font-semibold uppercase tracking-[0.1em] text-muted-foreground">
                Regras vigentes no momento da utilização
              </p>
              <p className="mt-2 whitespace-pre-line text-sm leading-6">{receipt.offer.terms}</p>
            </div>
          ) : null}
        </section>
      </div>
    </MainLayout>
  )
}
