import { ArrowRight, LoaderCircle, Save } from 'lucide-react'

import { Button } from '~/components/ui/button'

interface PendingChangesNoticeProps {
  dirtySectionCount: number
  firstSectionLabel?: string
  busy: boolean
  onReview: () => void
}

export function PendingChangesNotice({
  dirtySectionCount,
  firstSectionLabel,
  busy,
  onReview,
}: PendingChangesNoticeProps) {
  const hasDirtySections = dirtySectionCount > 0

  if (!hasDirtySections && !busy) return null

  return (
    <div
      data-editor-pending-notice
      role={hasDirtySections ? 'alert' : 'status'}
      aria-live="polite"
      aria-atomic="true"
      className="flex flex-col gap-4 rounded-xl border border-warning/25 bg-warning/10 px-4 py-4 sm:flex-row sm:items-center sm:justify-between"
    >
      <div className="flex min-w-0 items-start gap-3">
        <span className="mt-0.5 flex size-9 shrink-0 items-center justify-center rounded-lg bg-background/75 text-warning-foreground ring-1 ring-warning/20">
          {busy ? <LoaderCircle className="size-4 animate-spin" /> : <Save className="size-4" />}
        </span>
        <div className="min-w-0">
          <p className="font-semibold">
            {hasDirtySections
              ? 'Salve as alterações antes de enviar a ficha'
              : 'Atualizando os dados da unidade…'}
          </p>
          <p className="mt-1 text-sm leading-5 text-muted-foreground">
            {hasDirtySections
              ? `${dirtySectionCount} ${dirtySectionCount === 1 ? 'etapa possui' : 'etapas possuem'} mudanças locais. O envio para moderação considera apenas os dados já salvos no servidor.`
              : 'Aguarde a operação atual terminar para continuar com segurança.'}
          </p>
        </div>
      </div>

      {hasDirtySections ? (
        <Button type="button" variant="outline" disabled={busy} onClick={onReview}>
          Revisar {firstSectionLabel ?? 'alterações'}
          <ArrowRight />
        </Button>
      ) : null}
    </div>
  )
}
