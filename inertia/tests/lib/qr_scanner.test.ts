import { afterEach, describe, expect, it, vi } from 'vitest'

import {
  INITIAL_SCANNER_STATE,
  cameraConstraints,
  cameraSupport,
  classifyCameraError,
  createJsQrDecoder,
  createNativeQrDecoder,
  createQrDecoder,
  scannerReducer,
  type ScannerEvent,
  type ScannerState,
} from '~/lib/qr_scanner'

vi.mock('jsqr', () => ({ default: vi.fn(() => null) }))

function run(events: ScannerEvent[], from: ScannerState = INITIAL_SCANNER_STATE): ScannerState {
  return events.reduce(scannerReducer, from)
}

const READY: ScannerEvent = {
  type: 'ready',
  torchSupported: true,
  cameraCount: 2,
  facing: 'environment',
}

describe('scannerReducer', () => {
  it('goes from asking for the camera to reading, then stops at the first accepted code', () => {
    expect(run([{ type: 'start' }]).status).toBe('starting')
    const scanning = run([{ type: 'start' }, READY])
    expect(scanning).toMatchObject({
      status: 'scanning',
      torchSupported: true,
      cameraCount: 2,
      facing: 'environment',
    })
    expect(run([{ type: 'detected' }], scanning).status).toBe('detected')
  })

  it('keeps reading after a refused code and says so until the next start', () => {
    const scanning = run([{ type: 'start' }, READY])
    const refused = run([{ type: 'rejected' }], scanning)
    expect(refused).toMatchObject({ status: 'scanning', rejected: true })
    expect(run([{ type: 'start' }], refused).rejected).toBe(false)
  })

  it('pauses when the tab is hidden and ignores a camera answer that arrives late', () => {
    const paused = run([{ type: 'start' }, { type: 'hidden' }])
    expect(paused.status).toBe('paused')
    expect(run([READY], paused).status).toBe('paused')
    expect(run([{ type: 'hidden' }], INITIAL_SCANNER_STATE).status).toBe('idle')
  })

  it('records each failure as its own state and turns the torch off', () => {
    const lit = run([{ type: 'start' }, READY, { type: 'torch', on: true }])
    expect(lit.torchOn).toBe(true)
    expect(run([{ type: 'fail', problem: 'busy' }], lit)).toMatchObject({
      status: 'busy',
      torchOn: false,
    })
    expect(run([{ type: 'stop' }], lit)).toEqual(INITIAL_SCANNER_STATE)
  })
})

describe('camera failures', () => {
  it.each([
    ['NotAllowedError', 'denied'],
    ['PermissionDeniedError', 'denied'],
    ['SecurityError', 'denied'],
    ['NotFoundError', 'unavailable'],
    ['OverconstrainedError', 'unavailable'],
    ['NotReadableError', 'busy'],
    ['AbortError', 'busy'],
    ['NotSupportedError', 'unsupported'],
    ['TypeError', 'failed'],
  ])('reads %s as %s', (name, problem) => {
    expect(classifyCameraError(new DOMException('x', name))).toBe(problem)
  })

  it('classifies anything without a name as a generic failure', () => {
    expect(classifyCameraError(undefined)).toBe('failed')
    expect(classifyCameraError('boom')).toBe('failed')
  })

  it('tells an insecure page apart from a browser without a camera API', () => {
    const getUserMedia = vi.fn()
    expect(cameraSupport({ isSecureContext: false, mediaDevices: { getUserMedia } })).toBe(
      'insecure'
    )
    expect(cameraSupport({ isSecureContext: true, mediaDevices: undefined })).toBe('unsupported')
    expect(cameraSupport({ isSecureContext: true, mediaDevices: { getUserMedia } })).toBe('ok')
  })

  it('asks for the rear camera, or for the one the partner switched to', () => {
    expect(cameraConstraints()).toMatchObject({
      audio: false,
      video: { facingMode: { ideal: 'environment' } },
    })
    expect(cameraConstraints('camera-2')).toEqual({
      audio: false,
      video: { deviceId: { exact: 'camera-2' } },
    })
  })
})

describe('decoders', () => {
  afterEach(() => {
    vi.unstubAllGlobals()
    vi.restoreAllMocks()
  })

  it('uses the native BarcodeDetector when it reads QR codes', async () => {
    const detect = vi.fn().mockResolvedValue([{ rawValue: '' }, { rawValue: 'conteúdo lido' }])
    class Detector {
      static getSupportedFormats = vi.fn().mockResolvedValue(['ean_13', 'qr_code'])
      detect = detect
    }

    const decoder = await createNativeQrDecoder({ BarcodeDetector: Detector })
    expect(decoder?.kind).toBe('native')
    const video = document.createElement('video')
    await expect(decoder?.detect(video)).resolves.toBe('conteúdo lido')
    expect(detect).toHaveBeenCalledWith(video)
  })

  it('falls back to jsQR where the detector is missing or cannot read QR', async () => {
    class NoQr {
      static getSupportedFormats = vi.fn().mockResolvedValue(['ean_13'])
      detect = vi.fn()
    }
    await expect(createNativeQrDecoder({ BarcodeDetector: NoQr })).resolves.toBeNull()
    await expect(createNativeQrDecoder({})).resolves.toBeNull()

    vi.stubGlobal('BarcodeDetector', undefined)
    vi.spyOn(HTMLCanvasElement.prototype, 'getContext').mockReturnValue(null)
    const decoder = await createQrDecoder()
    expect(decoder.kind).toBe('jsqr')
  })

  it('hands jsQR the centre square of the frame, capped in size', async () => {
    const drawImage = vi.fn()
    const getImageData = vi.fn((_x: number, _y: number, width: number, height: number) => ({
      data: new Uint8ClampedArray(width * height * 4),
      width,
      height,
    }))
    vi.spyOn(HTMLCanvasElement.prototype, 'getContext').mockReturnValue({
      drawImage,
      getImageData,
    } as unknown as CanvasRenderingContext2D)
    const jsQR = vi.fn().mockReturnValue({ data: 'https://example.com' })

    const decoder = createJsQrDecoder(jsQR as never)
    const video = document.createElement('video')
    Object.defineProperties(video, {
      videoWidth: { value: 1920 },
      videoHeight: { value: 1080 },
    })

    await expect(decoder.detect(video)).resolves.toBe('https://example.com')
    // 1080 × 1080 from the middle of a 1920 × 1080 frame, drawn at 800 × 800.
    expect(drawImage).toHaveBeenCalledWith(video, 420, 0, 1080, 1080, 0, 0, 800, 800)
    expect(jsQR).toHaveBeenCalledWith(expect.any(Uint8ClampedArray), 800, 800, {
      inversionAttempts: 'dontInvert',
    })

    jsQR.mockReturnValue(null)
    await expect(decoder.detect(video)).resolves.toBeNull()
  })
})
