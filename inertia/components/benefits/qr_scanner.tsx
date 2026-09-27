import {
  AlertTriangle,
  Camera,
  CameraOff,
  Flashlight,
  FlashlightOff,
  Keyboard,
  Loader2,
  PauseCircle,
  RefreshCw,
  SwitchCamera,
  X,
  type LucideIcon,
} from 'lucide-react'
import { useEffect, useState } from 'react'

import { useQrScanner } from '~/components/benefits/use_qr_scanner'
import { Button } from '~/components/ui/button'
import { isScannerProblem, type QrDecoder, type ScannerProblem } from '~/lib/qr_scanner'
import { cn } from '~/lib/utils'

export interface QrScannerProps {
  /**
   * Receives each distinct code read. Return true to accept it; the camera then
   * turns off. The component never shows, logs or follows what a code contains.
   */
  onDecode: (value: string) => boolean
  /** Shown while a code that was not accepted is in front of the camera. */
  rejectedMessage: string
  /** The aiming instruction while the camera reads. */
  hint?: string
  /** The way out that does not need a camera, offered in every failure. */
  onTypeInstead?: () => void
  typeInsteadLabel?: string
  onClose?: () => void
  className?: string
  /** Decoder factory, replaceable in tests. */
  createDecoder?: () => Promise<QrDecoder>
}

const PROBLEMS: Record<
  ScannerProblem,
  { icon: LucideIcon; title: string; description: string; retry: boolean }
> = {
  denied: {
    icon: CameraOff,
    title: 'Câmera bloqueada',
    description: 'O navegador não deixou esta página usar a câmera. Para liberar:',
    retry: true,
  },
  unavailable: {
    icon: CameraOff,
    title: 'Nenhuma câmera encontrada',
    description:
      'Não encontramos uma câmera neste aparelho. Conecte uma câmera e tente de novo, ou digite o código do cliente.',
    retry: true,
  },
  insecure: {
    icon: CameraOff,
    title: 'Câmera indisponível nesta conexão',
    description:
      'Os navegadores só liberam a câmera em páginas seguras (https). Abra o portal pelo endereço com https ou digite o código do cliente.',
    retry: false,
  },
  busy: {
    icon: CameraOff,
    title: 'Câmera em uso',
    description:
      'Outro aplicativo ou aba está usando a câmera. Feche-o e tente de novo, ou digite o código do cliente.',
    retry: true,
  },
  unsupported: {
    icon: CameraOff,
    title: 'Navegador sem acesso à câmera',
    description:
      'Este navegador não permite ler QR codes pela câmera. Atualize o Safari ou o Chrome, ou digite o código do cliente.',
    retry: false,
  },
  failed: {
    icon: CameraOff,
    title: 'Não foi possível ligar a câmera',
    description: 'Algo impediu a câmera de ligar. Tente de novo ou digite o código do cliente.',
    retry: true,
  },
}

function usePrefersMirroredPreview(): boolean {
  const [finePointer, setFinePointer] = useState(false)
  useEffect(() => {
    setFinePointer(window.matchMedia?.('(pointer: fine)').matches ?? false)
  }, [])
  return finePointer
}

/**
 * An inline camera viewfinder that reads QR codes.
 *
 * It asks for the rear camera on a phone and any webcam on a computer, offers
 * the torch and a camera switch when the device has them, and explains each
 * way the camera can fail — with the way to allow it in Safari and Chrome —
 * always next to the alternative of typing the code.
 */
export function QrScanner({
  onDecode,
  rejectedMessage,
  hint = 'Aponte a câmera para o QR code.',
  onTypeInstead,
  typeInsteadLabel = 'Digitar código',
  onClose,
  className,
  createDecoder,
}: QrScannerProps) {
  const scanner = useQrScanner({ onDecode, createDecoder })
  const finePointer = usePrefersMirroredPreview()
  const problem = isScannerProblem(scanner.status) ? PROBLEMS[scanner.status] : null
  const mirrored = scanner.facing === 'user' || (scanner.facing === 'unknown' && finePointer)

  const statusText =
    scanner.status === 'starting'
      ? 'Ligando a câmera. Se o navegador perguntar, permita o acesso.'
      : scanner.status === 'paused'
        ? 'Leitura pausada enquanto a página está em segundo plano.'
        : scanner.status === 'detected'
          ? 'QR code lido.'
          : scanner.status === 'idle'
            ? 'Câmera desligada.'
            : scanner.rejected
              ? rejectedMessage
              : hint

  return (
    <div
      role="group"
      aria-label="Leitor de QR code"
      className={cn('mx-auto flex w-full max-w-md flex-col gap-4', className)}
    >
      {problem ? (
        <div
          role="alert"
          className="rounded-card border border-warning/40 bg-warning-soft p-5 text-foreground"
        >
          <p className="flex items-center gap-2 font-display text-lg font-bold">
            <problem.icon aria-hidden="true" className="size-5 shrink-0 text-warning-accent" />
            {problem.title}
          </p>
          <p className="mt-2 text-sm leading-6">{problem.description}</p>
          {scanner.status === 'denied' ? (
            <ul className="mt-2 space-y-1.5 text-sm leading-6">
              <li>
                <strong>iPhone (Safari):</strong> toque em <strong>aA</strong> na barra de endereço,
                depois em <strong>Ajustes do Site</strong> › <strong>Câmera</strong> ›{' '}
                <strong>Permitir</strong>.
              </li>
              <li>
                <strong>Android ou computador (Chrome):</strong> toque no ícone ao lado do endereço,
                depois em <strong>Permissões</strong> › <strong>Câmera</strong> ›{' '}
                <strong>Permitir</strong>.
              </li>
              <li>Em seguida, toque em Tentar de novo.</li>
            </ul>
          ) : null}
          <div className="mt-4 flex flex-col gap-2 sm:flex-row">
            {problem.retry ? (
              <Button type="button" size="lg" shape="pill" onClick={scanner.start}>
                <RefreshCw aria-hidden="true" />
                Tentar de novo
              </Button>
            ) : null}
            {onTypeInstead ? (
              <Button
                type="button"
                variant={problem.retry ? 'outline' : 'primary'}
                size="lg"
                shape="pill"
                onClick={onTypeInstead}
              >
                <Keyboard aria-hidden="true" />
                {typeInsteadLabel}
              </Button>
            ) : null}
          </div>
        </div>
      ) : null}

      {/* The video stays mounted so a retry can attach the new stream at once. */}
      <div
        className={cn(
          'relative aspect-square w-full overflow-hidden rounded-card bg-chrome',
          problem && 'hidden'
        )}
      >
        <video
          ref={scanner.videoRef}
          aria-hidden="true"
          autoPlay
          muted
          playsInline
          className={cn(
            'absolute inset-0 size-full object-cover',
            mirrored && '-scale-x-100',
            scanner.status !== 'scanning' && 'opacity-0'
          )}
        />

        {/* Aiming frame; the video around it is dimmed. Decorative. */}
        <div
          aria-hidden="true"
          className="pointer-events-none absolute inset-0 grid place-items-center"
        >
          <div
            data-rejected={scanner.rejected || undefined}
            className="relative size-[68%] rounded-[1.25rem] text-white shadow-[0_0_0_100vmax_rgb(0_0_0/0.38)] data-rejected:text-warning"
          >
            <span className="absolute -start-0.5 -top-0.5 size-9 rounded-ss-[1.25rem] border-s-4 border-t-4 border-current" />
            <span className="absolute -end-0.5 -top-0.5 size-9 rounded-se-[1.25rem] border-e-4 border-t-4 border-current" />
            <span className="absolute -bottom-0.5 -start-0.5 size-9 rounded-es-[1.25rem] border-b-4 border-s-4 border-current" />
            <span className="absolute -bottom-0.5 -end-0.5 size-9 rounded-ee-[1.25rem] border-b-4 border-e-4 border-current" />
            {scanner.status === 'scanning' && !scanner.rejected ? (
              <span className="absolute inset-x-4 top-1/2 h-0.5 rounded-full bg-white/85 motion-safe:animate-pulse" />
            ) : null}
          </div>
        </div>

        {scanner.status === 'starting' ||
        scanner.status === 'paused' ||
        scanner.status === 'idle' ? (
          <div
            aria-hidden="true"
            className="absolute inset-0 grid place-items-center text-white/90"
          >
            {scanner.status === 'starting' ? (
              <Loader2 className="size-9 animate-spin" />
            ) : scanner.status === 'paused' ? (
              <PauseCircle className="size-10" />
            ) : (
              <Camera className="size-10" />
            )}
          </div>
        ) : null}
      </div>

      {/* Below the picture, not over it: the frame keeps the whole square to aim. */}
      <p
        role="status"
        className={cn(
          'flex min-h-11 items-center justify-center gap-2 rounded-2xl px-4 py-2.5 text-center text-sm font-semibold leading-5',
          problem && 'hidden',
          scanner.rejected && scanner.status === 'scanning'
            ? 'bg-warning-soft text-warning-accent'
            : 'bg-muted text-foreground'
        )}
      >
        {scanner.rejected && scanner.status === 'scanning' ? (
          <AlertTriangle aria-hidden="true" className="size-4 shrink-0" />
        ) : null}
        {problem ? null : statusText}
      </p>

      {!problem ? (
        <div className="flex flex-wrap items-center justify-center gap-2">
          {scanner.status === 'idle' ? (
            <Button type="button" size="lg" shape="pill" onClick={scanner.start}>
              <Camera aria-hidden="true" />
              Ligar câmera
            </Button>
          ) : null}
          {scanner.status === 'scanning' && scanner.torchSupported ? (
            <Button
              type="button"
              variant="outline"
              size="lg"
              shape="pill"
              aria-pressed={scanner.torchOn}
              onClick={scanner.toggleTorch}
            >
              {scanner.torchOn ? (
                <FlashlightOff aria-hidden="true" />
              ) : (
                <Flashlight aria-hidden="true" />
              )}
              Lanterna
            </Button>
          ) : null}
          {scanner.status === 'scanning' && scanner.cameraCount > 1 ? (
            <Button
              type="button"
              variant="outline"
              size="lg"
              shape="pill"
              onClick={scanner.switchCamera}
            >
              <SwitchCamera aria-hidden="true" />
              Trocar câmera
            </Button>
          ) : null}
          {onTypeInstead ? (
            <Button type="button" variant="outline" size="lg" shape="pill" onClick={onTypeInstead}>
              <Keyboard aria-hidden="true" />
              {typeInsteadLabel}
            </Button>
          ) : null}
          {onClose ? (
            <Button type="button" variant="ghost" size="lg" shape="pill" onClick={onClose}>
              <X aria-hidden="true" />
              Fechar câmera
            </Button>
          ) : null}
        </div>
      ) : null}
    </div>
  )
}
