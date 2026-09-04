export const BENEFIT_PRESENTATION_BASE_URL_KEY = 'BENEFIT_PRESENTATION_BASE_URL'
export const APP_URL_KEY = 'APP_URL'

type RuntimeEnvironment = 'development' | 'production' | 'test'

interface BenefitPresentationOriginOptions {
  environment: RuntimeEnvironment
  configuredBaseUrl?: string
  appUrl?: string
  requestOrigin?: string
}

export function normalizeHttpOrigin(value: string, source: string): string {
  const candidate = value.trim()
  let url: URL

  try {
    url = new URL(candidate)
  } catch {
    throw new Error(`${source} must be an absolute HTTP(S) origin`)
  }

  const hasOriginOnlyShape = /^https?:\/\/[^/?#\\\s]+\/?$/i.test(candidate)
  const hasCredentials = url.username !== '' || url.password !== ''
  const hasSupportedProtocol = url.protocol === 'http:' || url.protocol === 'https:'

  if (!hasOriginOnlyShape || !hasSupportedProtocol || hasCredentials || url.pathname !== '/') {
    throw new Error(
      `${source} must contain only an HTTP(S) origin without credentials, path, query, or hash`
    )
  }

  return url.origin
}

export function configuredBenefitPresentationOrigin({
  environment,
  configuredBaseUrl,
  appUrl,
}: BenefitPresentationOriginOptions): string | undefined {
  if (configuredBaseUrl?.trim()) {
    return normalizeHttpOrigin(configuredBaseUrl, BENEFIT_PRESENTATION_BASE_URL_KEY)
  }

  if (environment !== 'production') return undefined

  if (!appUrl?.trim()) {
    throw new Error(
      `${APP_URL_KEY} must define an absolute HTTP(S) origin in production when ${BENEFIT_PRESENTATION_BASE_URL_KEY} is absent`
    )
  }

  return normalizeHttpOrigin(appUrl, APP_URL_KEY)
}

export function assertBenefitPresentationOriginConfiguration(
  options: BenefitPresentationOriginOptions
): void {
  configuredBenefitPresentationOrigin(options)
}

export function resolveBenefitPresentationOrigin(
  options: BenefitPresentationOriginOptions
): string {
  const configuredOrigin = configuredBenefitPresentationOrigin(options)
  if (configuredOrigin) return configuredOrigin

  if (!options.requestOrigin) {
    throw new Error('A trusted request origin is required outside production')
  }

  return normalizeHttpOrigin(options.requestOrigin, 'Request origin')
}
