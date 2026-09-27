import { Flag } from 'lucide-react'
import { useId, useState, type FormEvent, type ReactNode } from 'react'

import { Button } from '~/components/ui/button'
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
} from '~/components/ui/dialog'
import { Textarea } from '~/components/ui/textarea'
import {
  PUBLIC_REPORT_REASONS,
  PUBLIC_REPORT_TITLES,
  submitPublicReport,
  type PublicReportReason,
  type PublicReportTarget,
} from '~/lib/public_reports'
import { cn } from '~/lib/utils'

interface ReportDialogProps {
  targetType: PublicReportTarget
  targetId: number
  /** What the report is about, read by screen readers on the trigger. */
  subject: string
  trigger?: ReactNode
  className?: string
}

/**
 * Anonymous report from the public web page — W10 of the web audit.
 *
 * The trigger is quiet on purpose: reporting must be findable, never the most
 * prominent thing on a place's page. The form asks for a reason first, keeps
 * the details optional and answers with the protocol, as the app does.
 */
export function ReportDialog({
  targetType,
  targetId,
  subject,
  trigger,
  className,
}: ReportDialogProps) {
  const id = useId()
  const [open, setOpen] = useState(false)
  const [reason, setReason] = useState<PublicReportReason | null>(null)
  const [details, setDetails] = useState('')
  const [sending, setSending] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const [protocol, setProtocol] = useState<string | null>(null)

  function reset(nextOpen: boolean) {
    setOpen(nextOpen)
    if (!nextOpen) {
      setReason(null)
      setDetails('')
      setError(null)
      setProtocol(null)
    }
  }

  async function onSubmit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault()
    if (!reason || sending) return
    setSending(true)
    setError(null)
    const result = await submitPublicReport({ targetType, targetId, reason, details })
    setSending(false)
    if (result.ok) setProtocol(result.protocol)
    else setError(result.message)
  }

  const title = PUBLIC_REPORT_TITLES[targetType]

  return (
    <Dialog open={open} onOpenChange={reset}>
      <DialogTrigger asChild>
        {trigger ?? (
          <button
            type="button"
            aria-label={`${title}: ${subject}`}
            className={cn(
              'inline-flex min-h-11 items-center gap-1.5 rounded-full px-2 text-sm font-semibold text-muted-foreground outline-none transition-colors hover:text-foreground focus-visible:ring-2 focus-visible:ring-ring motion-reduce:transition-none',
              className
            )}
          >
            <Flag aria-hidden="true" className="size-4" />
            {title}
          </button>
        )}
      </DialogTrigger>
      <DialogContent className="max-w-lg rounded-card">
        <DialogHeader>
          <DialogTitle className="font-display text-xl font-extrabold leading-tight">
            {title}
          </DialogTitle>
          <DialogDescription>
            {protocol === null
              ? `Sobre: ${subject}. A denúncia é anônima: não fica ligada a você nem a uma conta.`
              : 'A moderação do Experimente+ analisa e responde dentro do prazo definido.'}
          </DialogDescription>
        </DialogHeader>

        {protocol !== null ? (
          <div className="flex flex-col items-start gap-3" role="status">
            <p className="font-display text-lg font-extrabold leading-tight">Denúncia registrada</p>
            {protocol ? (
              <p className="text-sm text-muted-foreground">
                Guarde o protocolo para acompanhar o caso:{' '}
                <strong className="font-mono text-base text-foreground">{protocol}</strong>
              </p>
            ) : null}
            <Button
              type="button"
              variant="primary"
              size="xl"
              shape="pill"
              onClick={() => reset(false)}
            >
              Fechar
            </Button>
          </div>
        ) : (
          <form onSubmit={onSubmit} className="flex flex-col gap-5">
            <fieldset className="flex flex-col gap-2">
              <legend className="mb-2 text-[0.9375rem] font-bold">Qual é o problema?</legend>
              {PUBLIC_REPORT_REASONS.map((option) => (
                <label
                  key={option.value}
                  className={cn(
                    'flex min-h-11 cursor-pointer items-center gap-3 rounded-2xl border px-4 text-[0.9375rem] transition-colors motion-reduce:transition-none',
                    reason === option.value
                      ? 'border-primary bg-primary-soft font-semibold text-primary-accent'
                      : 'border-input hover:bg-accent'
                  )}
                >
                  <input
                    type="radio"
                    name={`${id}-reason`}
                    value={option.value}
                    checked={reason === option.value}
                    onChange={() => setReason(option.value)}
                    className="size-4 accent-primary"
                  />
                  {option.label}
                </label>
              ))}
            </fieldset>

            <div className="flex flex-col gap-1.5">
              <label htmlFor={`${id}-details`} className="text-[0.9375rem] font-bold">
                Quer explicar melhor? (opcional)
              </label>
              <Textarea
                id={`${id}-details`}
                value={details}
                maxLength={4000}
                rows={3}
                onChange={(event) => setDetails(event.target.value)}
                className="rounded-2xl text-[0.9375rem] shadow-none"
              />
            </div>

            {error ? (
              <p role="alert" className="text-sm font-semibold text-destructive-accent">
                {error}
              </p>
            ) : null}

            <Button
              type="submit"
              variant="primary"
              size="xl"
              shape="pill"
              disabled={!reason || sending}
              className="self-start"
            >
              {sending ? 'Enviando…' : 'Enviar denúncia'}
            </Button>
          </form>
        )}
      </DialogContent>
    </Dialog>
  )
}
