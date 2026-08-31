import { Link } from '@inertiajs/react'
import {
  ArrowRight,
  BadgeCheck,
  Building2,
  Clapperboard,
  Coffee,
  Compass,
  HeartHandshake,
  MapPinned,
  Search,
  Sparkles,
  Store,
  UtensilsCrossed,
} from 'lucide-react'

import { PublicShell } from '~/components/public'
import { Button } from '~/components/ui/button'

const categories = [
  {
    label: 'Restaurantes',
    description: 'Do almoço de todo dia à experiência para uma ocasião especial.',
    icon: UtensilsCrossed,
  },
  {
    label: 'Cafés e padarias',
    description: 'Café, brunch, doces, pães e boas pausas pela cidade.',
    icon: Coffee,
  },
  {
    label: 'Cultura e cinema',
    description: 'Programas culturais, salas, espaços e experiências para descobrir.',
    icon: Clapperboard,
  },
  {
    label: 'Serviços locais',
    description: 'Beleza, bem-estar, tatuagem e outros negócios da região.',
    icon: Store,
  },
] as const

const discoverySteps = [
  {
    title: 'Escolha sua cidade',
    description: 'Comece pelo lugar onde você está ou por uma cidade que deseja conhecer.',
    icon: MapPinned,
  },
  {
    title: 'Refine sua busca',
    description: 'Navegue por categorias, pesquise pelo nome e veja o que está aberto agora.',
    icon: Search,
  },
  {
    title: 'Decida com contexto',
    description: 'Consulte endereço, horários, características, mídia e canais de contato.',
    icon: BadgeCheck,
  },
] as const

export default function Home() {
  return (
    <PublicShell
      title="Experimente+ — Descubra o melhor da sua região"
      description="Encontre restaurantes, cafés, cultura, bem-estar e serviços locais em cidades do Norte do Paraná."
    >
      <section className="relative overflow-hidden border-b bg-gradient-to-br from-primary/12 via-background to-cta/12">
        <div className="absolute inset-0 bg-grid-pattern opacity-[0.24] [mask-image:linear-gradient(to_bottom,black,transparent)]" />
        <div className="absolute -start-32 top-20 size-80 rounded-full bg-primary/12 blur-3xl" />
        <div className="absolute -end-24 bottom-0 size-72 rounded-full bg-cta/15 blur-3xl" />

        <div className="relative mx-auto grid w-full max-w-7xl gap-12 px-4 py-16 sm:px-6 sm:py-20 lg:grid-cols-[1.08fr_0.92fr] lg:items-center lg:px-8 lg:py-28">
          <div className="max-w-3xl">
            <div className="inline-flex items-center gap-2 rounded-full border bg-background/80 px-3 py-1.5 text-xs font-semibold text-primary shadow-sm backdrop-blur">
              <Sparkles className="size-3.5" /> Descoberta regional, sem exigir cadastro
            </div>

            <h1 className="mt-6 text-4xl font-bold leading-[1.04] tracking-[-0.045em] sm:text-5xl lg:text-6xl">
              Mais perto do que você imagina.{' '}
              <span className="text-primary">Mais interessante do que você esperava.</span>
            </h1>

            <p className="mt-6 max-w-2xl text-base leading-8 text-muted-foreground sm:text-lg">
              Descubra restaurantes, cafés, cultura, bem-estar e serviços locais com informações
              publicadas, organizadas e fáceis de usar.
            </p>

            <div className="mt-8 flex flex-col gap-3 sm:flex-row">
              <Button variant="cta" size="lg" className="h-12 px-6" asChild>
                <Link href="/cidades">
                  <Compass className="size-4" /> Explorar cidades
                </Link>
              </Button>
              <Button variant="outline" size="lg" className="h-12 px-6" asChild>
                <Link href="/register">
                  <Store className="size-4" /> Cadastrar meu negócio
                </Link>
              </Button>
            </div>

            <div className="mt-8 flex flex-wrap gap-x-5 gap-y-2 text-xs text-muted-foreground">
              <span className="inline-flex items-center gap-1.5">
                <BadgeCheck className="size-3.5 text-primary" /> Fichas revisadas antes da
                publicação
              </span>
              <span className="inline-flex items-center gap-1.5">
                <MapPinned className="size-3.5 text-primary" /> Norte do Paraná como região inicial
              </span>
            </div>
          </div>

          <div className="relative mx-auto w-full max-w-xl lg:justify-self-end">
            <div className="absolute inset-8 rounded-[2rem] bg-primary/15 blur-3xl" />
            <div className="relative overflow-hidden rounded-[2rem] border bg-card/92 p-5 shadow-2xl backdrop-blur sm:p-7">
              <div className="flex items-center justify-between gap-4 border-b pb-5">
                <div>
                  <p className="text-xs font-semibold uppercase tracking-[0.15em] text-primary">
                    Comece por aqui
                  </p>
                  <h2 className="mt-1 text-xl font-semibold">O que combina com hoje?</h2>
                </div>
                <span className="flex size-11 items-center justify-center rounded-xl bg-accent text-accent-foreground">
                  <Compass className="size-5" />
                </span>
              </div>

              <div className="mt-5 grid gap-3 sm:grid-cols-2">
                {categories.map((category) => {
                  const Icon = category.icon
                  return (
                    <div
                      key={category.label}
                      className="rounded-xl border bg-background p-4 transition hover:border-primary/30 hover:shadow-sm"
                    >
                      <Icon className="size-5 text-primary" />
                      <h3 className="mt-3 text-sm font-semibold">{category.label}</h3>
                      <p className="mt-1.5 text-xs leading-5 text-muted-foreground">
                        {category.description}
                      </p>
                    </div>
                  )
                })}
              </div>

              <Button variant="outline" className="mt-5 w-full" asChild>
                <Link href="/cidades">
                  Ver o catálogo regional <ArrowRight className="size-4" />
                </Link>
              </Button>
            </div>
          </div>
        </div>
      </section>

      <section
        aria-labelledby="categories-title"
        className="mx-auto w-full max-w-7xl px-4 py-16 sm:px-6 lg:px-8 lg:py-20"
      >
        <div className="max-w-2xl">
          <p className="text-xs font-semibold uppercase tracking-[0.17em] text-primary">
            Mais que gastronomia
          </p>
          <h2
            id="categories-title"
            className="mt-3 text-3xl font-bold tracking-[-0.035em] sm:text-4xl"
          >
            Uma plataforma regional preparada para diferentes experiências
          </h2>
          <p className="mt-4 leading-7 text-muted-foreground">
            Gastronomia é a primeira vertical. A mesma estrutura também acolhe cultura, beleza,
            bem-estar e outros serviços que fazem parte da vida local.
          </p>
        </div>

        <div className="mt-9 grid gap-5 sm:grid-cols-2 lg:grid-cols-4">
          {categories.map((category) => {
            const Icon = category.icon
            return (
              <article key={category.label} className="rounded-2xl border bg-card p-6 shadow-sm">
                <span className="flex size-11 items-center justify-center rounded-xl bg-accent text-accent-foreground">
                  <Icon className="size-5" />
                </span>
                <h3 className="mt-5 text-lg font-semibold">{category.label}</h3>
                <p className="mt-2 text-sm leading-6 text-muted-foreground">
                  {category.description}
                </p>
              </article>
            )
          })}
        </div>
      </section>

      <section aria-labelledby="how-title" className="border-y bg-muted/35">
        <div className="mx-auto w-full max-w-7xl px-4 py-16 sm:px-6 lg:px-8 lg:py-20">
          <div className="max-w-2xl">
            <p className="text-xs font-semibold uppercase tracking-[0.17em] text-primary">
              Simples para explorar
            </p>
            <h2 id="how-title" className="mt-3 text-3xl font-bold tracking-[-0.035em] sm:text-4xl">
              Da curiosidade à decisão em poucos passos
            </h2>
          </div>

          <ol className="mt-9 grid gap-5 lg:grid-cols-3">
            {discoverySteps.map((step, index) => {
              const Icon = step.icon
              return (
                <li
                  key={step.title}
                  className="relative rounded-2xl border bg-background p-6 shadow-sm"
                >
                  <div className="flex items-center justify-between gap-4">
                    <span className="flex size-11 items-center justify-center rounded-xl bg-accent text-accent-foreground">
                      <Icon className="size-5" />
                    </span>
                    <span className="text-4xl font-bold text-primary/15">0{index + 1}</span>
                  </div>
                  <h3 className="mt-5 text-lg font-semibold">{step.title}</h3>
                  <p className="mt-2 text-sm leading-6 text-muted-foreground">{step.description}</p>
                </li>
              )
            })}
          </ol>
        </div>
      </section>

      <section
        aria-labelledby="partner-title"
        className="mx-auto w-full max-w-7xl px-4 py-16 sm:px-6 lg:px-8 lg:py-20"
      >
        <div className="relative overflow-hidden rounded-3xl border bg-gradient-to-br from-primary via-primary to-primary/80 px-6 py-10 text-primary-foreground shadow-xl sm:px-10 sm:py-12 lg:px-14">
          <div className="absolute -end-20 -top-24 size-72 rounded-full bg-white/10 blur-3xl" />
          <div className="relative grid gap-8 lg:grid-cols-[1fr_auto] lg:items-center">
            <div className="max-w-2xl">
              <p className="flex items-center gap-2 text-xs font-semibold uppercase tracking-[0.17em] text-primary-foreground/75">
                <HeartHandshake className="size-4" /> Para negócios da região
              </p>
              <h2
                id="partner-title"
                className="mt-3 text-3xl font-bold tracking-[-0.035em] sm:text-4xl"
              >
                Sua presença local merece uma ficha completa e fácil de encontrar
              </h2>
              <p className="mt-4 max-w-xl leading-7 text-primary-foreground/80">
                Organize unidades, horários, categorias, características, mídia e contatos em um
                fluxo acompanhado até a publicação.
              </p>
            </div>
            <div className="flex flex-col gap-3 sm:flex-row lg:flex-col">
              <Button size="lg" variant="cta" className="h-12" asChild>
                <Link href="/register">
                  <Building2 className="size-4" /> Criar minha conta
                </Link>
              </Button>
              <Button
                size="lg"
                variant="ghost"
                className="h-12 border border-white/20 text-white hover:bg-white/10 hover:text-white"
                asChild
              >
                <Link href="/login">Já tenho acesso</Link>
              </Button>
            </div>
          </div>
        </div>
      </section>
    </PublicShell>
  )
}
