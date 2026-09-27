import type {
  RedemptionPreviewView,
  RedemptionReceipt,
  RedemptionRefusal,
} from '~/types/benefit_redemption'

/**
 * The partner page's calls to preview and confirm a presentation.
 *
 * The token goes only in a JSON body over the signed-in session (with the
 * XSRF header the other web forms use), never in a URL, never in the
 * browser's history and never in a log: these functions do not log, and the
 * server does not echo the token back.
 */

export const PREVIEW_URL = '/portal/redemptions/preview'
export const CONFIRM_URL = '/portal/redemptions/confirm'
const REQUEST_TIMEOUT_MS = 15_000

export type InspectionResult =
  | { outcome: 'preview'; preview: RedemptionPreviewView }
  | { outcome: 'redeemed'; receipt: RedemptionReceipt }
  | { outcome: 'refused'; refusal: RedemptionRefusal }

export type ConfirmationResult =
  | { outcome: 'confirmed'; receipt: RedemptionReceipt }
  | { outcome: 'refused'; refusal: RedemptionRefusal }

/**
 * A request that did not reach an answer about the presentation:
 * `network` (offline, timeout), `session` (signed out or a stale page) or
 * `server` (anything else). The presentation itself was not judged.
 */
export type RedemptionRequestProblem = 'network' | 'session' | 'server'

export class RedemptionRequestError extends Error {
  readonly problem: RedemptionRequestProblem

  constructor(problem: RedemptionRequestProblem) {
    super(`Redemption request failed: ${problem}`)
    this.name = 'RedemptionRequestError'
    this.problem = problem
  }
}

function xsrfToken(): string | null {
  if (typeof document === 'undefined') return null
  for (const cookie of document.cookie.split(';')) {
    const [name, ...value] = cookie.trim().split('=')
    if (name === 'XSRF-TOKEN') return value.join('=')
  }
  return null
}

async function postToken(
  url: string,
  token: string,
  signal?: AbortSignal
): Promise<{ status: number; body: unknown }> {
  const headers: Record<string, string> = {
    'Accept': 'application/json',
    'Content-Type': 'application/json',
  }
  const xsrf = xsrfToken()
  if (xsrf) headers['X-XSRF-TOKEN'] = xsrf

  const controller = new AbortController()
  const timeout = setTimeout(() => controller.abort(), REQUEST_TIMEOUT_MS)
  const abort = () => controller.abort()
  signal?.addEventListener('abort', abort, { once: true })

  try {
    let response: Response
    try {
      response = await fetch(url, {
        method: 'POST',
        credentials: 'same-origin',
        cache: 'no-store',
        headers,
        body: JSON.stringify({ token }),
        signal: controller.signal,
      })
    } catch (error) {
      if (signal?.aborted) throw error
      throw new RedemptionRequestError('network')
    }

    let body: unknown = null
    try {
      body = await response.json()
    } catch {
      body = null
    }
    return { status: response.status, body }
  } finally {
    clearTimeout(timeout)
    signal?.removeEventListener('abort', abort)
  }
}

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === 'object' && value !== null && !Array.isArray(value)
}

function refusalOf(body: unknown): RedemptionRefusal | null {
  if (!isRecord(body) || body.outcome !== 'refused' || !isRecord(body.refusal)) return null
  const { reason, title, message } = body.refusal
  if (typeof reason !== 'string' || typeof title !== 'string' || typeof message !== 'string') {
    return null
  }
  return { reason: reason as RedemptionRefusal['reason'], title, message }
}

function failure(status: number): RedemptionRequestError {
  // 401: signed out. 403/419 without a refusal: the session or its XSRF token
  // no longer matches (another tab signed out, or the page is stale).
  return new RedemptionRequestError(
    status === 401 || status === 403 || status === 419 ? 'session' : 'server'
  )
}

/** Reads a presentation: its preview, its original receipt, or the refusal. Never redeems. */
export async function inspectPresentation(
  token: string,
  signal?: AbortSignal
): Promise<InspectionResult> {
  const { status, body } = await postToken(PREVIEW_URL, token, signal)

  if (status === 200 && isRecord(body)) {
    if (body.outcome === 'preview' && isRecord(body.preview)) {
      return { outcome: 'preview', preview: body.preview as unknown as RedemptionPreviewView }
    }
    if (body.outcome === 'redeemed' && isRecord(body.receipt)) {
      return { outcome: 'redeemed', receipt: body.receipt as unknown as RedemptionReceipt }
    }
  }

  const refusal = refusalOf(body)
  if (refusal) return { outcome: 'refused', refusal }
  throw failure(status)
}

/**
 * Confirms the use. Repeating it with the same token returns the original
 * receipt instead of registering a second use, so retrying after a lost
 * answer is safe.
 */
export async function confirmPresentation(
  token: string,
  signal?: AbortSignal
): Promise<ConfirmationResult> {
  const { status, body } = await postToken(CONFIRM_URL, token, signal)

  if (status === 200 && isRecord(body) && body.outcome === 'confirmed' && isRecord(body.receipt)) {
    return { outcome: 'confirmed', receipt: body.receipt as unknown as RedemptionReceipt }
  }

  const refusal = refusalOf(body)
  if (refusal) return { outcome: 'refused', refusal }
  throw failure(status)
}
