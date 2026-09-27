import { Link } from '@inertiajs/react'
import {
  AlertTriangle,
  Ban,
  CalendarClock,
  CheckCheck,
  CheckCircle2,
  Keyboard,
  LockKeyhole,
  PauseCircle,
  Receipt,
  RotateCcw,
  ScanLine,
  Store,
  TimerOff,
  UserRound,
  WifiOff,
  type LucideIcon,
} from 'lucide-react'
import type { Ref } from 'react'

import { Button } from '~/components/ui/button'
import type { RedemptionRequestProblem } from '~/lib/redemption_validation'
import type {
  RedemptionPreviewView,
  RedemptionReceipt,
  RedemptionRefusal,
  RedemptionRefusalReason,
} from '~/types/benefit_redemption'

const SAO_PAULO_TIME = new Intl.DateTimeFormat('pt-BR', {
  dateStyle: 'short',
  timeStyle: 'short',
  timeZone: 'America/Sao_Paulo',
})

const REFUSAL_ICONS: Record<RedemptionRefusalReason, LucideIcon> = {
  invalid: TimerOff,
  foreign: Store,
  not_allowed: LockKeyhole,
  already_used: CheckCheck,
  paused: PauseCircle,
  blocked: Ban,
  outside_window: CalendarClock,
}

export const REQUEST_PROBLEMS: Record<
  RedemptionRequestProblem,
  { title: string; message: string }
> = {
  network: {
    title: 'Sem conexão',
    message:
      'Não conseguimos falar com o servidor. Verifique a internet e tente de novo. Nada foi registrado.',
  },
  session: {
    title: 'Sessão expirada',
    message:
      'Sua sessão terminou ou a página ficou desatualizada. Recarregue a página e, se for preciso, entre de novo.',
  },
  server: {
    title: 'Não foi possível conferir agora',
    message: 'O servidor não respondeu como esperado. Tente de novo em instantes.',
  },
}

export const CONFIRMATION_NOT_COMPLETED =
  'A confirmação não completou. Tentar de novo é seguro: se o uso já foi registrado, o mesmo comprovante será devolvido.'

interface NextActions {
  onScan: () => void
  onType: () => void
}

function NextButtons({ onScan, onType, scanLabel }: NextActions & { scanLabel: string }) {
  return (
    <div className="flex flex-col gap-3 sm:flex-row">
      <Button type="button" size="xl" shape="pill" onClick={onScan}>
        <ScanLine aria-hidden="true" />
        {scanLabel}
      </Button>
      <Button type="button" variant="outline" size="xl" shape="pill" onClick={onType}>
        <Keyboard aria-hidden="true" />
        Digitar código
      </Button>
    </div>
  )
}

/** The benefit as the customer's ticket: the navy stub names it, the body says where and who. */
export function PresentedBenefit({
  preview,
  headingRef,
}: {
  preview: RedemptionPreviewView
  headingRef?: Ref<HTMLHeadingElement>
}) {
  return (
    <article className="overflow-hidden rounded-card border border-border-subtle bg-card sm:flex">
      <div className="bg-chrome p-5 text-chrome-foreground sm:w-60 sm:shrink-0 sm:p-6">
        <p className="text-xs font-bold uppercase tracking-[0.14em] opacity-80">Benefício</p>
        <h2
          ref={headingRef}
          tabIndex={-1}
          className="mt-2 scroll-mt-28 font-display text-2xl font-extrabold leading-tight tracking-[-0.02em] outline-none"
        >
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
            <dd className="truncate text-sm text-muted-foreground">{preview.holder.email}</dd>
          </div>
          <div className="sm:col-span-2">
            <dt className="flex items-center gap-1.5 text-xs font-bold uppercase tracking-[0.1em] text-muted-foreground">
              <CalendarClock aria-hidden="true" className="size-3.5" /> Validade do código
            </dt>
            <dd className="mt-1 font-semibold">
              até {SAO_PAULO_TIME.format(new Date(preview.expires_at))}
            </dd>
          </div>
        </dl>

        {preview.benefit.terms ? (
          <div className="mt-5 rounded-2xl bg-background p-4">
            <p className="text-xs font-bold uppercase tracking-[0.1em] text-muted-foreground">
              Regras
            </p>
            <p className="mt-2 whitespace-pre-line text-sm leading-6">{preview.benefit.terms}</p>
          </div>
        ) : null}
      </div>
    </article>
  )
}

interface ReceiptPanelProps extends NextActions {
  receipt: RedemptionReceipt
  /** The code had already been confirmed: this is the original receipt, nothing new was registered. */
  replay: boolean
  headingRef?: Ref<HTMLHeadingElement>
}

export function ReceiptPanel({ receipt, replay, headingRef, onScan, onType }: ReceiptPanelProps) {
  return (
    <section
      aria-labelledby="validation-receipt-title"
      className="overflow-hidden rounded-card border border-success/25 bg-card"
    >
      <div className="bg-success-soft px-5 py-5 sm:px-6">
        <p className="flex items-center gap-2 font-bold text-success-accent">
          <CheckCircle2 aria-hidden="true" className="size-6 shrink-0" />
          {replay ? 'Este QR code já tinha sido confirmado' : 'Utilização registrada'}
        </p>
        <h2
          id="validation-receipt-title"
          ref={headingRef}
          tabIndex={-1}
          className="mt-3 scroll-mt-28 font-display text-2xl font-extrabold leading-tight tracking-[-0.02em] outline-none sm:text-3xl"
        >
          {receipt.offer.title}
        </h2>
        <p className="mt-1 text-sm text-foreground">
          {receipt.establishment.name} · {receipt.edition.name}
        </p>
        {replay ? (
          <p className="mt-3 text-sm leading-6 text-foreground">
            Este é o comprovante original. Nenhuma utilização nova foi registrada.
          </p>
        ) : null}
      </div>

      <div className="space-y-6 px-5 py-6 sm:px-6">
        <dl className="grid gap-5 sm:grid-cols-3">
          <div className="min-w-0 sm:col-span-3">
            <dt className="text-xs font-bold uppercase tracking-[0.1em] text-muted-foreground">
              Comprovante
            </dt>
            <dd className="mt-1 break-all font-mono text-lg font-black tracking-[0.04em] min-[400px]:text-xl sm:text-2xl sm:tracking-[0.06em]">
              {receipt.receipt_code}
            </dd>
          </div>
          <div className="min-w-0">
            <dt className="text-xs font-bold uppercase tracking-[0.1em] text-muted-foreground">
              Titular
            </dt>
            <dd className="mt-1 font-semibold">{receipt.holder.full_name}</dd>
          </div>
          <div>
            <dt className="text-xs font-bold uppercase tracking-[0.1em] text-muted-foreground">
              Registrada em
            </dt>
            <dd className="mt-1 font-semibold">
              {SAO_PAULO_TIME.format(new Date(receipt.redeemed_at))}
            </dd>
          </div>
          <div>
            <dt className="text-xs font-bold uppercase tracking-[0.1em] text-muted-foreground">
              Utilização
            </dt>
            <dd className="mt-1 font-semibold">nº {receipt.redemption_number}</dd>
          </div>
        </dl>

        <div className="flex flex-col gap-3 border-t border-dashed border-border-subtle pt-5 lg:flex-row lg:items-center">
          <NextButtons onScan={onScan} onType={onType} scanLabel="Ler próximo QR code" />
          <Button asChild variant="ghost" size="xl" shape="pill" className="lg:ms-auto">
            <Link href={`/portal/redemptions/${receipt.receipt_code}`}>
              <Receipt aria-hidden="true" />
              Abrir comprovante
            </Link>
          </Button>
        </div>
      </div>
    </section>
  )
}

interface RefusalPanelProps extends NextActions {
  refusal: RedemptionRefusal
  headingRef?: Ref<HTMLHeadingElement>
}

export function RefusalPanel({ refusal, headingRef, onScan, onType }: RefusalPanelProps) {
  const Icon = REFUSAL_ICONS[refusal.reason] ?? AlertTriangle

  return (
    <section
      aria-labelledby="validation-refusal-title"
      data-reason={refusal.reason}
      className="rounded-card border border-warning/40 bg-warning-soft p-5 sm:p-6"
    >
      <div className="flex items-start gap-4">
        <span className="hidden size-12 shrink-0 items-center justify-center rounded-full bg-card text-warning-accent sm:flex">
          <Icon aria-hidden="true" className="size-6" />
        </span>
        <div className="min-w-0">
          <h2
            id="validation-refusal-title"
            ref={headingRef}
            tabIndex={-1}
            className="flex scroll-mt-28 items-center gap-2 font-display text-xl font-extrabold leading-tight outline-none sm:text-2xl"
          >
            <Icon aria-hidden="true" className="size-6 shrink-0 text-warning-accent sm:hidden" />
            {refusal.title}
          </h2>
          <p className="mt-2 max-w-2xl text-[0.9375rem] leading-7 text-foreground">
            {refusal.message}
          </p>
          <p className="mt-1 text-sm font-semibold text-warning-accent">Nada foi registrado.</p>
        </div>
      </div>
      <div className="mt-5">
        <NextButtons onScan={onScan} onType={onType} scanLabel="Ler outro QR code" />
      </div>
    </section>
  )
}

interface RequestProblemPanelProps {
  problem: RedemptionRequestProblem
  headingRef?: Ref<HTMLHeadingElement>
  onRetry: () => void
  onCancel: () => void
}

/** The preview request did not get an answer; the presentation was not judged yet. */
export function RequestProblemPanel({
  problem,
  headingRef,
  onRetry,
  onCancel,
}: RequestProblemPanelProps) {
  const copy = REQUEST_PROBLEMS[problem]

  return (
    <section
      aria-labelledby="validation-problem-title"
      className="rounded-card border border-warning/40 bg-warning-soft p-5 sm:p-6"
    >
      <h2
        id="validation-problem-title"
        ref={headingRef}
        tabIndex={-1}
        className="flex scroll-mt-28 items-center gap-2 font-display text-xl font-extrabold outline-none"
      >
        <WifiOff aria-hidden="true" className="size-6 shrink-0 text-warning-accent" />
        {copy.title}
      </h2>
      <p className="mt-2 max-w-2xl text-[0.9375rem] leading-7">{copy.message}</p>
      <div className="mt-5 flex flex-col gap-3 sm:flex-row">
        {problem === 'session' ? (
          <Button type="button" size="xl" shape="pill" onClick={() => window.location.reload()}>
            <RotateCcw aria-hidden="true" />
            Recarregar página
          </Button>
        ) : (
          <Button type="button" size="xl" shape="pill" onClick={onRetry}>
            <RotateCcw aria-hidden="true" />
            Tentar de novo
          </Button>
        )}
        <Button type="button" variant="outline" size="xl" shape="pill" onClick={onCancel}>
          Cancelar
        </Button>
      </div>
    </section>
  )
}
