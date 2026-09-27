import { Head, Link, router, usePage } from '@inertiajs/react'
import {
  AlertTriangle,
  ArrowLeft,
  CheckCircle2,
  Keyboard,
  Loader2,
  LockKeyhole,
  RotateCcw,
  ScanLine,
  X,
} from 'lucide-react'
import { useCallback, useEffect, useRef, useState, type FormEvent } from 'react'

import { QrScanner } from '~/components/benefits/qr_scanner'
import {
  CONFIRMATION_NOT_COMPLETED,
  PresentedBenefit,
  REQUEST_PROBLEMS,
  ReceiptPanel,
  RefusalPanel,
  RequestProblemPanel,
} from '~/components/benefits/redemption_outcomes'
import {
  useRedemptionValidation,
  type ValidationStage,
} from '~/components/benefits/use_redemption_validation'
import { ConfirmDialog } from '~/components/confirm_dialog'
import { EmptyState } from '~/components/empty_state'
import { PageHeader } from '~/components/page_header'
import { Button } from '~/components/ui/button'
import { Input } from '~/components/ui/input'
import { MainLayout } from '~/layouts/main_layout'
import { firstError } from '~/lib/form_errors'
import { extractPresentationToken } from '~/lib/presentation_token'
import type { OrganizationAllowedActions } from '~/types'
import type {
  RedemptionPreview,
  RedemptionReceipt,
  RedemptionRefusal,
} from '~/types/benefit_redemption'

interface PartnerValidationPageProps {
  /** Set only when a link opened from the phone's camera app previews. */
  token: string
  preview: RedemptionPreview | null
  /** The original receipt, when that link had already been confirmed. */
  receipt?: RedemptionReceipt | null
  refusal?: RedemptionRefusal | null
  allowed_actions: OrganizationAllowedActions
}

type EntryMode = 'choose' | 'scan' | 'type'

export const FOREIGN_QR_MESSAGE = 'Este QR não é um benefício do Experimente+.'
export const UNRECOGNIZED_CODE_MESSAGE =
  'Não reconhecemos este código. Cole o link completo da apresentação ou o código que aparece no app do cliente.'

function announcementFor(stage: ValidationStage): string {
  switch (stage.name) {
    case 'checking':
      return 'Conferindo a apresentação…'
    case 'check_failed':
      return `${REQUEST_PROBLEMS[stage.problem].title}. ${REQUEST_PROBLEMS[stage.problem].message}`
    case 'preview':
      return `Apresentação válida: ${stage.preview.benefit.offer_title} para ${stage.preview.holder.full_name}. Confira e confirme a utilização.`
    case 'confirming':
      return 'Confirmando a utilização…'
    case 'confirm_failed':
      return stage.problem === 'session'
        ? REQUEST_PROBLEMS.session.message
        : CONFIRMATION_NOT_COMPLETED
    case 'receipt':
      return stage.replay
        ? `Este QR code já tinha sido confirmado. Comprovante ${stage.receipt.receipt_code}.`
        : `Utilização registrada. Comprovante ${stage.receipt.receipt_code}.`
    case 'refused':
      return `${stage.refusal.title}. ${stage.refusal.message}`
    case 'entry':
      return ''
  }
}

/**
 * A link read by the phone's own camera app arrives with the token in the
 * address. Once the page has it in memory, the address and this history entry
 * lose it: a later reload, share or back navigation no longer carries it.
 */
function useForgetTokenInAddress() {
  useEffect(() => {
    const url = new URL(window.location.href)
    if (!url.searchParams.has('token')) return
    url.searchParams.delete('token')

    router.replace({
      url: `${url.pathname}${url.search}${url.hash}`,
      props: (current) => ({ ...current, token: '', preview: null, receipt: null, refusal: null }),
      preserveState: true,
      preserveScroll: true,
    })
  }, [])
}

export default function PartnerValidationPage({
  token,
  preview,
  receipt,
  refusal,
  allowed_actions: allowedActions,
}: PartnerValidationPageProps) {
  const { errors } = usePage().props as { errors?: Record<string, unknown> }
  const canValidate = allowedActions.redemptions.validate
  // Flashed by the form-post confirmation kept for old pages; the reader answers in place.
  const flashedRefusal = firstError(errors?.presentation)
  const validation = useRedemptionValidation({
    token,
    preview,
    receipt,
    refusal:
      refusal ??
      (flashedRefusal
        ? { reason: 'invalid', title: 'Apresentação indisponível', message: flashedRefusal }
        : null),
  })
  const { stage } = validation
  const [mode, setMode] = useState<EntryMode>('choose')
  const [input, setInput] = useState('')
  const [inputError, setInputError] = useState<string | null>(null)
  const [dialogOpen, setDialogOpen] = useState(false)
  const outcomeHeadingRef = useRef<HTMLHeadingElement | null>(null)
  const entryHeadingRef = useRef<HTMLHeadingElement | null>(null)
  const inputRef = useRef<HTMLInputElement | null>(null)
  const movedFocus = useRef(false)

  useForgetTokenInAddress()

  // Each outcome takes the focus to its heading, so a keyboard or screen
  // reader lands on the answer instead of on a control that just vanished.
  useEffect(() => {
    if (!movedFocus.current) {
      movedFocus.current = true
      if (stage.name === 'entry') return
    }
    if (
      stage.name === 'preview' ||
      stage.name === 'receipt' ||
      stage.name === 'refused' ||
      stage.name === 'check_failed'
    ) {
      outcomeHeadingRef.current?.focus()
    }
  }, [stage.name])

  useEffect(() => {
    if (mode === 'type') inputRef.current?.focus()
    if (mode === 'scan') entryHeadingRef.current?.focus()
  }, [mode])

  const startOver = useCallback(
    (next: EntryMode) => {
      validation.reset()
      setInput('')
      setInputError(null)
      setMode(next)
    },
    [validation]
  )

  const onDecode = useCallback(
    (value: string) => {
      const scanned = extractPresentationToken(value)
      if (!scanned) return false
      void validation.check(scanned)
      return true
    },
    [validation]
  )

  function submitTyped(event: FormEvent<HTMLFormElement>) {
    event.preventDefault()
    if (!input.trim()) return
    const typed = extractPresentationToken(input)
    if (!typed) {
      setInputError(UNRECOGNIZED_CODE_MESSAGE)
      return
    }
    // The field does not keep the token once it has been read.
    setInput('')
    setInputError(null)
    void validation.check(typed)
  }

  const inEntry =
    stage.name === 'entry' || stage.name === 'checking' || stage.name === 'check_failed'
  const previewStage =
    stage.name === 'preview' || stage.name === 'confirming' || stage.name === 'confirm_failed'
      ? stage
      : null

  return (
    <MainLayout>
      <Head title="Validar benefício" />

      <div className="space-y-6">
        <PageHeader
          title="Validar benefício"
          description="Leia o QR code que o cliente mostra no app ou digite o código. O uso só é registrado quando você confirmar."
          actions={
            <Button asChild variant="ghost" size="lg" shape="pill">
              <Link href="/portal/redemptions">
                <ArrowLeft />
                Utilizações
              </Link>
            </Button>
          }
        />

        <p className="sr-only" role="status" aria-live="polite" aria-atomic="true">
          {canValidate ? announcementFor(stage) : ''}
        </p>

        {!canValidate ? (
          <EmptyState
            className="rounded-card border border-dashed border-border bg-card"
            headingLevel={2}
            icon={LockKeyhole}
            title="Validação indisponível"
            description="Seu acesso permite consultar utilizações, mas não confirmá-las."
          />
        ) : null}

        {canValidate && inEntry ? (
          <section
            aria-labelledby="validation-entry-title"
            aria-busy={stage.name === 'checking'}
            className="rounded-card border border-border-subtle bg-card p-5 sm:p-6"
          >
            {stage.name === 'checking' ? (
              <div className="flex min-h-40 flex-col items-center justify-center gap-3 text-center">
                <Loader2 aria-hidden="true" className="size-8 animate-spin text-primary" />
                <h2 id="validation-entry-title" className="font-display text-lg font-bold">
                  Conferindo a apresentação…
                </h2>
                <p className="text-sm text-muted-foreground">Nada é registrado nesta etapa.</p>
              </div>
            ) : stage.name === 'check_failed' ? (
              <>
                <h2 id="validation-entry-title" className="sr-only">
                  Ler o benefício do cliente
                </h2>
                <RequestProblemPanel
                  problem={stage.problem}
                  headingRef={outcomeHeadingRef}
                  onRetry={validation.retryCheck}
                  onCancel={() => startOver('choose')}
                />
              </>
            ) : mode === 'scan' ? (
              <div className="space-y-4">
                <div className="flex items-center justify-between gap-3">
                  <h2
                    id="validation-entry-title"
                    ref={entryHeadingRef}
                    tabIndex={-1}
                    className="font-display text-xl font-bold outline-none"
                  >
                    Ler QR code
                  </h2>
                </div>
                <QrScanner
                  onDecode={onDecode}
                  rejectedMessage={FOREIGN_QR_MESSAGE}
                  hint="Aponte para o QR code que o cliente está mostrando no app."
                  onTypeInstead={() => setMode('type')}
                  onClose={() => setMode('choose')}
                />
              </div>
            ) : mode === 'type' ? (
              <form onSubmit={submitTyped} noValidate className="space-y-3">
                <h2 id="validation-entry-title" className="font-display text-xl font-bold">
                  Digitar código
                </h2>
                <label htmlFor="presentation-token" className="block text-sm font-bold">
                  Link ou código da apresentação
                </label>
                <p id="presentation-token-hint" className="text-sm text-muted-foreground">
                  Cole o link de validação que o cliente copiou no app, ou o código que aparece
                  nele.
                </p>
                <div className="flex flex-col gap-3 sm:flex-row">
                  <Input
                    id="presentation-token"
                    ref={inputRef}
                    value={input}
                    onChange={(event) => {
                      setInput(event.target.value)
                      setInputError(null)
                    }}
                    autoComplete="off"
                    autoCorrect="off"
                    autoCapitalize="none"
                    spellCheck={false}
                    enterKeyHint="go"
                    placeholder="https://… ou o código do cliente"
                    aria-invalid={inputError ? true : undefined}
                    aria-describedby={
                      inputError
                        ? 'presentation-token-hint presentation-token-error'
                        : 'presentation-token-hint'
                    }
                    className="h-12 rounded-full px-5 sm:flex-1"
                  />
                  <Button
                    type="submit"
                    variant="primary"
                    size="xl"
                    shape="pill"
                    disabled={!input.trim()}
                  >
                    <CheckCircle2 aria-hidden="true" />
                    Conferir
                  </Button>
                </div>
                {inputError ? (
                  <p
                    id="presentation-token-error"
                    role="alert"
                    className="flex items-start gap-2 text-sm font-semibold text-destructive-accent"
                  >
                    <AlertTriangle aria-hidden="true" className="mt-0.5 size-4 shrink-0" />
                    {inputError}
                  </p>
                ) : null}
                <div className="flex flex-wrap gap-2 pt-1">
                  <Button
                    type="button"
                    variant="outline"
                    size="lg"
                    shape="pill"
                    onClick={() => setMode('scan')}
                  >
                    <ScanLine aria-hidden="true" />
                    Ler QR code
                  </Button>
                  <Button
                    type="button"
                    variant="ghost"
                    size="lg"
                    shape="pill"
                    onClick={() => startOver('choose')}
                  >
                    <X aria-hidden="true" />
                    Cancelar
                  </Button>
                </div>
              </form>
            ) : (
              <div className="grid gap-6 md:grid-cols-[minmax(0,1fr)_auto] md:items-center">
                <div className="flex items-start gap-4">
                  <span className="hidden size-12 shrink-0 items-center justify-center rounded-full bg-primary-soft text-primary-accent sm:flex">
                    <ScanLine aria-hidden="true" className="size-6" />
                  </span>
                  <div>
                    <h2
                      id="validation-entry-title"
                      className="font-display text-xl font-bold leading-tight"
                    >
                      Ler o benefício do cliente
                    </h2>
                    <p className="mt-1.5 max-w-xl text-[0.9375rem] leading-7 text-muted-foreground">
                      Peça para o cliente abrir o benefício no app e mostrar o QR code. A câmera
                      abre aqui mesmo, nesta página.
                    </p>
                  </div>
                </div>
                <div className="flex flex-col gap-3 sm:flex-row md:flex-col lg:flex-row">
                  <Button type="button" size="2xl" shape="pill" onClick={() => setMode('scan')}>
                    <ScanLine aria-hidden="true" />
                    Ler QR code
                  </Button>
                  <Button
                    type="button"
                    variant="outline"
                    size="2xl"
                    shape="pill"
                    onClick={() => setMode('type')}
                  >
                    <Keyboard aria-hidden="true" />
                    Digitar código
                  </Button>
                </div>
              </div>
            )}
          </section>
        ) : null}

        {canValidate && previewStage ? (
          <section
            aria-label="Benefício apresentado"
            className="grid gap-5 lg:grid-cols-[minmax(0,1fr)_20rem] lg:items-start"
          >
            <PresentedBenefit preview={previewStage.preview} />

            <aside className="rounded-card border border-success/25 bg-success-soft p-5 sm:p-6 lg:sticky lg:top-24">
              <h2
                ref={outcomeHeadingRef}
                tabIndex={-1}
                className="flex items-center gap-2 font-display text-lg font-bold outline-none"
              >
                <CheckCircle2 aria-hidden="true" className="size-6 text-success" />
                Apresentação válida
              </h2>
              <p className="mt-2 text-sm leading-6 text-foreground">
                Confira o titular e o benefício antes de confirmar.
              </p>
              <p className="mt-4 font-display text-3xl font-extrabold tabular-nums">
                {previewStage.preview.benefit.remaining_redemptions}
              </p>
              <p className="text-sm text-foreground">
                {previewStage.preview.benefit.remaining_redemptions === 1
                  ? 'utilização restante'
                  : 'utilizações restantes'}
              </p>

              {previewStage.name === 'confirm_failed' ? (
                <p
                  role="alert"
                  className="mt-4 flex items-start gap-2 rounded-2xl bg-card p-3 text-sm font-semibold leading-6 text-warning-accent"
                >
                  <AlertTriangle aria-hidden="true" className="mt-1 size-4 shrink-0" />
                  {previewStage.problem === 'session'
                    ? REQUEST_PROBLEMS.session.message
                    : CONFIRMATION_NOT_COMPLETED}
                </p>
              ) : null}

              {previewStage.name === 'confirm_failed' && previewStage.problem !== 'session' ? (
                <Button
                  type="button"
                  variant="cta"
                  size="2xl"
                  shape="pill"
                  className="mt-5 w-full"
                  onClick={() => void validation.confirm()}
                >
                  <RotateCcw aria-hidden="true" />
                  Tentar de novo
                </Button>
              ) : previewStage.name !== 'confirm_failed' ? (
                <ConfirmDialog
                  open={dialogOpen}
                  onOpenChange={setDialogOpen}
                  title="Confirmar utilização?"
                  description={`Benefício de ${previewStage.preview.holder.full_name} em ${previewStage.preview.benefit.establishment_name}. Depois de confirmar, o comprovante é emitido e o uso não pode ser desfeito.`}
                  confirmLabel="Confirmar utilização"
                  processing={previewStage.name === 'confirming'}
                  onConfirm={() => {
                    setDialogOpen(false)
                    void validation.confirm()
                  }}
                  trigger={
                    <Button
                      type="button"
                      variant="cta"
                      size="2xl"
                      shape="pill"
                      className="mt-5 w-full"
                      disabled={previewStage.name === 'confirming'}
                      aria-busy={previewStage.name === 'confirming'}
                    >
                      {previewStage.name === 'confirming' ? (
                        <Loader2 aria-hidden="true" className="animate-spin" />
                      ) : (
                        <CheckCircle2 aria-hidden="true" />
                      )}
                      {previewStage.name === 'confirming' ? 'Confirmando…' : 'Confirmar utilização'}
                    </Button>
                  }
                />
              ) : null}

              <Button
                type="button"
                variant="outline"
                size="xl"
                shape="pill"
                className="mt-3 w-full"
                disabled={previewStage.name === 'confirming'}
                onClick={() => startOver(mode)}
              >
                <ScanLine aria-hidden="true" />
                Conferir outro
              </Button>
            </aside>
          </section>
        ) : null}

        {canValidate && stage.name === 'receipt' ? (
          <ReceiptPanel
            receipt={stage.receipt}
            replay={stage.replay}
            headingRef={outcomeHeadingRef}
            onScan={() => startOver('scan')}
            onType={() => startOver('type')}
          />
        ) : null}

        {canValidate && stage.name === 'refused' ? (
          <RefusalPanel
            refusal={stage.refusal}
            headingRef={outcomeHeadingRef}
            onScan={() => startOver('scan')}
            onType={() => startOver('type')}
          />
        ) : null}
      </div>
    </MainLayout>
  )
}
