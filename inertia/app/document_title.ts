const DEFAULT_APP_NAME = 'Experimente+'

export function formatDocumentTitle(title: string, appName = DEFAULT_APP_NAME): string {
  const normalizedTitle = title.trim()
  const normalizedAppName = appName.trim() || DEFAULT_APP_NAME

  if (
    normalizedTitle === normalizedAppName ||
    normalizedTitle.startsWith(`${normalizedAppName} `) ||
    normalizedTitle.endsWith(` ${normalizedAppName}`)
  ) {
    return normalizedTitle
  }

  return normalizedTitle ? `${normalizedTitle} - ${normalizedAppName}` : normalizedAppName
}
