import { router } from '@inertiajs/react'
import { Check, ImagePlus, Loader2, Star, Trash2 } from 'lucide-react'
import { useState, type FormEvent } from 'react'

import { ConfirmDialog } from '~/components/confirm_dialog'
import { Button } from '~/components/ui/button'
import { Input } from '~/components/ui/input'
import { Textarea } from '~/components/ui/textarea'
import {
  partnerContentMediaStatusMeta,
  type PartnerContentMediaItem,
} from '~/lib/partner_content_media'
import type { PartnerContentPath } from '~/lib/partner_content'
import { cn } from '~/lib/utils'

interface PartnerContentMediaManagerProps {
  tenantId: number
  kind: PartnerContentPath
  contentId: number
  media: PartnerContentMediaItem[]
  editable: boolean
}

async function responseError(response: Response, fallback: string): Promise<string> {
  const payload = (await response.json().catch(() => null)) as {
    message?: string
    errors?: Array<{ message?: string }>
  } | null
  return payload?.message || payload?.errors?.[0]?.message || fallback
}

export function PartnerContentMediaManager({
  tenantId,
  kind,
  contentId,
  media,
  editable,
}: PartnerContentMediaManagerProps) {
  const [uploading, setUploading] = useState(false)
  const [actionId, setActionId] = useState<number | null>(null)
  const [error, setError] = useState<string | null>(null)

  function reloadContent(): Promise<void> {
    return new Promise((resolve) => {
      router.reload({ only: ['content'], onFinish: () => resolve() })
    })
  }

  async function upload(event: FormEvent<HTMLFormElement>) {
    event.preventDefault()
    if (!editable || uploading) return

    const form = event.currentTarget
    const fileInput = form.elements.namedItem('file') as HTMLInputElement | null
    const altInput = form.elements.namedItem('alt_text') as HTMLInputElement | null
    const captionInput = form.elements.namedItem('caption') as HTMLTextAreaElement | null
    const coverInput = form.elements.namedItem('is_cover') as HTMLInputElement | null
    const file = fileInput?.files?.[0] ?? null
    const altText = altInput?.value.trim() ?? ''

    if (!file || file.size === 0) {
      setError('Escolha uma imagem JPEG, PNG ou WebP.')
      return
    }
    if (!altText) {
      setError('Descreva a imagem para acessibilidade antes de enviar.')
      return
    }

    const formData = new window.FormData()
    formData.append('file', file, file.name)
    formData.append('alt_text', altText)
    const caption = captionInput?.value.trim() ?? ''
    if (caption) formData.append('caption', caption)
    if (coverInput?.checked) formData.append('is_cover', 'true')

    setUploading(true)
    setError(null)

    try {
      const response = await fetch('/api/v1/portal/content/' + kind + '/' + contentId + '/media', {
        method: 'POST',
        credentials: 'same-origin',
        headers: {
          'Accept': 'application/json',
          'x-tenant-id': String(tenantId),
        },
        body: formData,
      })
      if (!response.ok) {
        throw new Error(await responseError(response, 'Não foi possível enviar a imagem.'))
      }

      form.reset()
      await reloadContent()
    } catch (cause) {
      setError(cause instanceof Error ? cause.message : 'Falha ao enviar a imagem.')
    } finally {
      setUploading(false)
    }
  }

  async function setCover(mediaId: number) {
    if (!editable || actionId !== null) return
    setActionId(mediaId)
    setError(null)

    try {
      const response = await fetch(
        '/api/v1/portal/content/' + kind + '/' + contentId + '/media/' + mediaId + '/cover',
        {
          method: 'PATCH',
          credentials: 'same-origin',
          headers: {
            'Accept': 'application/json',
            'x-tenant-id': String(tenantId),
          },
        }
      )
      if (!response.ok) {
        throw new Error(await responseError(response, 'Não foi possível definir a capa.'))
      }
      await reloadContent()
    } catch (cause) {
      setError(cause instanceof Error ? cause.message : 'Falha ao definir a capa.')
    } finally {
      setActionId(null)
    }
  }

  async function remove(mediaId: number) {
    if (!editable || actionId !== null) return
    setActionId(mediaId)
    setError(null)

    try {
      const response = await fetch(
        '/api/v1/portal/content/' + kind + '/' + contentId + '/media/' + mediaId,
        {
          method: 'DELETE',
          credentials: 'same-origin',
          headers: {
            'Accept': 'application/json',
            'x-tenant-id': String(tenantId),
          },
        }
      )
      if (!response.ok) {
        throw new Error(await responseError(response, 'Não foi possível remover a imagem.'))
      }
      await reloadContent()
    } catch (cause) {
      setError(cause instanceof Error ? cause.message : 'Falha ao remover a imagem.')
    } finally {
      setActionId(null)
    }
  }

  return (
    <div className="mt-5 border-t border-border pt-5">
      <div className="flex items-start justify-between gap-3">
        <div>
          <p className="text-sm font-bold">Imagens</p>
          <p className="mt-0.5 text-xs leading-5 text-muted-foreground">
            JPEG, PNG ou WebP de até 10 MB. Só imagens aprovadas aparecem para o público.
          </p>
        </div>
        <span className="text-xs font-medium text-muted-foreground">
          {media.length} {media.length === 1 ? 'imagem' : 'imagens'}
        </span>
      </div>

      {media.length > 0 ? (
        <div className="mt-4 grid gap-3 sm:grid-cols-2">
          {media.map((item) => {
            const status = partnerContentMediaStatusMeta[item.moderationStatus]
            const busy = actionId === item.id
            return (
              <article
                key={item.id}
                className="overflow-hidden rounded-md border border-border bg-background"
              >
                <div className="relative aspect-[16/10] overflow-hidden bg-muted">
                  <img
                    src={item.asset.url}
                    alt={item.altText}
                    loading="lazy"
                    className="size-full object-cover"
                  />
                  {item.isCover ? (
                    <span className="absolute left-2 top-2 inline-flex items-center gap-1 rounded-full bg-background/90 px-2 py-1 text-[0.68rem] font-bold shadow-sm backdrop-blur">
                      <Star aria-hidden="true" className="size-3 fill-current" />
                      Capa
                    </span>
                  ) : null}
                </div>
                <div className="space-y-3 p-3">
                  <span
                    className={cn(
                      'inline-flex rounded-full border px-2 py-0.5 text-[0.68rem] font-semibold',
                      status.className
                    )}
                  >
                    {status.label}
                  </span>
                  <div>
                    <p className="text-xs font-semibold">Texto alternativo</p>
                    <p className="mt-0.5 text-xs leading-5 text-muted-foreground">{item.altText}</p>
                    {item.caption ? (
                      <p className="mt-1 text-xs leading-5 text-muted-foreground">{item.caption}</p>
                    ) : null}
                    {item.reviewNotes ? (
                      <p className="mt-2 rounded-md bg-destructive/10 px-2 py-1.5 text-xs text-destructive">
                        {item.reviewNotes}
                      </p>
                    ) : null}
                  </div>

                  {editable ? (
                    <div className="flex flex-wrap gap-2">
                      {!item.isCover &&
                      item.moderationStatus !== 'rejected' &&
                      item.moderationStatus !== 'quarantined' ? (
                        <Button
                          type="button"
                          variant="outline"
                          size="sm"
                          disabled={actionId !== null}
                          onClick={() => void setCover(item.id)}
                        >
                          {busy ? (
                            <Loader2 aria-hidden="true" className="size-3.5 animate-spin" />
                          ) : (
                            <Star aria-hidden="true" className="size-3.5" />
                          )}
                          Definir capa
                        </Button>
                      ) : null}

                      <ConfirmDialog
                        title="Remover esta imagem?"
                        description="Ela será desvinculada deste conteúdo. Se nenhum outro recurso usar o mesmo arquivo, o objeto também será removido do armazenamento."
                        confirmLabel="Remover imagem"
                        destructive
                        processing={busy}
                        onConfirm={() => void remove(item.id)}
                        trigger={
                          <Button
                            type="button"
                            variant="ghost"
                            size="sm"
                            disabled={actionId !== null}
                          >
                            <Trash2 aria-hidden="true" className="size-3.5" />
                            Remover
                          </Button>
                        }
                      />
                    </div>
                  ) : null}
                </div>
              </article>
            )
          })}
        </div>
      ) : null}

      {editable ? (
        <form
          onSubmit={(event) => void upload(event)}
          aria-busy={uploading}
          className="mt-4 grid gap-3 rounded-md border border-dashed border-border p-4"
        >
          <label className="grid gap-1.5 text-sm font-medium">
            Imagem
            <Input
              name="file"
              type="file"
              accept="image/jpeg,image/png,image/webp"
              disabled={uploading}
            />
          </label>
          <label className="grid gap-1.5 text-sm font-medium">
            Texto alternativo
            <Input
              name="alt_text"
              maxLength={180}
              placeholder="Ex.: Mesa posta para degustação de cafés"
              disabled={uploading}
            />
          </label>
          <label className="grid gap-1.5 text-sm font-medium">
            Legenda
            <Textarea
              name="caption"
              rows={2}
              maxLength={500}
              placeholder="Opcional"
              disabled={uploading}
            />
          </label>
          <label className="flex items-center gap-2 text-sm">
            <input
              name="is_cover"
              type="checkbox"
              value="true"
              className="size-4 accent-primary"
              disabled={uploading}
            />
            Usar como capa deste conteúdo
          </label>

          {error ? (
            <p role="alert" className="text-sm text-destructive">
              {error}
            </p>
          ) : null}

          <div className="flex justify-end">
            <Button type="submit" size="sm" disabled={uploading}>
              {uploading ? (
                <Loader2 aria-hidden="true" className="size-3.5 animate-spin" />
              ) : (
                <ImagePlus aria-hidden="true" className="size-3.5" />
              )}
              {uploading ? 'Enviando…' : 'Enviar imagem'}
            </Button>
          </div>
        </form>
      ) : null}

      {!editable && media.some((item) => item.moderationStatus === 'approved') ? (
        <p className="mt-3 inline-flex items-center gap-1 text-xs text-success">
          <Check aria-hidden="true" className="size-3.5" />
          Imagens aprovadas permanecem disponíveis na descoberta.
        </p>
      ) : null}
    </div>
  )
}
