import { ImagePlus, Images, Star, Trash2 } from 'lucide-react'
import { useRef, useState } from 'react'

import { EditorSection, type EditorDisplayIssue } from '~/components/portal/editor_section'
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
} from '~/components/ui/alert-dialog'
import { Badge } from '~/components/ui/badge'
import { Button } from '~/components/ui/button'
import { Input } from '~/components/ui/input'
import {
  asRecord,
  booleanValue,
  numberValue,
  stringValue,
  type JsonRecord,
} from '~/lib/establishment_editor'
import { cn } from '~/lib/utils'
import { EditorField, editorSelectClassName } from './editor_field'
import type { EstablishmentMediaEditor } from './use_media_editor'

const mediaStatusMeta: Record<string, { label: string; className: string }> = {
  pending: {
    label: 'Pendente',
    className: 'border-warning/25 bg-warning/10 text-warning-foreground',
  },
  approved: {
    label: 'Aprovada',
    className: 'border-success/25 bg-success/10 text-success',
  },
  rejected: {
    label: 'Rejeitada',
    className: 'border-destructive/25 bg-destructive/10 text-destructive',
  },
  quarantined: {
    label: 'Em quarentena',
    className: 'border-destructive/25 bg-destructive/10 text-destructive',
  },
}

const mediaPurposeLabels: Record<string, string> = {
  gallery: 'Galeria',
  logo: 'Logo',
  menu: 'Cardápio',
  interior: 'Ambiente interno',
  exterior: 'Fachada',
  product: 'Produto',
  team: 'Equipe',
  service: 'Serviço',
}

interface MediaSectionProps {
  media: JsonRecord[]
  editable: boolean
  blocked?: boolean
  issues: EditorDisplayIssue[]
  editor: EstablishmentMediaEditor
}

export function MediaSection({
  media,
  editable,
  blocked = false,
  issues,
  editor,
}: MediaSectionProps) {
  const [pendingDeleteId, setPendingDeleteId] = useState<number | null>(null)
  const uploadFormRef = useRef<HTMLFormElement>(null)
  const controlsDisabled = blocked || editor.busy
  const pendingDelete = media.find((item) => Number(item.id) === pendingDeleteId)

  function clearUploadDraft() {
    uploadFormRef.current?.reset()
    editor.resetUploadDraft()
  }

  function confirmDelete() {
    if (pendingDeleteId === null) return
    const mediaId = pendingDeleteId
    setPendingDeleteId(null)
    void editor.deleteMedia(mediaId)
  }

  return (
    <EditorSection
      id="media"
      icon={Images}
      title="Mídia da unidade"
      description="Envie imagens representativas, escolha a capa e acompanhe o status de moderação de cada item."
      issues={issues}
      toolbar={
        <Badge variant="secondary" appearance="light" size="sm">
          {media.length} {media.length === 1 ? 'imagem' : 'imagens'}
        </Badge>
      }
    >
      <div className="space-y-6 p-5 sm:p-6" aria-busy={controlsDisabled}>
        {editable ? (
          <form
            ref={uploadFormRef}
            onSubmit={editor.uploadMedia}
            onChange={editor.markUploadDraftDirty}
            className="space-y-4 rounded-xl border border-dashed border-border bg-muted/20 p-4 sm:p-5"
          >
            <div className="flex items-start gap-3">
              <span className="flex size-10 shrink-0 items-center justify-center rounded-xl bg-primary/10 text-primary">
                <ImagePlus className="size-5" />
              </span>
              <div>
                <p className="text-sm font-semibold">Adicionar imagem</p>
                <p className="mt-1 text-xs leading-5 text-muted-foreground">
                  JPEG, PNG ou WebP de até 10 MB. Toda nova imagem começa pendente de moderação.
                </p>
              </div>
            </div>

            <div className="grid gap-4 md:grid-cols-2">
              <EditorField htmlFor="media-file" label="Arquivo" required>
                <Input
                  id="media-file"
                  type="file"
                  name="file"
                  required
                  accept="image/jpeg,image/png,image/webp"
                  disabled={controlsDisabled}
                  className="h-auto py-2 file:me-3 file:rounded-md file:border-0 file:bg-primary/10 file:px-3 file:py-1.5 file:text-sm file:font-medium file:text-primary"
                />
              </EditorField>
              <EditorField htmlFor="media-purpose" label="Uso da imagem">
                <select
                  id="media-purpose"
                  name="purpose"
                  value={editor.uploadPurpose}
                  disabled={controlsDisabled}
                  onChange={(event) => editor.setUploadPurpose(event.target.value)}
                  className={editorSelectClassName}
                >
                  {Object.entries(mediaPurposeLabels).map(([value, label]) => (
                    <option key={value} value={value}>
                      {label}
                    </option>
                  ))}
                </select>
              </EditorField>
              <EditorField
                htmlFor="media-alt"
                label="Texto alternativo"
                hint="até 180 caracteres"
                required
              >
                <Input
                  id="media-alt"
                  variant="lg"
                  name="alt_text"
                  required
                  maxLength={180}
                  disabled={controlsDisabled}
                  placeholder="Descreva objetivamente o conteúdo da imagem"
                />
              </EditorField>
              <EditorField htmlFor="media-caption" label="Legenda" hint="opcional">
                <Input
                  id="media-caption"
                  variant="lg"
                  name="caption"
                  maxLength={500}
                  disabled={controlsDisabled}
                  placeholder="Contexto adicional exibido junto à imagem"
                />
              </EditorField>
            </div>

            <label className="flex cursor-pointer items-start gap-3 rounded-lg border border-border/70 bg-background px-3 py-3">
              <input
                type="checkbox"
                name="is_cover"
                value="true"
                checked={editor.uploadAsCover}
                disabled={controlsDisabled}
                onChange={(event) => editor.setUploadAsCover(event.target.checked)}
                className="mt-0.5 size-4 rounded border-input accent-primary"
              />
              <span>
                <span className="block text-sm font-medium">Usar como capa da unidade</span>
                <span className="mt-0.5 block text-xs text-muted-foreground">
                  A capa atual será substituída. A imagem precisa continuar elegível após a
                  moderação.
                </span>
              </span>
            </label>

            <div className="flex flex-wrap items-center gap-3">
              {editor.uploadDraftDirty ? (
                <Button
                  type="button"
                  variant="outline"
                  disabled={controlsDisabled}
                  onClick={clearUploadDraft}
                >
                  Limpar formulário
                </Button>
              ) : null}
              <Button type="submit" disabled={controlsDisabled}>
                <ImagePlus />
                {editor.uploading ? 'Enviando…' : 'Adicionar imagem'}
              </Button>
              {editor.uploadError ? (
                <p className="text-sm text-destructive" role="alert">
                  {editor.uploadError}
                </p>
              ) : null}
            </div>
          </form>
        ) : null}

        {editor.mediaActionError ? (
          <p
            role="alert"
            className="rounded-lg border border-destructive/20 bg-destructive/10 px-3 py-2 text-sm text-destructive"
          >
            {editor.mediaActionError}
          </p>
        ) : null}

        {media.length === 0 ? (
          <div className="rounded-xl border border-dashed border-border px-5 py-10 text-center">
            <Images className="mx-auto size-7 text-muted-foreground" />
            <p className="mt-3 text-sm font-medium">Nenhuma imagem adicionada</p>
            <p className="mx-auto mt-1 max-w-lg text-sm leading-6 text-muted-foreground">
              Adicione imagens reais da unidade. A primeira imagem é escolhida como capa por padrão.
            </p>
          </div>
        ) : (
          <div className="grid gap-4 sm:grid-cols-2 xl:grid-cols-3">
            {media.map((item) => {
              const id = Number(item.id)
              const asset = asRecord(item.asset)
              const file = asRecord(asset?.file)
              const url = stringValue(file, 'url') || stringValue(asset, 'url')
              const status = stringValue(item, 'moderation_status', 'pending')
              const purpose = stringValue(item, 'purpose', 'gallery')
              const isCover = booleanValue(item, 'is_cover')
              const canBecomeCover = !['rejected', 'quarantined'].includes(status)
              const actionRunning = editor.mediaAction?.id === id
              const width = numberValue(asset, 'width')
              const height = numberValue(asset, 'height')
              const statusBadge = mediaStatusMeta[status] ?? {
                label: status,
                className: 'border-border bg-muted text-muted-foreground',
              }

              return (
                <article
                  key={id}
                  className={cn(
                    'overflow-hidden rounded-xl border bg-background',
                    isCover ? 'border-primary/40 ring-1 ring-primary/15' : 'border-border/70'
                  )}
                >
                  <div className="relative aspect-[4/3] bg-muted">
                    {url ? (
                      <img
                        src={url}
                        alt={stringValue(item, 'alt_text', 'Imagem da unidade')}
                        className="size-full object-cover"
                        loading="lazy"
                      />
                    ) : (
                      <div className="flex size-full items-center justify-center text-muted-foreground">
                        <Images className="size-8" />
                      </div>
                    )}
                    <div className="absolute inset-x-0 top-0 flex items-start justify-between gap-2 p-3">
                      <span
                        className={cn(
                          'rounded-full border px-2.5 py-1 text-[0.68rem] font-semibold',
                          statusBadge.className
                        )}
                      >
                        {statusBadge.label}
                      </span>
                      {isCover ? (
                        <span className="inline-flex items-center gap-1 rounded-full bg-primary px-2.5 py-1 text-[0.68rem] font-semibold text-primary-foreground">
                          <Star className="size-3 fill-current" />
                          Capa
                        </span>
                      ) : null}
                    </div>
                  </div>

                  <div className="space-y-3 p-4">
                    <div>
                      <div className="flex flex-wrap items-center gap-2">
                        <p className="text-sm font-semibold">
                          {mediaPurposeLabels[purpose] ?? purpose}
                        </p>
                        {width !== null && height !== null ? (
                          <span className="text-xs text-muted-foreground">
                            {width} × {height} px
                          </span>
                        ) : null}
                      </div>
                      <p className="mt-1 line-clamp-2 text-xs leading-5 text-muted-foreground">
                        {stringValue(item, 'alt_text', 'Sem texto alternativo')}
                      </p>
                    </div>

                    {stringValue(item, 'review_notes') ? (
                      <p className="rounded-lg bg-destructive/10 px-3 py-2 text-xs leading-5 text-destructive">
                        {stringValue(item, 'review_notes')}
                      </p>
                    ) : null}

                    {editable ? (
                      <div className="flex flex-wrap gap-2 border-t border-border/60 pt-3">
                        <Button
                          type="button"
                          variant="outline"
                          size="sm"
                          disabled={controlsDisabled || isCover || !canBecomeCover || actionRunning}
                          onClick={() => editor.setMediaCover(id)}
                        >
                          <Star />
                          {actionRunning && editor.mediaAction?.kind === 'cover'
                            ? 'Definindo…'
                            : isCover
                              ? 'Capa atual'
                              : 'Definir capa'}
                        </Button>
                        <Button
                          type="button"
                          variant="outline"
                          size="sm"
                          disabled={controlsDisabled || actionRunning}
                          className="text-destructive hover:text-destructive"
                          onClick={() => setPendingDeleteId(id)}
                        >
                          <Trash2 />
                          {actionRunning && editor.mediaAction?.kind === 'delete'
                            ? 'Removendo…'
                            : 'Remover'}
                        </Button>
                      </div>
                    ) : null}
                  </div>
                </article>
              )
            })}
          </div>
        )}

        <AlertDialog
          open={pendingDeleteId !== null}
          onOpenChange={(open) => {
            if (!open && !controlsDisabled) setPendingDeleteId(null)
          }}
        >
          <AlertDialogContent>
            <AlertDialogHeader>
              <AlertDialogTitle>Remover esta imagem?</AlertDialogTitle>
              <AlertDialogDescription>
                A imagem “{stringValue(pendingDelete ?? null, 'alt_text', 'sem descrição')}” será
                removida da revisão atual. Essa ação não pode ser desfeita.
              </AlertDialogDescription>
            </AlertDialogHeader>
            <AlertDialogFooter>
              <AlertDialogCancel disabled={controlsDisabled}>Cancelar</AlertDialogCancel>
              <AlertDialogAction
                variant="destructive"
                disabled={controlsDisabled}
                onClick={confirmDelete}
              >
                <Trash2 />
                Remover imagem
              </AlertDialogAction>
            </AlertDialogFooter>
          </AlertDialogContent>
        </AlertDialog>
      </div>
    </EditorSection>
  )
}
