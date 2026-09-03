import { router } from '@inertiajs/react'
import { useCallback, useState } from 'react'
import { useDropzone, type FileRejection } from 'react-dropzone'
import { CloudUpload, File as FileIcon, Loader2, X } from 'lucide-react'

import { Button } from '~/components/ui/button'
import { Alert, AlertIcon, AlertTitle, AlertContent, AlertDescription } from '~/components/ui/alert'
import { cn } from '~/lib/utils'
import { useApi } from '~/hooks/use_api'
import type { FileUploadResponse } from '~/types'

const ACCEPTED_FILE_TYPES: Record<string, string[]> = {
  'image/jpeg': ['.jpg', '.jpeg'],
  'image/png': ['.png'],
  'application/pdf': ['.pdf'],
  'application/msword': ['.doc'],
  'application/vnd.openxmlformats-officedocument.wordprocessingml.document': ['.docx'],
  'text/plain': ['.txt'],
  'text/csv': ['.csv'],
  'application/vnd.ms-excel': ['.xls'],
  'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet': ['.xlsx'],
  'audio/mpeg': ['.mp3'],
  'video/mp4': ['.mp4'],
  'application/zip': ['.zip'],
}

const MAX_FILE_SIZE = 10 * 1024 * 1024 // 10MB

function formatFileSize(bytes: number): string {
  if (bytes === 0) return '0 bytes'
  const k = 1024
  const sizes = ['bytes', 'KB', 'MB', 'GB']
  const i = Math.floor(Math.log(bytes) / Math.log(k))
  return `${parseFloat((bytes / Math.pow(k, i)).toFixed(2))} ${sizes[i]}`
}

export function FileUpload() {
  const [selectedFile, setSelectedFile] = useState<File | null>(null)
  const [uploadedFile, setUploadedFile] = useState<FileUploadResponse | null>(null)
  const [rejectionError, setRejectionError] = useState<string | null>(null)
  const { client, loading, error, request, clearError } = useApi()

  const onDrop = useCallback(
    (acceptedFiles: File[], fileRejections: FileRejection[]) => {
      clearError()
      setUploadedFile(null)

      if (fileRejections.length > 0) {
        const firstError = fileRejections[0]?.errors[0]
        if (firstError?.code === 'file-too-large') {
          setRejectionError(
            `O arquivo é muito grande. O tamanho máximo é ${formatFileSize(MAX_FILE_SIZE)}.`
          )
        } else if (firstError?.code === 'file-invalid-type') {
          setRejectionError('Este tipo de arquivo não é compatível.')
        } else {
          setRejectionError(firstError?.message ?? 'Não foi possível aceitar o arquivo.')
        }
        return
      }

      const file = acceptedFiles[0]
      if (file) {
        setRejectionError(null)
        setSelectedFile(file)
      }
    },
    [clearError]
  )

  const { getRootProps, getInputProps, isDragActive } = useDropzone({
    onDrop,
    accept: ACCEPTED_FILE_TYPES,
    maxSize: MAX_FILE_SIZE,
    multiple: false,
    disabled: loading,
  })

  const handleUpload = async () => {
    if (!selectedFile) return

    const result = await request<FileUploadResponse>(() =>
      client.upload('/files/upload', selectedFile)
    )

    if (result) {
      setUploadedFile(result)
      setSelectedFile(null)
      router.reload({ only: ['files'] })
    }
  }

  const clearSelection = () => {
    setSelectedFile(null)
    setRejectionError(null)
    clearError()
  }

  return (
    <div className="space-y-4" aria-busy={loading}>
      <div
        {...getRootProps()}
        className={cn(
          'flex flex-col items-center justify-center gap-3 rounded-md border-2 border-dashed border-input bg-background px-6 py-10 text-center outline-none transition-colors focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2',
          loading
            ? 'cursor-not-allowed opacity-60'
            : 'cursor-pointer hover:border-primary/50 hover:bg-accent/40',
          isDragActive && 'border-primary bg-primary/5'
        )}
      >
        <input {...getInputProps()} />
        <div className="flex size-11 items-center justify-center rounded-md bg-primary-soft text-primary-accent">
          <CloudUpload className="size-6" />
        </div>
        <div className="space-y-1">
          <p className="text-sm font-medium text-foreground">
            Arraste um arquivo aqui ou clique para selecionar
          </p>
          <p className="text-xs text-muted-foreground">
            Imagens, PDFs, documentos e outros formatos — até {formatFileSize(MAX_FILE_SIZE)}
          </p>
        </div>
      </div>

      {selectedFile && (
        <div className="flex items-center gap-3 rounded-md border border-border bg-muted/40 p-3">
          <div className="flex size-10 shrink-0 items-center justify-center rounded-md bg-background text-muted-foreground">
            <FileIcon className="size-5" />
          </div>
          <div className="min-w-0 flex-1">
            <p className="truncate text-sm font-medium text-foreground">{selectedFile.name}</p>
            <p className="text-xs text-muted-foreground">{formatFileSize(selectedFile.size)}</p>
          </div>
          <Button
            type="button"
            variant="ghost"
            mode="icon"
            size="sm"
            onClick={clearSelection}
            disabled={loading}
            aria-label="Remover arquivo selecionado"
          >
            <X className="size-4" />
          </Button>
        </div>
      )}

      <div className="flex justify-end">
        <Button
          type="button"
          variant="primary"
          onClick={handleUpload}
          disabled={!selectedFile || loading}
        >
          {loading && <Loader2 className="size-4 animate-spin" />}
          {loading ? 'Enviando…' : 'Enviar arquivo'}
        </Button>
      </div>

      {rejectionError && (
        <Alert variant="destructive" appearance="light">
          <AlertIcon>
            <X className="size-4" />
          </AlertIcon>
          <AlertContent>
            <AlertTitle>Arquivo recusado</AlertTitle>
            <AlertDescription>{rejectionError}</AlertDescription>
          </AlertContent>
        </Alert>
      )}

      {error && (
        <Alert variant="destructive" appearance="light">
          <AlertIcon>
            <X className="size-4" />
          </AlertIcon>
          <AlertContent>
            <AlertTitle>Não foi possível enviar</AlertTitle>
            <AlertDescription>{error.message}</AlertDescription>
          </AlertContent>
        </Alert>
      )}

      {uploadedFile && (
        <Alert variant="success" appearance="light">
          <AlertIcon>
            <CloudUpload className="size-4" />
          </AlertIcon>
          <AlertContent>
            <AlertTitle>Arquivo enviado</AlertTitle>
            <AlertDescription>
              <div className="mt-1 space-y-1">
                <p>
                  <strong>Arquivo:</strong> {uploadedFile.clientName}
                </p>
                <p>
                  <strong>Tipo:</strong> {uploadedFile.fileType}
                </p>
                <p>
                  <strong>Tamanho:</strong> {formatFileSize(uploadedFile.size)}
                </p>
                <p className="truncate">
                  <strong>URL:</strong>{' '}
                  <a
                    href={uploadedFile.url}
                    target="_blank"
                    rel="noopener noreferrer"
                    className="text-primary underline"
                  >
                    {uploadedFile.url}
                  </a>
                </p>
              </div>
            </AlertDescription>
          </AlertContent>
        </Alert>
      )}
    </div>
  )
}

export default FileUpload
