import { useCallback, useEffect, useReducer, useRef, type RefObject } from 'react'

import {
  INITIAL_SCANNER_STATE,
  cameraConstraints,
  cameraSupport,
  classifyCameraError,
  createQrDecoder,
  loadJsQrDecoder,
  scannerReducer,
  stopStream,
  type CameraFacing,
  type QrDecoder,
  type ScannerState,
} from '~/lib/qr_scanner'

/** Time between two frame reads: responsive, without holding a phone's CPU. */
export const SCAN_INTERVAL_MS = 150

export interface UseQrScannerOptions {
  /**
   * Receives each distinct code read. Return true to accept it: the camera
   * stops at once and nothing else is read. A refused code is not offered
   * again while it stays in front of the camera.
   */
  onDecode: (value: string) => boolean
  /** Starts the camera as soon as the video element mounts. */
  autoStart?: boolean
  /** Decoder factory, replaceable in tests. */
  createDecoder?: () => Promise<QrDecoder>
}

export interface QrScannerController extends ScannerState {
  videoRef: RefObject<HTMLVideoElement | null>
  start: () => void
  stop: () => void
  toggleTorch: () => void
  switchCamera: () => void
}

type TorchConstraint = MediaTrackConstraintSet & { torch?: boolean }

function facingOf(settings: MediaTrackSettings | undefined): CameraFacing {
  if (settings?.facingMode === 'environment') return 'environment'
  if (settings?.facingMode === 'user') return 'user'
  return 'unknown'
}

/**
 * Drives a <video> from the camera and reads QR codes from it.
 *
 * The camera is on only while it is needed: it stops when a code is accepted,
 * when the tab is hidden (and comes back with it), when the page is left and
 * when the component unmounts. A start that resolves after any of those is
 * discarded, so a late permission answer never leaves a camera running.
 */
export function useQrScanner({
  onDecode,
  autoStart = true,
  createDecoder = createQrDecoder,
}: UseQrScannerOptions): QrScannerController {
  const [state, dispatch] = useReducer(scannerReducer, INITIAL_SCANNER_STATE)
  const videoRef = useRef<HTMLVideoElement | null>(null)
  const streamRef = useRef<MediaStream | null>(null)
  const decoderRef = useRef<QrDecoder | null>(null)
  const timerRef = useRef<number | null>(null)
  const sessionRef = useRef(0)
  const statusRef = useRef(state.status)
  const onDecodeRef = useRef(onDecode)
  const createDecoderRef = useRef(createDecoder)
  const deviceIdRef = useRef<string | undefined>(undefined)
  // The last refused code, so a code held in front of the camera is judged once.
  // It is never a presentation token: an accepted code is not kept.
  const refusedRef = useRef<string | null>(null)

  statusRef.current = state.status
  onDecodeRef.current = onDecode
  createDecoderRef.current = createDecoder

  const release = useCallback(() => {
    sessionRef.current += 1
    if (timerRef.current !== null) {
      window.clearTimeout(timerRef.current)
      timerRef.current = null
    }
    stopStream(streamRef.current)
    streamRef.current = null
    refusedRef.current = null
    const video = videoRef.current
    if (video) {
      video.pause?.()
      video.srcObject = null
    }
  }, [])

  const scan = useCallback(
    (session: number) => {
      const tick = async () => {
        if (session !== sessionRef.current) return
        const video = videoRef.current
        const decoder = decoderRef.current

        if (video && decoder && video.readyState >= 2) {
          let value: string | null = null
          try {
            value = await decoder.detect(video)
          } catch {
            // A native detector that fails at run time gives way to jsQR for good.
            if (decoder.kind === 'native') {
              try {
                decoderRef.current = await loadJsQrDecoder()
              } catch {
                // Keep trying the native one; the next frame may succeed.
              }
            }
          }

          if (session !== sessionRef.current) return
          if (value && value !== refusedRef.current) {
            if (onDecodeRef.current(value)) {
              release()
              dispatch({ type: 'detected' })
              return
            }
            refusedRef.current = value
            dispatch({ type: 'rejected' })
          }
        }

        if (session === sessionRef.current) {
          timerRef.current = window.setTimeout(() => void tick(), SCAN_INTERVAL_MS)
        }
      }

      void tick()
    },
    [release]
  )

  const start = useCallback(
    async (deviceId?: string) => {
      release()
      const session = sessionRef.current

      const support = cameraSupport()
      if (support !== 'ok') {
        dispatch({ type: 'fail', problem: support })
        return
      }

      dispatch({ type: 'start' })
      let stream: MediaStream
      try {
        stream = await navigator.mediaDevices.getUserMedia(cameraConstraints(deviceId))
      } catch (error) {
        if (session === sessionRef.current) {
          dispatch({ type: 'fail', problem: classifyCameraError(error) })
        }
        return
      }

      if (session !== sessionRef.current) {
        stopStream(stream)
        return
      }
      streamRef.current = stream

      const video = videoRef.current
      if (video) {
        video.muted = true
        video.srcObject = stream
        try {
          await video.play()
        } catch {
          // Autoplay of a muted inline video is allowed; a refusal here only
          // delays the first frame, and `readyState` guards every read.
        }
      }

      const track = stream.getVideoTracks()[0]
      const settings = track?.getSettings?.()
      const capabilities = track?.getCapabilities?.() as
        (MediaTrackCapabilities & { torch?: boolean }) | undefined
      deviceIdRef.current = settings?.deviceId

      let cameraCount = 1
      try {
        const devices = await navigator.mediaDevices.enumerateDevices()
        cameraCount = devices.filter((device) => device.kind === 'videoinput').length
      } catch {
        // Without the list the switch button stays hidden.
      }

      try {
        decoderRef.current ??= await createDecoderRef.current()
      } catch {
        if (session === sessionRef.current) {
          release()
          dispatch({ type: 'fail', problem: 'failed' })
        }
        return
      }

      if (session !== sessionRef.current) return
      dispatch({
        type: 'ready',
        torchSupported: Boolean(capabilities?.torch),
        cameraCount,
        facing: facingOf(settings),
      })
      scan(session)
    },
    [release, scan]
  )

  const stop = useCallback(() => {
    release()
    dispatch({ type: 'stop' })
  }, [release])

  const toggleTorch = useCallback(() => {
    const track = streamRef.current?.getVideoTracks()[0]
    if (!track || statusRef.current !== 'scanning') return
    const on = !state.torchOn
    track
      .applyConstraints({ advanced: [{ torch: on } as TorchConstraint] })
      .then(() => dispatch({ type: 'torch', on }))
      .catch(() => dispatch({ type: 'torch', on: false }))
  }, [state.torchOn])

  const switchCamera = useCallback(() => {
    void (async () => {
      let devices: MediaDeviceInfo[] = []
      try {
        devices = await navigator.mediaDevices.enumerateDevices()
      } catch {
        return
      }
      const cameras = devices.filter((device) => device.kind === 'videoinput')
      if (cameras.length < 2) return
      const current = cameras.findIndex((camera) => camera.deviceId === deviceIdRef.current)
      const next = cameras[(current + 1) % cameras.length]
      void start(next.deviceId || undefined)
    })()
  }, [start])

  useEffect(() => {
    if (autoStart) void start()

    const onVisibilityChange = () => {
      if (document.visibilityState === 'hidden') {
        if (statusRef.current === 'scanning' || statusRef.current === 'starting') {
          release()
          dispatch({ type: 'hidden' })
        }
      } else if (statusRef.current === 'paused') {
        void start(deviceIdRef.current)
      }
    }
    const onPageHide = () => {
      release()
      dispatch({ type: 'stop' })
    }

    document.addEventListener('visibilitychange', onVisibilityChange)
    window.addEventListener('pagehide', onPageHide)

    return () => {
      document.removeEventListener('visibilitychange', onVisibilityChange)
      window.removeEventListener('pagehide', onPageHide)
      release()
      decoderRef.current?.dispose?.()
      decoderRef.current = null
    }
    // The camera is started once per mount; restarts go through `start`.
  }, [])

  return {
    ...state,
    videoRef,
    start: () => void start(),
    stop,
    toggleTorch,
    switchCamera,
  }
}
