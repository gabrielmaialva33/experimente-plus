import { Link } from '@inertiajs/react'
import {
  CircleCheck,
  Compass,
  Download,
  Ellipsis,
  MapPinned,
  MessageSquareText,
  MonitorSmartphone,
  ScanLine,
  Share,
  Smartphone,
  Sparkles,
  SquarePlus,
  WalletCards,
  type LucideIcon,
} from 'lucide-react'
import { useEffect, useState, type ReactNode } from 'react'

import type { AndroidDistribution } from '#config/app_distribution'
import { PublicShell } from '~/components/public'
import { Badge } from '~/components/ui/badge'
import { Button } from '~/components/ui/button'
import { Card, CardContent } from '~/components/ui/card'
import { promptInstall, useInstallAvailability } from '~/pwa/install_prompt'

interface AppDownloadProps {
  android: AndroidDistribution
  pageUrl: string
  qrSvg: string
}

const installSteps = [
  {
    title: 'Baixe o arquivo',
    description: 'Toque em "Baixar para Android". O arquivo é grande; se puder, use o Wi-Fi.',
  },
  {
    title: 'Permita a instalação',
    description:
      'Ao abrir o arquivo, o Android pede para permitir apps desta fonte. É esperado: o app ainda não está na Play Store.',
  },
  {
    title: 'Instale e abra',
    description:
      'Toque em "Instalar" e abra o Experimente+. Explore sem conta ou entre com o seu usuário de teste.',
  },
] as const

const features = [
  {
    icon: Compass,
    title: 'Explore sem conta',
    description: 'Nove cidades do norte do Paraná, em lista ou no mapa, com agenda e novidades.',
  },
  {
    icon: MapPinned,
    title: 'Mapa da região',
    description:
      'Os lugares agrupados no mapa; toque em um para ver a foto, a nota e se está aberto.',
  },
  {
    icon: WalletCards,
    title: 'Carteira de benefícios',
    description: 'Compre pacotes e vouchers e apresente o benefício por um QR.',
  },
  {
    icon: ScanLine,
    title: 'Validação pelo parceiro',
    description: 'Quem atende confirma o benefício lendo o QR pela câmera do celular.',
  },
  {
    icon: MessageSquareText,
    title: 'Avaliações',
    description: 'Dê nota, comente e mande fotos dos lugares que você visitou.',
  },
  {
    icon: Sparkles,
    title: 'Concierge',
    description: 'Conte o que procura e receba sugestões de lugares publicados.',
  },
] as const

/** "2026-09-27" as "27 de setembro de 2026", the same day in any zone. */
function releaseDate(isoDate: string) {
  return new Intl.DateTimeFormat('pt-BR', { dateStyle: 'long', timeZone: 'UTC' }).format(
    new Date(`${isoDate}T12:00:00Z`)
  )
}

/**
 * Only the browser knows the device; the server renders for everyone and the
 * note for an iPhone appears once the page runs.
 */
function useAppleDevice() {
  const [device, setDevice] = useState({ apple: false, installed: false })
  useEffect(() => {
    const agent = navigator.userAgent
    setDevice({
      // iPadOS reports a Mac; its touch screen gives it away.
      apple:
        /iPhone|iPad|iPod/.test(agent) || (/Macintosh/.test(agent) && navigator.maxTouchPoints > 1),
      // Opened from the Home Screen icon: Safari's own flag, or the standard display mode.
      installed:
        (navigator as Navigator & { standalone?: boolean }).standalone === true ||
        window.matchMedia?.('(display-mode: standalone)').matches === true,
    })
  }, [])
  return device
}

/** The control to look for on the phone, drawn as a small chip with its icon. */
function Control({ icon: Icon, children }: { icon: LucideIcon; children?: ReactNode }) {
  return (
    <span className="inline-flex items-center gap-1 whitespace-nowrap rounded-md border border-border-subtle bg-background px-1.5 align-middle font-semibold leading-6 text-foreground">
      <Icon aria-hidden="true" className="size-4 shrink-0 text-primary-accent" />
      {children}
    </span>
  )
}

const iosSteps: { title: string; description: ReactNode }[] = [
  {
    title: 'Abra no Safari',
    description: (
      <>
        Abra esta página no <Control icon={Compass}>Safari</Control>. No computador, aponte a câmera
        do iPhone para o código QR do topo.
      </>
    ),
  },
  {
    title: 'Toque em Compartilhar',
    description: (
      <>
        Na barra do Safari, toque em <Control icon={Share}>Compartilhar</Control>. Se ele não
        aparecer, toque antes nos três pontos{' '}
        <Control icon={Ellipsis}>
          <span className="sr-only">Mais opções</span>
        </Control>
        .
      </>
    ),
  },
  {
    title: 'Adicione à Tela de Início',
    description: (
      <>
        Role as opções, escolha <Control icon={SquarePlus}>Adicionar à Tela de Início</Control> e
        confirme em <strong className="font-semibold text-foreground">Adicionar</strong>.
      </>
    ),
  },
  {
    title: 'Abra pelo ícone',
    description:
      'O ícone E+ fica na Tela de Início e abre o Experimente+ em tela cheia, sem a barra do Safari, com a mesma conta.',
  },
]

/**
 * Chromium (Chrome, Edge, Samsung Internet) can install the site itself. The
 * offer only exists when the browser made one, so elsewhere nothing shows.
 */
function SiteInstall() {
  const availability = useInstallAvailability()
  const [dismissed, setDismissed] = useState(false)

  if (availability === 'unavailable' && !dismissed) return null

  const install = async () => {
    const outcome = await promptInstall()
    if (outcome === 'dismissed') setDismissed(true)
  }

  return (
    <section aria-labelledby="site-install-title" className="app-container pb-12 sm:pb-16">
      <div className="flex flex-col gap-5 rounded-card border border-border-subtle bg-card p-5 sm:flex-row sm:items-center sm:justify-between sm:p-6">
        <div className="max-w-2xl">
          <h2
            id="site-install-title"
            className="font-display text-[1.3125rem] font-extrabold leading-tight tracking-[-0.01em]"
          >
            Ou instale o site
          </h2>
          <p className="mt-2 text-sm leading-6 text-muted-foreground sm:text-base sm:leading-7">
            Sem baixar arquivo: o Experimente+ ganha um ícone e abre em janela própria, como um app,
            com a mesma conta.
          </p>
        </div>
        {availability === 'installed' ? (
          <p
            role="status"
            className="flex shrink-0 items-center gap-2 text-sm font-semibold text-success-accent"
          >
            <CircleCheck aria-hidden="true" className="size-5" /> Site instalado
          </p>
        ) : dismissed ? (
          <p role="status" className="max-w-xs shrink-0 text-sm leading-6 text-muted-foreground">
            Tudo bem. Se mudar de ideia, use a opção de instalar do menu do navegador.
          </p>
        ) : (
          <Button
            type="button"
            variant="outline"
            size="xl"
            shape="pill"
            className="shrink-0"
            onClick={install}
          >
            <MonitorSmartphone aria-hidden="true" /> Instalar o site
          </Button>
        )}
      </div>
    </section>
  )
}

export default function AppDownload({ android, qrSvg }: AppDownloadProps) {
  const { apple, installed } = useAppleDevice()
  const qrSource = `data:image/svg+xml;charset=utf-8,${encodeURIComponent(qrSvg)}`

  return (
    <PublicShell
      title="Baixe o app Experimente+ (beta)"
      description="Versão beta do Experimente+ para Android: explore lugares do norte do Paraná, guarde favoritos e use benefícios pela carteira."
    >
      <section className="border-b bg-background">
        <div className="app-container grid gap-10 py-12 sm:py-16 lg:grid-cols-[minmax(0,1.2fr)_minmax(18rem,0.8fr)] lg:items-center lg:py-20">
          <div className="max-w-3xl">
            <div className="flex flex-wrap items-center gap-3">
              <p className="text-xs font-extrabold uppercase tracking-[0.1em] text-primary-accent sm:text-[0.8125rem]">
                Aplicativo
              </p>
              <Badge variant="warning" appearance="light">
                Beta
              </Badge>
            </div>
            <h1 className="mt-4 text-balance font-display text-[2.5rem] font-extrabold leading-[1.08] tracking-[-0.02em] sm:text-[3.5rem]">
              O Experimente+ no seu celular.
            </h1>
            <p className="mt-5 max-w-2xl text-base leading-7 text-muted-foreground sm:text-lg sm:leading-8">
              Descubra lugares, agenda e novidades das cidades do norte do Paraná sem criar conta.
              Com uma conta, guarde favoritos e roteiros, compre benefícios e apresente-os pela
              carteira.
            </p>

            <div className="mt-8 flex flex-col items-stretch gap-3 sm:flex-row sm:items-center">
              <Button variant="cta" size="2xl" shape="pill" asChild>
                <a href={android.downloadUrl} data-testid="android-download">
                  <Download /> Baixar para Android
                </a>
              </Button>
              <Button variant="outline" size="2xl" shape="pill" asChild>
                <Link href="/cidades">
                  <Compass /> Usar no navegador
                </Link>
              </Button>
            </div>
            <p className="mt-4 text-sm leading-6 text-muted-foreground">
              Versão {android.version} · {releaseDate(android.releasedAt)} · cerca de{' '}
              {android.sizeMegabytes} MB · Android {android.minimumAndroid} ou superior
            </p>

            {apple ? (
              <p
                role="status"
                className="mt-5 rounded-card border border-info/30 bg-info/10 px-4 py-3 text-sm leading-6"
              >
                {installed ? (
                  'Você está usando o Experimente+ instalado na Tela de Início. O app para iOS chega depois, pela App Store.'
                ) : (
                  <>
                    Você está num iPhone ou iPad. O app para iOS ainda não está disponível, mas dá
                    para instalar o site na Tela de Início e usá-lo como um app.{' '}
                    <a
                      href="#instalar-no-iphone"
                      className="font-semibold text-primary-accent underline underline-offset-4 outline-none focus-visible:ring-2 focus-visible:ring-ring"
                    >
                      Veja como
                    </a>
                  </>
                )}
              </p>
            ) : null}
          </div>

          {/* A code to scan is only useful away from the phone. */}
          <Card className="hidden w-full max-w-sm border border-border-subtle bg-card md:block lg:justify-self-end">
            <CardContent className="p-6 text-center">
              <span className="mx-auto flex size-11 items-center justify-center rounded-full bg-primary-soft text-primary-accent">
                <Smartphone aria-hidden="true" className="size-5" />
              </span>
              <h2 className="mt-4 font-display text-[1.3125rem] font-extrabold leading-tight tracking-[-0.01em]">
                Está no computador?
              </h2>
              <p className="mt-2 text-sm leading-6 text-muted-foreground">
                Aponte a câmera do celular para abrir esta página nele.
              </p>
              <img
                src={qrSource}
                alt="Código QR que abre esta página no celular"
                width={200}
                height={200}
                className="mx-auto mt-5 size-50 rounded-lg border border-border-subtle bg-white p-2"
              />
            </CardContent>
          </Card>
        </div>
      </section>

      <section aria-labelledby="beta-title" className="app-container pt-12 sm:pt-16">
        <div className="rounded-card border border-warning/30 bg-warning/10 p-5 sm:p-6">
          <h2
            id="beta-title"
            className="font-display text-[1.3125rem] font-extrabold leading-tight tracking-[-0.01em]"
          >
            Esta é uma versão beta
          </h2>
          <ul className="mt-3 list-disc space-y-1.5 pl-5 text-sm leading-6 sm:text-base sm:leading-7">
            <li>
              O app usa o ambiente de homologação: lugares, eventos e benefícios são fictícios, de
              demonstração.
            </li>
            <li>Pagamentos são simulados; nada é cobrado.</li>
            <li>Pode haver falhas. Conte à equipe do Experimente+ o que encontrar.</li>
          </ul>
        </div>
      </section>

      <section aria-labelledby="install-title" className="app-container py-12 sm:py-16">
        <p className="text-xs font-extrabold uppercase tracking-[0.1em] text-primary-accent">
          Android
        </p>
        <h2
          id="install-title"
          className="mt-2 font-display text-[1.75rem] font-extrabold leading-[1.15] tracking-[-0.02em] sm:text-[2rem]"
        >
          Como instalar
        </h2>
        <ol className="mt-6 grid gap-4 md:grid-cols-3">
          {installSteps.map((step, index) => (
            <li key={step.title}>
              <Card className="h-full border border-border-subtle bg-card">
                <CardContent className="p-5 sm:p-6">
                  <span
                    aria-hidden="true"
                    className="flex size-9 items-center justify-center rounded-full bg-primary text-sm font-extrabold text-primary-foreground"
                  >
                    {index + 1}
                  </span>
                  <h3 className="mt-4 font-display text-lg font-extrabold leading-tight">
                    {step.title}
                  </h3>
                  <p className="mt-2 text-sm leading-6 text-muted-foreground">{step.description}</p>
                </CardContent>
              </Card>
            </li>
          ))}
        </ol>
        <p className="mt-5 max-w-3xl text-sm leading-6 text-muted-foreground">
          Requer Android {android.minimumAndroid} ou superior, em celular de 64 bits (praticamente
          todos desde 2017). Quando sair uma versão nova, é só baixar de novo e instalar por cima:
          sua conta e seus dados continuam.
        </p>
      </section>

      <SiteInstall />

      <section
        id="instalar-no-iphone"
        aria-labelledby="ios-title"
        className="scroll-mt-20 border-y bg-muted/40"
      >
        <div className="app-container py-12 sm:py-16">
          <p className="text-xs font-extrabold uppercase tracking-[0.1em] text-primary-accent">
            iPhone e iPad
          </p>
          <h2
            id="ios-title"
            className="mt-2 font-display text-[1.75rem] font-extrabold leading-[1.15] tracking-[-0.02em] sm:text-[2rem]"
          >
            Instale no iPhone
          </h2>
          <p className="mt-3 max-w-3xl text-sm leading-6 text-muted-foreground sm:text-base sm:leading-7">
            O app para iOS chega depois, pela App Store. Enquanto isso, o site funciona como um app:
            adicione-o à Tela de Início pelo Safari.
          </p>
          <ol className="mt-6 grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
            {iosSteps.map((step, index) => (
              <li key={step.title}>
                <Card className="h-full border border-border-subtle bg-card">
                  <CardContent className="p-5 sm:p-6">
                    <span
                      aria-hidden="true"
                      className="flex size-9 items-center justify-center rounded-full bg-primary text-sm font-extrabold text-primary-foreground"
                    >
                      {index + 1}
                    </span>
                    <h3 className="mt-4 font-display text-lg font-extrabold leading-tight">
                      {step.title}
                    </h3>
                    <p className="mt-2 text-sm leading-7 text-muted-foreground">
                      {step.description}
                    </p>
                  </CardContent>
                </Card>
              </li>
            ))}
          </ol>
          <p className="mt-5 max-w-3xl text-sm leading-6 text-muted-foreground">
            Em outros navegadores do iPhone, como Chrome e Edge, a opção fica no mesmo menu
            Compartilhar.
          </p>
        </div>
      </section>

      <section aria-labelledby="features-title" className="app-container py-12 sm:py-16">
        <h2
          id="features-title"
          className="font-display text-[1.75rem] font-extrabold leading-[1.15] tracking-[-0.02em] sm:text-[2rem]"
        >
          O que dá para fazer no app
        </h2>
        <ul className="mt-6 grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
          {features.map(({ icon: Icon, title, description }) => (
            <li
              key={title}
              className="flex gap-4 rounded-card border border-border-subtle bg-card p-5"
            >
              <span className="flex size-11 shrink-0 items-center justify-center rounded-full bg-primary-soft text-primary-accent">
                <Icon aria-hidden="true" className="size-5" />
              </span>
              <div>
                <h3 className="font-display text-base font-extrabold leading-tight">{title}</h3>
                <p className="mt-1.5 text-sm leading-6 text-muted-foreground">{description}</p>
              </div>
            </li>
          ))}
        </ul>

        <div className="mt-10 border-t border-border-subtle pt-6 text-xs leading-5 text-muted-foreground">
          <a
            href={android.releaseUrl}
            target="_blank"
            rel="noopener noreferrer"
            className="inline-flex min-h-11 items-center font-semibold text-primary-accent underline-offset-4 outline-none hover:underline focus-visible:ring-2 focus-visible:ring-ring"
          >
            Notas desta versão e versões anteriores
            <span className="sr-only"> (abre em nova aba)</span>
          </a>
          <p className="break-all">
            Integridade do arquivo (SHA-256): <code className="font-mono">{android.sha256}</code>
          </p>
        </div>
      </section>
    </PublicShell>
  )
}
