import { router } from '@inertiajs/react'
import { Check, Loader2, ShieldAlert, X } from 'lucide-react'
import { useState } from 'react'

import { Button } from '~/components/ui/button'
import { Textarea } from '~/components/ui/textarea'
import type { PartnerContentPath } from '~/lib/partner_content'
import {
  partnerContentMediaNoteClassName,
  partnerContentMediaStatusMeta,
  type PartnerContentMediaItem,
} from '~/lib/partner_content_media'
import { cn } from '~/lib/utils'

interface PartnerContentMediaModerationProps {
  tenantId: number
  kind: PartnerContentPath
  contentId: number
  media: PartnerContentMediaItem[]
  canApprove: boolean
  canReject: boolean
}

async function responseError(response: Response, fallback: string): Promise<string> {
  const payload = (await response.json().catch(() => null)) as {
    message?: string
    errors?: Array<{ message?: string }>
  } | null
  return payload?.message || payload?.errors?.[0]?.message || fallback
}

export function PartnerContentMediaModeration({
  tenantId,
  kind,
  contentId,
  media,
  canApprove,
  canReject,
}: PartnerContentMediaModerationProps) {
  const [actionId, setActionId] = useState<number | null>(null)
  const [rejectingId, setRejectingId] = useState<number | null>(null)
  const [reason, setReason] = useState('')
  const [error, setError] = useState<string | null>(null)
  // What the last decision did, read aloud once; the next action clears it.
  const [notice, setNotice] = useState<string | null>(null)

  // The queue page receives its rows as `sections` and its tab totals as `counts`.
  function reloadQueue(): Promise<void> {
    return new Promise((resolve) => {
      router.reload({ only: ['sections', 'counts'], onFinish: () => resolve() })
    })
  }

  async function decide(mediaId: number, action: 'approve' | 'reject') {
    if (actionId !== null) return
    const normalizedReason = reason.trim()
    if (action === 'reject' && !normalizedReason) {
      setError('Informe o motivo da recusa da imagem.')
      return
    }

    setActionId(mediaId)
    setError(null)
    setNotice(null)
    try {
      const response = await fetch(
        '/api/v1/admin/content/' + kind + '/' + contentId + '/media/' + mediaId + '/' + action,
        {
          method: 'POST',
          credentials: 'same-origin',
          headers: {
            'Accept': 'application/json',
            'Content-Type': 'application/json',
            'x-tenant-id': String(tenantId),
          },
          body: JSON.stringify(action === 'reject' ? { reason: normalizedReason } : {}),
        }
      )
      if (!response.ok) {
        throw new Error(
          await responseError(
            response,
            action === 'approve'
              ? 'Não foi possível aprovar a imagem.'
              : 'Não foi possível recusar a imagem.'
          )
        )
      }

      setRejectingId(null)
      setReason('')
      setNotice(
        action === 'approve'
          ? 'Imagem aprovada. Ela já pode aparecer na descoberta pública.'
          : 'Imagem recusada. O motivo volta para o parceiro.'
      )
      await reloadQueue()
    } catch (cause) {
      setError(cause instanceof Error ? cause.message : 'Falha ao moderar a imagem.')
    } finally {
      setActionId(null)
    }
  }

  if (media.length === 0) return null

  return (
    <div className="mt-5 border-t border-border pt-5">
      <div className="flex items-center gap-2">
        <ShieldAlert aria-hidden="true" className="size-4 text-primary" />
        <p className="text-sm font-bold">Mídia deste conteúdo</p>
      </div>
      <p className="mt-1 text-xs text-muted-foreground">
        A decisão da imagem é independente da decisão do texto. Só arquivos aprovados aparecem na
        descoberta pública.
      </p>

      <div className="mt-4 grid gap-3 md:grid-cols-2 xl:grid-cols-3">
        {media.map((item) => {
          const status = partnerContentMediaStatusMeta[item.moderationStatus]
          const busy = actionId === item.id
          return (
            <article
              key={item.id}
              className="overflow-hidden rounded-xl border border-border-subtle"
            >
              <div className="aspect-[16/10] overflow-hidden bg-muted">
                <img
                  src={item.asset.url}
                  alt={item.altText}
                  loading="lazy"
                  className="size-full object-cover"
                />
              </div>
              <div className="space-y-3 p-3">
                <div className="flex flex-wrap items-center justify-between gap-2">
                  <span
                    className={cn(
                      'inline-flex rounded-full border px-2 py-0.5 text-[0.68rem] font-semibold',
                      status.className
                    )}
                  >
                    {status.label}
                  </span>
                  {item.isCover ? (
                    <span className="text-[0.68rem] font-bold text-primary">Capa</span>
                  ) : null}
                </div>

                <div>
                  <p className="text-xs font-semibold">Texto alternativo</p>
                  <p className="mt-0.5 text-xs leading-5 text-muted-foreground">{item.altText}</p>
                  {item.caption ? (
                    <p className="mt-1 text-xs leading-5 text-muted-foreground">{item.caption}</p>
                  ) : null}
                  {item.reviewNotes ? (
                    <p
                      className={cn(
                        'mt-2 rounded-md px-2 py-1.5 text-xs leading-5',
                        partnerContentMediaNoteClassName(item.moderationStatus)
                      )}
                    >
                      <span className="font-semibold">Nota da moderação:</span> {item.reviewNotes}
                    </p>
                  ) : null}
                </div>

                {item.moderationStatus === 'pending' ? (
                  <div className="space-y-2">
                    <div className="flex flex-wrap gap-2">
                      {canApprove ? (
                        <Button
                          type="button"
                          size="md"
                          shape="pill"
                          disabled={actionId !== null}
                          onClick={() => void decide(item.id, 'approve')}
                        >
                          {busy ? (
                            <Loader2 aria-hidden="true" className="size-3.5 animate-spin" />
                          ) : (
                            <Check aria-hidden="true" className="size-3.5" />
                          )}
                          Aprovar imagem
                        </Button>
                      ) : null}
                      {canReject ? (
                        <Button
                          type="button"
                          variant="outline"
                          size="md"
                          shape="pill"
                          disabled={actionId !== null}
                          onClick={() => {
                            setRejectingId((current) => (current === item.id ? null : item.id))
                            setReason('')
                            setError(null)
                            setNotice(null)
                          }}
                        >
                          <X aria-hidden="true" className="size-3.5" />
                          Recusar imagem
                        </Button>
                      ) : null}
                    </div>

                    {rejectingId === item.id ? (
                      <div className="grid gap-2 rounded-md bg-background p-3">
                        <label
                          htmlFor={'partner-media-reason-' + item.id}
                          className="text-xs font-semibold"
                        >
                          Motivo da recusa
                        </label>
                        <Textarea
                          id={'partner-media-reason-' + item.id}
                          rows={2}
                          maxLength={2000}
                          value={reason}
                          onChange={(event) => setReason(event.target.value)}
                          placeholder="Explique objetivamente o que precisa ser corrigido."
                          disabled={busy}
                        />
                        <div className="flex justify-end">
                          <Button
                            type="button"
                            variant="destructive"
                            size="md"
                            shape="pill"
                            disabled={busy || !reason.trim()}
                            onClick={() => void decide(item.id, 'reject')}
                          >
                            Confirmar recusa
                          </Button>
                        </div>
                      </div>
                    ) : null}
                  </div>
                ) : null}
              </div>
            </article>
          )
        })}
      </div>

      <p
        role="status"
        aria-live="polite"
        className={cn('text-sm text-success', notice ? 'mt-3' : null)}
      >
        {notice}
      </p>
      {error ? (
        <p role="alert" className="mt-3 text-sm text-destructive">
          {error}
        </p>
      ) : null}
    </div>
  )
}
