import { Head, Link, router } from '@inertiajs/react'
import { ExternalLink, File as FileIcon, Trash2 } from 'lucide-react'
import { useState } from 'react'

import { ConfirmDialog } from '~/components/confirm_dialog'
import { EmptyState } from '~/components/empty_state'
import { FileUpload } from '~/components/file'
import { PageHeader } from '~/components/page_header'
import { Badge } from '~/components/ui/badge'
import { Button } from '~/components/ui/button'
import { Card, CardContent, CardHeader, CardHeading, CardTitle } from '~/components/ui/card'
import { useAuth } from '~/hooks/use_auth'
import { MainLayout } from '~/layouts'

interface FileRow {
  id: number
  client_name: string
  file_name: string
  file_size: number
  file_type: string
  file_category: string
  url: string
  owner: {
    id: number
    full_name: string
  }
  created_at: string | null
}

interface FilesPageProps {
  files: {
    meta: {
      total: number
      perPage: number
      currentPage: number
      lastPage: number
      firstPage: number
      nextPageUrl: string | null
      previousPageUrl: string | null
    }
    data: FileRow[]
  }
}

function formatFileSize(bytes: number): string {
  if (bytes <= 0) return '0 B'
  const units = ['B', 'KB', 'MB', 'GB']
  const index = Math.min(Math.floor(Math.log(bytes) / Math.log(1024)), units.length - 1)
  return `${(bytes / 1024 ** index).toFixed(index === 0 ? 0 : 1)} ${units[index]}`
}

function formatDate(value: string | null): string {
  if (!value) return '—'
  return new Date(value).toLocaleString('pt-BR', {
    dateStyle: 'medium',
    timeStyle: 'short',
  })
}

export default function FilesPage({ files }: FilesPageProps) {
  const { user, can } = useAuth()
  const canUpload = can('files.create')
  const canDeleteAny = can('files.delete')
  const canDeleteOwn = can('files.delete.own')
  const [fileToDelete, setFileToDelete] = useState<FileRow | null>(null)
  const [deleting, setDeleting] = useState(false)

  const deleteFile = () => {
    if (!fileToDelete || deleting) return
    setDeleting(true)
    router.delete(`/files/${fileToDelete.id}`, {
      preserveScroll: true,
      onFinish: () => {
        setDeleting(false)
        setFileToDelete(null)
      },
    })
  }

  return (
    <MainLayout>
      <Head title="Arquivos" />

      <ConfirmDialog
        open={fileToDelete !== null}
        onOpenChange={(open) => !open && !deleting && setFileToDelete(null)}
        title="Excluir arquivo?"
        description={`O arquivo “${fileToDelete?.client_name ?? ''}” deixará de ficar disponível nesta operação. Esta ação não pode ser desfeita.`}
        confirmLabel="Excluir arquivo"
        destructive
        processing={deleting}
        onConfirm={deleteFile}
      />

      <div className="space-y-6">
        <PageHeader
          title="Arquivos"
          description="Envie e administre arquivos privados da operação ativa."
        />

        {canUpload && (
          <Card>
            <CardHeader>
              <CardHeading>
                <CardTitle>Enviar arquivo</CardTitle>
                <p className="text-sm text-muted-foreground">
                  Selecione um arquivo compatível de até 10 MB.
                </p>
              </CardHeading>
            </CardHeader>
            <CardContent>
              <FileUpload />
            </CardContent>
          </Card>
        )}

        <Card>
          <CardHeader>
            <CardHeading>
              <CardTitle>Arquivos da operação</CardTitle>
              <p className="text-sm text-muted-foreground">
                {files.meta.total.toLocaleString('pt-BR')}{' '}
                {files.meta.total === 1 ? 'arquivo disponível' : 'arquivos disponíveis'}
              </p>
            </CardHeading>
          </CardHeader>
          <CardContent className="p-0">
            {files.data.length === 0 ? (
              <EmptyState
                icon={FileIcon}
                title="Nenhum arquivo disponível"
                description={
                  canUpload
                    ? 'Envie o primeiro arquivo desta operação.'
                    : 'Ainda não há arquivos que você possa consultar.'
                }
              />
            ) : (
              <div className="divide-y divide-border">
                {files.data.map((file) => {
                  const canDelete = canDeleteAny || (canDeleteOwn && file.owner.id === user?.id)

                  return (
                    <div
                      key={file.id}
                      className="flex flex-col gap-3 px-5 py-4 sm:flex-row sm:items-center"
                    >
                      <div className="flex size-10 shrink-0 items-center justify-center rounded-lg bg-primary/10 text-primary">
                        <FileIcon className="size-5" />
                      </div>

                      <div className="min-w-0 flex-1">
                        <div className="flex flex-wrap items-center gap-2">
                          <p className="truncate text-sm font-medium">{file.client_name}</p>
                          <Badge variant="secondary" appearance="light" size="sm">
                            {file.file_category}
                          </Badge>
                        </div>
                        <div className="mt-1 flex flex-wrap gap-x-3 gap-y-1 text-xs text-muted-foreground">
                          <span>{formatFileSize(file.file_size)}</span>
                          <span>{file.file_type}</span>
                          <span>Enviado por {file.owner.full_name}</span>
                          <span>{formatDate(file.created_at)}</span>
                        </div>
                      </div>

                      <div className="flex shrink-0 items-center gap-2">
                        <Button asChild variant="outline" size="sm">
                          <a href={file.url} target="_blank" rel="noopener noreferrer">
                            <ExternalLink className="size-4" />
                            Abrir
                          </a>
                        </Button>
                        {canDelete && (
                          <Button
                            type="button"
                            variant="destructive"
                            size="sm"
                            onClick={() => setFileToDelete(file)}
                          >
                            <Trash2 className="size-4" />
                            Excluir
                          </Button>
                        )}
                      </div>
                    </div>
                  )
                })}
              </div>
            )}

            {files.meta.lastPage > 1 && (
              <div className="flex items-center justify-between border-t border-border px-5 py-4">
                <p className="text-sm text-muted-foreground">
                  Página {files.meta.currentPage} de {files.meta.lastPage}
                </p>
                <div className="flex gap-2">
                  {files.meta.currentPage > files.meta.firstPage && (
                    <Button asChild variant="outline" size="sm">
                      <Link href={`/files?page=${files.meta.currentPage - 1}`} preserveScroll>
                        Anterior
                      </Link>
                    </Button>
                  )}
                  {files.meta.currentPage < files.meta.lastPage && (
                    <Button asChild variant="outline" size="sm">
                      <Link href={`/files?page=${files.meta.currentPage + 1}`} preserveScroll>
                        Próxima
                      </Link>
                    </Button>
                  )}
                </div>
              </div>
            )}
          </CardContent>
        </Card>
      </div>
    </MainLayout>
  )
}
