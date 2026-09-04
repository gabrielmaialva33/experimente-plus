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
