/**
 * Camera QR reading, without React: the scanner's states, how a camera failure
 * is classified, and the decoders. The hook in
 * `components/benefits/use_qr_scanner.ts` wires these to a <video>.
 *
 * Decoding prefers the browser's own `BarcodeDetector` (Chrome on Android,
 * macOS and ChromeOS). Where it is missing — Safari on iPhone, Firefox, Chrome
 * on Windows and Linux — jsQR (Apache-2.0, no dependencies, pure JavaScript,
 * no network) is loaded on demand, so only a partner who opens the camera on
 * such a browser downloads it.
 *
 * Nothing here logs, stores or displays what a code contains.
 */

export type ScannerProblem =
  /** The person or the browser refused the camera. */
  | 'denied'
  /** No camera, or none that satisfies the request. */
  | 'unavailable'
  /** The page is not on HTTPS (or localhost), where browsers hide the camera. */
  | 'insecure'
  /** The camera exists but another app or tab holds it. */
  | 'busy'
  /** The browser has no camera API at all. */
  | 'unsupported'
  | 'failed'

export type ScannerStatus =
  | 'idle'
  /** Asking the browser (and possibly the person) for the camera. */
  | 'starting'
  | 'scanning'
  /** The tab went to the background; the camera is off until it comes back. */
  | 'paused'
  /** A code was accepted and the camera is off. */
  | 'detected'
  | ScannerProblem

export type CameraFacing = 'environment' | 'user' | 'unknown'

export interface ScannerState {
  status: ScannerStatus
  /** The last code read was not accepted; cleared by the next accepted read or restart. */
  rejected: boolean
  torchSupported: boolean
  torchOn: boolean
  cameraCount: number
  facing: CameraFacing
}

export type ScannerEvent =
  | { type: 'start' }
  | {
      type: 'ready'
      torchSupported: boolean
      cameraCount: number
      facing: CameraFacing
    }
  | { type: 'fail'; problem: ScannerProblem }
  | { type: 'hidden' }
  | { type: 'rejected' }
  | { type: 'detected' }
  | { type: 'torch'; on: boolean }
  | { type: 'stop' }

export const INITIAL_SCANNER_STATE: ScannerState = {
  status: 'idle',
  rejected: false,
  torchSupported: false,
  torchOn: false,
  cameraCount: 0,
  facing: 'unknown',
}

const PROBLEMS = new Set<ScannerStatus>([
  'denied',
  'unavailable',
  'insecure',
  'busy',
  'unsupported',
  'failed',
])

export function isScannerProblem(status: ScannerStatus): status is ScannerProblem {
  return PROBLEMS.has(status)
}

export function scannerReducer(state: ScannerState, event: ScannerEvent): ScannerState {
  switch (event.type) {
    case 'start':
      return { ...state, status: 'starting', rejected: false, torchOn: false }
    case 'ready':
      return state.status === 'starting'
        ? {
            ...state,
            status: 'scanning',
            torchSupported: event.torchSupported,
            torchOn: false,
            cameraCount: event.cameraCount,
            facing: event.facing,
          }
        : state
    case 'fail':
      return { ...state, status: event.problem, torchOn: false }
    case 'hidden':
      return state.status === 'scanning' || state.status === 'starting'
        ? { ...state, status: 'paused', torchOn: false }
        : state
    case 'rejected':
      return state.status === 'scanning' ? { ...state, rejected: true } : state
    case 'detected':
      return state.status === 'scanning'
        ? { ...state, status: 'detected', rejected: false, torchOn: false }
        : state
    case 'torch':
      return state.status === 'scanning' ? { ...state, torchOn: event.on } : state
    case 'stop':
      return { ...INITIAL_SCANNER_STATE }
  }
}

interface CameraEnvironment {
  isSecureContext?: boolean
  mediaDevices?: Pick<MediaDevices, 'getUserMedia'> | undefined
}

/**
 * Whether this page may ask for the camera at all. Browsers only expose
 * `navigator.mediaDevices` on secure origins, so an HTTP page reads as insecure
 * rather than as a browser without a camera.
 */
export function cameraSupport(
  environment: CameraEnvironment = {
    isSecureContext: typeof window === 'undefined' ? false : window.isSecureContext,
    mediaDevices: typeof navigator === 'undefined' ? undefined : navigator.mediaDevices,
  }
): 'ok' | 'insecure' | 'unsupported' {
  if (environment.isSecureContext === false) return 'insecure'
  if (typeof environment.mediaDevices?.getUserMedia !== 'function') return 'unsupported'
  return 'ok'
}

/** Maps a `getUserMedia` rejection to what the partner can do about it. */
export function classifyCameraError(error: unknown): ScannerProblem {
  const name =
    error && typeof error === 'object' && 'name' in error ? String(error.name) : undefined

  switch (name) {
    case 'NotAllowedError':
    case 'PermissionDeniedError':
    case 'SecurityError':
      return 'denied'
    case 'NotFoundError':
    case 'DevicesNotFoundError':
    case 'OverconstrainedError':
    case 'ConstraintNotSatisfiedError':
      return 'unavailable'
    case 'NotReadableError':
    case 'TrackStartError':
    case 'AbortError':
      return 'busy'
    // Browsers that cannot capture here at all, such as an embedded webview.
    case 'NotSupportedError':
      return 'unsupported'
    default:
      return 'failed'
  }
}

/** The rear camera on a phone, whatever a laptop has otherwise. */
export function cameraConstraints(deviceId?: string): MediaStreamConstraints {
  return {
    audio: false,
    video: deviceId
      ? { deviceId: { exact: deviceId } }
      : {
          facingMode: { ideal: 'environment' },
          width: { ideal: 1280 },
          height: { ideal: 720 },
        },
  }
}

export function stopStream(stream: MediaStream | null | undefined): void {
  for (const track of stream?.getTracks() ?? []) {
    track.stop()
  }
}

export interface QrDecoder {
  readonly kind: 'native' | 'jsqr'
  /** Reads the current frame; resolves with the first code's text, or null. */
  detect: (video: HTMLVideoElement) => Promise<string | null>
  dispose?: () => void
}

interface DetectedBarcodeLike {
  rawValue?: unknown
}

interface BarcodeDetectorLike {
  detect: (source: HTMLVideoElement) => Promise<DetectedBarcodeLike[]>
}

interface BarcodeDetectorConstructorLike {
  new (options?: { formats?: string[] }): BarcodeDetectorLike
  getSupportedFormats?: () => Promise<string[]>
}

/** The browser's detector, when it exists and reads QR codes on this platform. */
export async function createNativeQrDecoder(
  scope: { BarcodeDetector?: unknown } = globalThis as { BarcodeDetector?: unknown }
): Promise<QrDecoder | null> {
  const Detector = scope.BarcodeDetector as BarcodeDetectorConstructorLike | undefined
  if (typeof Detector !== 'function') return null

  try {
    const formats = await Detector.getSupportedFormats?.()
    if (Array.isArray(formats) && !formats.includes('qr_code')) return null

    const detector = new Detector({ formats: ['qr_code'] })
    return {
      kind: 'native',
      async detect(video) {
        const codes = await detector.detect(video)
        for (const code of codes) {
          if (typeof code.rawValue === 'string' && code.rawValue) return code.rawValue
        }
        return null
      },
    }
  } catch {
    return null
  }
}

type JsQr = typeof import('jsqr').default

/**
 * The largest side, in pixels, of the square handed to jsQR. The presentation
 * QR carries a long URL (about 70 modules a side); 800 px keeps several pixels
 * per module when the code fills part of the frame, at a cost a phone decodes
 * well within the scan interval.
 */
const JSQR_MAX_SIDE = 800

/**
 * jsQR over the centre square of the frame, which is exactly what the square
 * viewfinder shows the partner (`object-cover`), capped at `JSQR_MAX_SIDE`.
 */
export function createJsQrDecoder(jsQR: JsQr): QrDecoder {
  const canvas = document.createElement('canvas')
  const context = canvas.getContext('2d', { willReadFrequently: true })

  return {
    kind: 'jsqr',
    async detect(video) {
      const width = video.videoWidth
      const height = video.videoHeight
      if (!context || !width || !height) return null

      const crop = Math.min(width, height)
      const side = Math.min(crop, JSQR_MAX_SIDE)
      if (canvas.width !== side) canvas.width = side
      if (canvas.height !== side) canvas.height = side

      context.drawImage(
        video,
        (width - crop) / 2,
        (height - crop) / 2,
        crop,
        crop,
        0,
        0,
        side,
        side
      )
      const image = context.getImageData(0, 0, side, side)
      const code = jsQR(image.data, side, side, { inversionAttempts: 'dontInvert' })
      return code?.data ? code.data : null
    },
    dispose() {
      canvas.width = 0
      canvas.height = 0
    },
  }
}

export async function loadJsQrDecoder(): Promise<QrDecoder> {
  const { default: jsQR } = await import('jsqr')
  return createJsQrDecoder(jsQR)
}

/** The native detector when the browser has one for QR, jsQR otherwise. */
export async function createQrDecoder(): Promise<QrDecoder> {
  return (await createNativeQrDecoder()) ?? (await loadJsQrDecoder())
}
