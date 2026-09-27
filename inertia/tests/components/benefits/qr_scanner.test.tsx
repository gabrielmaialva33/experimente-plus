import { act, screen, waitFor } from '@testing-library/react'
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'

import { QrScanner } from '~/components/benefits/qr_scanner'
import type { QrDecoder } from '~/lib/qr_scanner'
import { render } from '~/tests/test_utils'

const TOKEN = `${'c'.repeat(24)}.${'d'.repeat(43)}`
const PRESENTATION_URL = `https://experimente.test/portal/redemptions/validate?token=${TOKEN}`
const FOREIGN = 'https://example.com/cardapio'

interface FakeTrack {
  stop: ReturnType<typeof vi.fn>
  applyConstraints: ReturnType<typeof vi.fn>
  getSettings: () => MediaTrackSettings
  getCapabilities: () => MediaTrackCapabilities & { torch?: boolean }
}

function fakeTrack({ deviceId = 'rear', torch = false } = {}): FakeTrack {
  return {
    stop: vi.fn(),
    applyConstraints: vi.fn().mockResolvedValue(undefined),
    getSettings: () => ({ deviceId, facingMode: deviceId === 'rear' ? 'environment' : 'user' }),
    getCapabilities: () => ({ torch }),
  }
}

function fakeStream(track: FakeTrack): MediaStream {
  return { getTracks: () => [track], getVideoTracks: () => [track] } as unknown as MediaStream
}

const cameras = [
  { kind: 'videoinput', deviceId: 'rear' },
  { kind: 'videoinput', deviceId: 'front' },
  { kind: 'audioinput', deviceId: 'mic' },
] as MediaDeviceInfo[]

function installCamera(getUserMedia: ReturnType<typeof vi.fn>, devices = cameras.slice(0, 1)) {
  Object.defineProperty(navigator, 'mediaDevices', {
    configurable: true,
    value: { getUserMedia, enumerateDevices: vi.fn().mockResolvedValue(devices) },
  })
}

function fakeDecoder(
  ...reads: Array<string | null>
): QrDecoder & { detect: ReturnType<typeof vi.fn> } {
  const detect = vi.fn(async () => (reads.length > 1 ? reads.shift()! : reads[0]) ?? null)
  return { kind: 'native', detect }
}

function setVisibility(state: 'hidden' | 'visible') {
  Object.defineProperty(document, 'visibilityState', { configurable: true, value: state })
  document.dispatchEvent(new Event('visibilitychange'))
}

function renderScanner(decoder: QrDecoder, props: Partial<Parameters<typeof QrScanner>[0]> = {}) {
  const onDecode = vi.fn((value: string) => value === PRESENTATION_URL)
  const onTypeInstead = vi.fn()
  const view = render(
    <QrScanner
      onDecode={onDecode}
      rejectedMessage="Este QR não é um benefício do Experimente+."
      hint="Aponte para o QR code do cliente."
      onTypeInstead={onTypeInstead}
      onClose={vi.fn()}
      createDecoder={() => Promise.resolve(decoder)}
      {...props}
    />
  )
  return { ...view, onDecode, onTypeInstead }
}

describe('QrScanner', () => {
  beforeEach(() => {
    Object.defineProperty(window, 'isSecureContext', { configurable: true, value: true })
    Object.defineProperty(document, 'visibilityState', { configurable: true, value: 'visible' })
    vi.spyOn(HTMLMediaElement.prototype, 'play').mockResolvedValue(undefined)
    vi.spyOn(HTMLMediaElement.prototype, 'pause').mockImplementation(() => undefined)
    vi.spyOn(HTMLMediaElement.prototype, 'readyState', 'get').mockReturnValue(4)
  })

  afterEach(() => {
    vi.restoreAllMocks()
  })

  it('opens the rear camera, reads, and turns the camera off at the first valid code', async () => {
    const track = fakeTrack()
    const getUserMedia = vi.fn().mockResolvedValue(fakeStream(track))
    installCamera(getUserMedia)
    const decoder = fakeDecoder(null, PRESENTATION_URL)

    const { onDecode } = renderScanner(decoder)

    expect(screen.getByRole('status')).toHaveTextContent('Ligando a câmera')
    await waitFor(() => expect(onDecode).toHaveBeenCalledWith(PRESENTATION_URL))
    expect(getUserMedia).toHaveBeenCalledWith(
      expect.objectContaining({
        audio: false,
        video: expect.objectContaining({ facingMode: { ideal: 'environment' } }),
      })
    )
    expect(track.stop).toHaveBeenCalled()
    expect(screen.getByRole('status')).toHaveTextContent('QR code lido.')

    // The same code stays in front of the lens: it is not read a second time.
    const reads = decoder.detect.mock.calls.length
    await new Promise((resolve) => setTimeout(resolve, 400))
    expect(decoder.detect.mock.calls.length).toBe(reads)
    expect(onDecode).toHaveBeenCalledTimes(1)
  })

  it('refuses a foreign QR in place, once, and keeps reading until a benefit appears', async () => {
    const track = fakeTrack()
    installCamera(vi.fn().mockResolvedValue(fakeStream(track)))
    const decoder = fakeDecoder(FOREIGN, FOREIGN, FOREIGN, PRESENTATION_URL)

    const { onDecode } = renderScanner(decoder)

    await waitFor(() =>
      expect(screen.getByRole('status')).toHaveTextContent(
        'Este QR não é um benefício do Experimente+.'
      )
    )
    expect(track.stop).not.toHaveBeenCalled()
    await waitFor(() => expect(onDecode).toHaveBeenCalledWith(PRESENTATION_URL), {
      timeout: 2000,
    })
    expect(onDecode.mock.calls.filter(([value]) => value === FOREIGN)).toHaveLength(1)
    expect(track.stop).toHaveBeenCalled()
  })

  it('explains a refused camera, how to allow it, and offers typing the code', async () => {
    const getUserMedia = vi.fn().mockRejectedValue(new DOMException('no', 'NotAllowedError'))
    installCamera(getUserMedia)

    const { user, onTypeInstead } = renderScanner(fakeDecoder(null))

    const alert = await screen.findByRole('alert')
    expect(alert).toHaveTextContent('Câmera bloqueada')
    expect(alert).toHaveTextContent('Ajustes do Site')
    expect(alert).toHaveTextContent('Permissões')

    await user.click(screen.getByRole('button', { name: 'Tentar de novo' }))
    expect(getUserMedia).toHaveBeenCalledTimes(2)
    await user.click(screen.getByRole('button', { name: 'Digitar código' }))
    expect(onTypeInstead).toHaveBeenCalled()
  })

  it.each([
    ['NotFoundError', 'Nenhuma câmera encontrada'],
    ['NotReadableError', 'Câmera em uso'],
    ['OverconstrainedError', 'Nenhuma câmera encontrada'],
  ])('explains %s', async (name, title) => {
    installCamera(vi.fn().mockRejectedValue(new DOMException('x', name)))
    renderScanner(fakeDecoder(null))
    expect(await screen.findByRole('alert')).toHaveTextContent(title)
    expect(screen.getByRole('button', { name: 'Digitar código' })).toBeVisible()
  })

  it('does not ask for the camera on a page that is not secure', async () => {
    Object.defineProperty(window, 'isSecureContext', { configurable: true, value: false })
    const getUserMedia = vi.fn()
    installCamera(getUserMedia)

    renderScanner(fakeDecoder(null))

    expect(await screen.findByRole('alert')).toHaveTextContent('Câmera indisponível nesta conexão')
    expect(getUserMedia).not.toHaveBeenCalled()
    expect(screen.queryByRole('button', { name: 'Tentar de novo' })).not.toBeInTheDocument()
    expect(screen.getByRole('button', { name: 'Digitar código' })).toHaveClass('bg-primary')
  })

  it('stops the camera while the tab is hidden and resumes when it comes back', async () => {
    const first = fakeTrack()
    const second = fakeTrack()
    const getUserMedia = vi
      .fn()
      .mockResolvedValueOnce(fakeStream(first))
      .mockResolvedValueOnce(fakeStream(second))
    installCamera(getUserMedia)

    renderScanner(fakeDecoder(null))
    await waitFor(() =>
      expect(screen.getByRole('status')).toHaveTextContent('Aponte para o QR code do cliente.')
    )

    act(() => setVisibility('hidden'))
    expect(first.stop).toHaveBeenCalled()
    expect(screen.getByRole('status')).toHaveTextContent('Leitura pausada')

    act(() => setVisibility('visible'))
    await waitFor(() => expect(getUserMedia).toHaveBeenCalledTimes(2))
    await waitFor(() =>
      expect(screen.getByRole('status')).toHaveTextContent('Aponte para o QR code do cliente.')
    )
    expect(second.stop).not.toHaveBeenCalled()
  })

  it('stops the camera when the page is left, even if permission arrives afterwards', async () => {
    const track = fakeTrack()
    installCamera(vi.fn().mockResolvedValue(fakeStream(track)))
    const { unmount } = renderScanner(fakeDecoder(null))
    await waitFor(() => expect(screen.getByRole('status')).toHaveTextContent('Aponte'))
    unmount()
    expect(track.stop).toHaveBeenCalled()

    let grant!: (stream: MediaStream) => void
    const late = fakeTrack()
    installCamera(vi.fn(() => new Promise<MediaStream>((resolve) => (grant = resolve))))
    const second = renderScanner(fakeDecoder(null))
    second.unmount()
    await act(async () => grant(fakeStream(late)))
    expect(late.stop).toHaveBeenCalled()
  })

  it('offers the torch and the other camera only when the device has them', async () => {
    const rear = fakeTrack({ torch: true })
    const front = fakeTrack({ deviceId: 'front' })
    const getUserMedia = vi
      .fn()
      .mockResolvedValueOnce(fakeStream(rear))
      .mockResolvedValueOnce(fakeStream(front))
    installCamera(getUserMedia, cameras)

    const { user } = renderScanner(fakeDecoder(null))

    const torch = await screen.findByRole('button', { name: 'Lanterna' })
    expect(torch).toHaveAttribute('aria-pressed', 'false')
    await user.click(torch)
    expect(rear.applyConstraints).toHaveBeenCalledWith({ advanced: [{ torch: true }] })
    await waitFor(() => expect(torch).toHaveAttribute('aria-pressed', 'true'))

    await user.click(screen.getByRole('button', { name: 'Trocar câmera' }))
    await waitFor(() =>
      expect(getUserMedia).toHaveBeenLastCalledWith({
        audio: false,
        video: { deviceId: { exact: 'front' } },
      })
    )
    expect(rear.stop).toHaveBeenCalled()
    await waitFor(() =>
      expect(screen.queryByRole('button', { name: 'Lanterna' })).not.toBeInTheDocument()
    )
  })

  it('never writes what it reads to the console', async () => {
    const spies = (['log', 'info', 'warn', 'error', 'debug'] as const).map((method) =>
      vi.spyOn(console, method)
    )
    installCamera(vi.fn().mockResolvedValue(fakeStream(fakeTrack())))

    const { onDecode } = renderScanner(fakeDecoder(FOREIGN, PRESENTATION_URL))
    await waitFor(() => expect(onDecode).toHaveBeenCalledWith(PRESENTATION_URL), {
      timeout: 2000,
    })

    for (const spy of spies) {
      for (const call of spy.mock.calls) {
        expect(JSON.stringify(call)).not.toContain(TOKEN)
      }
    }
    // Nor into the page: no attribute or text carries the code.
    expect(document.body.innerHTML).not.toContain(TOKEN)
    expect(document.body.innerHTML).not.toContain('example.com')
  })
})
