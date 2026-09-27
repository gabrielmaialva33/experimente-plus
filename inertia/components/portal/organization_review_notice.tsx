import { AlertTriangle, Ban, Clock3 } from 'lucide-react'

import { formatDateTime } from '~/lib/labels'
import { cn } from '~/lib/utils'

interface OrganizationReviewNoticeProps {
  status: string
  reviewNotes?: string | null
  submittedAt?: string | null
  reviewedAt?: string | null
  /** One short block for the overview card instead of the full explanation. */
  compact?: boolean
  className?: string
}

/**
 * Where the organization stands with the Experimente+ team, as the business
 * reads it in the Portal: waiting, asked to correct (with the team's reason)
 * or closed. An active organization shows nothing: there is nothing to do.
 */
export function OrganizationReviewNotice({
  status,
  reviewNotes,
  submittedAt,
  reviewedAt,
  compact = false,
  className,
}: OrganizationReviewNoticeProps) {
  const submitted = formatDateTime(submittedAt ?? null)
  const reviewed = formatDateTime(reviewedAt ?? null)

  const content =
    status === 'pending_review'
      ? {
          tone: 'info' as const,
          icon: Clock3,
          title: 'Em análise pela equipe do Experimente+',
          text: compact
            ? 'A resposta aparece aqui.'
            : `${submitted ? `Enviada em ${submitted}. ` : ''}A equipe confere a razão social, o CNPJ e os contatos. Até a resposta, a organização e os lugares ficam sem edição. A decisão aparece nesta página e na Visão geral.`,
        }
      : status === 'changes_requested'
        ? {
            tone: 'warning' as const,
            icon: AlertTriangle,
            title: 'A equipe pediu correções',
            text: compact
              ? null
              : 'Ajuste o que foi pedido em Dados da organização, salve e toque em Enviar para análise de novo.',
          }
        : status === 'rejected'
          ? {
              tone: 'destructive' as const,
              icon: Ban,
              title: 'Cadastro não aprovado',
              text: compact
                ? null
                : 'Esta organização não pode ser enviada de novo. Se tiver dúvida, fale com a equipe do Experimente+.',
            }
          : status === 'suspended'
            ? {
                tone: 'destructive' as const,
                icon: Ban,
                title: 'Organização suspensa',
                text: compact
                  ? null
                  : 'Os lugares desta organização estão fora do app e do site. Fale com a equipe do Experimente+.',
              }
            : null

  if (!content) return null
  const Icon = content.icon

  return (
    <section
      aria-label={content.title}
      className={cn(
        'flex items-start gap-3 rounded-card border',
        compact ? 'rounded-2xl p-3' : 'p-5',
        content.tone === 'info' && 'border-info/25 bg-info-soft',
        content.tone === 'warning' && 'border-warning/30 bg-warning-soft',
        content.tone === 'destructive' && 'border-destructive/25 bg-destructive-soft',
        className
      )}
    >
      <Icon
        aria-hidden="true"
        className={cn(
          'mt-0.5 shrink-0',
          compact ? 'size-4' : 'size-5',
          content.tone === 'info' && 'text-info-accent',
          content.tone === 'warning' && 'text-warning-accent',
          content.tone === 'destructive' && 'text-destructive-accent'
        )}
      />
      <div className="min-w-0">
        <p className={cn('font-bold', compact ? 'text-sm' : 'font-display text-lg')}>
          {content.title}
        </p>
        {reviewNotes ? (
          <blockquote
            className={cn(
              'mt-1 whitespace-pre-line text-foreground',
              compact ? 'line-clamp-3 text-sm' : 'text-[0.9375rem] leading-6'
            )}
          >
            “{reviewNotes}”
          </blockquote>
        ) : null}
        {!compact && reviewNotes && reviewed ? (
          <p className="mt-1 text-xs text-muted-foreground">Resposta de {reviewed}</p>
        ) : null}
        {content.text ? (
          <p className={cn('mt-1 leading-6', compact ? 'text-sm' : 'text-sm text-foreground')}>
            {content.text}
          </p>
        ) : null}
      </div>
    </section>
  )
}
