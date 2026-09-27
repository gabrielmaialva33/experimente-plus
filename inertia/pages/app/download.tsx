import { Link } from '@inertiajs/react'
import {
  Compass,
  Download,
  MapPinned,
  MessageSquareText,
  ScanLine,
  Smartphone,
  Sparkles,
  WalletCards,
} from 'lucide-react'
import { useEffect, useState } from 'react'

import type { AndroidDistribution } from '#config/app_distribution'
import { PublicShell } from '~/components/public'
import { Badge } from '~/components/ui/badge'
import { Button } from '~/components/ui/button'
import { Card, CardContent } from '~/components/ui/card'

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
function useIsAppleMobile() {
  const [apple, setApple] = useState(false)
  useEffect(() => {
    const agent = navigator.userAgent
    // iPadOS reports a Mac; its touch screen gives it away.
    setApple(
      /iPhone|iPad|iPod/.test(agent) || (/Macintosh/.test(agent) && navigator.maxTouchPoints > 1)
    )
  }, [])
  return apple
}

export default function AppDownload({ android, qrSvg }: AppDownloadProps) {
  const appleMobile = useIsAppleMobile()
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

            {appleMobile ? (
              <p
                role="status"
                className="mt-5 rounded-card border border-info/30 bg-info/10 px-4 py-3 text-sm leading-6"
              >
                Você está num iPhone ou iPad. O app para iOS ainda não está disponível; por
                enquanto, use o Experimente+ pelo navegador.
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

      <section aria-labelledby="ios-title" className="border-y bg-muted/40">
        <div className="app-container flex flex-col gap-5 py-10 sm:flex-row sm:items-center sm:justify-between">
          <div className="max-w-2xl">
            <h2
              id="ios-title"
              className="font-display text-[1.3125rem] font-extrabold leading-tight tracking-[-0.01em]"
            >
              No iPhone
            </h2>
            <p className="mt-2 text-sm leading-6 text-muted-foreground sm:text-base sm:leading-7">
              A versão para iOS chega depois, pela App Store. Por enquanto, use o Experimente+ pelo
              navegador do iPhone, com a mesma conta.
            </p>
          </div>
          <Button variant="outline" size="xl" shape="pill" asChild>
            <Link href="/cidades">
              <Compass /> Abrir no navegador
            </Link>
          </Button>
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
