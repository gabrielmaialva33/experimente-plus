const FILE_CATEGORY_LABELS: Record<string, string> = {
  image: 'Imagem',
  document: 'Documento',
  video: 'Vídeo',
  audio: 'Áudio',
  file: 'Arquivo',
}

export function fileCategoryLabel(category: string): string {
  return FILE_CATEGORY_LABELS[category] ?? 'Arquivo'
}

const FILE_SIZE_UNITS = ['B', 'KB', 'MB', 'GB']
const fileSizeFormat = new Intl.NumberFormat('pt-BR', { maximumFractionDigits: 1 })

/** "16,6 KB", "10 MB": Brazilian decimal comma, no trailing ",0". */
export function formatFileSize(bytes: number): string {
  if (!Number.isFinite(bytes) || bytes <= 0) return '0 B'
  const index = Math.min(Math.floor(Math.log(bytes) / Math.log(1024)), FILE_SIZE_UNITS.length - 1)
  return `${fileSizeFormat.format(bytes / 1024 ** index)} ${FILE_SIZE_UNITS[index]}`
}

/**
 * When a file was sent, in Brasília time on the server and in the browser.
 *
 * Without a fixed zone the server rendered UTC and the browser its own zone, so
 * React threw away the server HTML over a three-hour difference (web audit
 * W26). Same pattern as `formatReportDate`.
 */
export function formatFileDate(value: string | null): string {
  if (!value) return '—'
  const date = new Date(value)
  if (Number.isNaN(date.getTime())) return '—'

  return new Intl.DateTimeFormat('pt-BR', {
    dateStyle: 'medium',
    timeStyle: 'short',
    timeZone: 'America/Sao_Paulo',
  }).format(date)
}
