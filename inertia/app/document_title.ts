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

  // The em dash the home title and the rest of the copy use ("Londrina — PR"), not a hyphen.
  return normalizedTitle ? `${normalizedTitle} — ${normalizedAppName}` : normalizedAppName
}
