import { Head, Link } from '@inertiajs/react'
import { ArrowRight, Compass, MapPinned, Route, Store } from 'lucide-react'

import { Button } from '~/components/ui/button'
import { useApp } from '~/hooks/use_app'

const highlights = [
  {
    title: 'Descobrir',
    description: 'Encontrar lugares, experiências e negócios locais que merecem ser conhecidos.',
    icon: Compass,
  },
  {
    title: 'Planejar',
    description: 'Organizar passeios e roteiros com informações confiáveis sobre cada destino.',
    icon: Route,
  },
  {
    title: 'Fortalecer a região',
    description: 'Aproximar pessoas e parceiros locais em uma experiência digital simples.',
    icon: Store,
  },
]

export default function Home() {
  const application = useApp()

  return (
    <div className="min-h-screen bg-background text-foreground">
      <Head title="Descubra o que está perto" />

      <header className="border-b border-border/70 bg-background/90 backdrop-blur">
        <div className="mx-auto flex h-16 max-w-6xl items-center justify-between px-5 sm:px-6">
          <Link href="/" className="flex items-center gap-2.5">
            <span className="flex size-9 items-center justify-center rounded-xl bg-primary text-lg font-bold text-primary-foreground">
              +
            </span>
            <span className="text-lg font-semibold tracking-tight">{application.name}</span>
          </Link>

          <nav className="flex items-center gap-2">
            {application.environment !== 'production' && (
              <a
                href="/docs"
                className="hidden text-sm text-muted-foreground hover:text-foreground sm:block"
              >
                API
              </a>
            )}
            <Link href="/login">
              <Button variant="ghost" size="sm">
                Entrar
              </Button>
            </Link>
            <Link href="/register">
              <Button size="sm">Criar conta</Button>
            </Link>
          </nav>
        </div>
      </header>

      <main>
        <section className="relative overflow-hidden border-b border-border/70">
          <div className="absolute inset-0 -z-10 bg-[radial-gradient(circle_at_top_left,hsl(var(--primary)/0.14),transparent_42%)]" />
          <div className="mx-auto grid max-w-6xl gap-12 px-5 py-20 sm:px-6 sm:py-28 lg:grid-cols-[1.2fr_0.8fr] lg:items-center">
            <div>
              <div className="mb-5 inline-flex items-center gap-2 rounded-full border border-border bg-background/80 px-3 py-1 text-sm text-muted-foreground">
                <MapPinned className="size-4 text-primary" />
                Produto regional em construção
              </div>

              <h1 className="max-w-3xl text-balance text-4xl font-bold tracking-tight sm:text-6xl">
                Descubra lugares e experiências que valem a visita.
              </h1>
              <p className="mt-6 max-w-2xl text-pretty text-lg leading-8 text-muted-foreground">
                O {application.name} está sendo preparado para conectar pessoas, experiências e
                negócios locais no norte do Paraná, entre Cornélio Procópio, Londrina e municípios
                próximos.
              </p>

              <div className="mt-9 flex flex-col gap-3 sm:flex-row">
                <Link href="/register">
                  <Button size="lg" className="w-full sm:w-auto">
                    Começar agora
                    <ArrowRight className="size-4" />
                  </Button>
                </Link>
                <Link href="/login">
                  <Button variant="outline" size="lg" className="w-full sm:w-auto">
                    Já tenho uma conta
                  </Button>
                </Link>
              </div>
            </div>

            <div className="rounded-3xl border border-border bg-card p-6 shadow-sm sm:p-8">
              <p className="text-sm font-medium text-primary">Estado do projeto</p>
              <h2 className="mt-2 text-2xl font-semibold">Fundação técnica pronta</h2>
              <p className="mt-3 leading-7 text-muted-foreground">
                Autenticação, segurança, permissões, workspaces, arquivos, testes e infraestrutura
                já estão configurados. A próxima etapa será definir o produto e seus domínios.
              </p>
              <div className="mt-6 h-2 overflow-hidden rounded-full bg-muted">
                <div className="h-full w-1/4 rounded-full bg-primary" />
              </div>
              <p className="mt-2 text-xs text-muted-foreground">
                Setup concluído · planejamento a seguir
              </p>
            </div>
          </div>
        </section>

        <section className="mx-auto max-w-6xl px-5 py-16 sm:px-6 sm:py-20">
          <div className="grid gap-5 md:grid-cols-3">
            {highlights.map((highlight) => (
              <article
                key={highlight.title}
                className="rounded-2xl border border-border bg-card p-6"
              >
                <span className="flex size-11 items-center justify-center rounded-xl bg-primary/10 text-primary">
                  <highlight.icon className="size-5" />
                </span>
                <h2 className="mt-5 text-lg font-semibold">{highlight.title}</h2>
                <p className="mt-2 text-sm leading-6 text-muted-foreground">
                  {highlight.description}
                </p>
              </article>
            ))}
          </div>
        </section>
      </main>

      <footer className="border-t border-border/70">
        <div className="mx-auto flex max-w-6xl flex-col gap-2 px-5 py-8 text-sm text-muted-foreground sm:flex-row sm:items-center sm:justify-between sm:px-6">
          <p>
            © {new Date().getFullYear()} {application.name}
          </p>
          <p>Construído com AdonisJS, React e Inertia.</p>
        </div>
      </footer>
    </div>
  )
}
