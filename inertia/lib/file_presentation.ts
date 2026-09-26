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
