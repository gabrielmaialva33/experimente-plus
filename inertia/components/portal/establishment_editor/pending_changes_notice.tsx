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
      className="flex flex-col gap-4 rounded-card border border-warning/30 bg-warning-soft px-5 py-4 sm:flex-row sm:items-center sm:justify-between"
    >
      <div className="flex min-w-0 items-start gap-3">
        <span className="mt-0.5 flex size-9 shrink-0 items-center justify-center rounded-xl bg-background/75 text-warning-accent ring-1 ring-warning/20">
          {busy ? <LoaderCircle className="size-4 animate-spin" /> : <Save className="size-4" />}
        </span>
        <div className="min-w-0">
          <p className="font-semibold">
            {hasDirtySections
              ? 'Salve as alterações antes de enviar para análise'
              : 'Atualizando os dados do lugar…'}
          </p>
          <p className="mt-1 text-sm leading-5 text-muted-foreground">
            {hasDirtySections
              ? `${dirtySectionCount} ${dirtySectionCount === 1 ? 'etapa possui' : 'etapas possuem'} alterações não salvas. Só o que foi salvo vai para a análise.`
              : 'Aguarde a operação atual terminar para continuar com segurança.'}
          </p>
        </div>
      </div>

      {hasDirtySections ? (
        <Button type="button" variant="outline" shape="pill" disabled={busy} onClick={onReview}>
          Revisar {firstSectionLabel ?? 'alterações'}
          <ArrowRight />
        </Button>
      ) : null}
    </div>
  )
}
