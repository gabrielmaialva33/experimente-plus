import { Link } from '@inertiajs/react'
import {
  BadgeCheck,
  Clapperboard,
  Coffee,
  Compass,
  MapPinned,
  Store,
  UtensilsCrossed,
} from 'lucide-react'

import { PublicShell } from '~/components/public'
import { Button } from '~/components/ui/button'
import { Card, CardContent } from '~/components/ui/card'

const categories = [
  {
    label: 'Restaurantes',
    description: 'Almoço, jantar e experiências gastronômicas.',
    icon: UtensilsCrossed,
  },
  {
    label: 'Cafés e padarias',
    description: 'Café, brunch, doces, pães e pausas pela cidade.',
    icon: Coffee,
  },
  {
    label: 'Cultura e lazer',
    description: 'Cinema, programação cultural e espaços para conhecer.',
    icon: Clapperboard,
  },
  {
    label: 'Serviços locais',
    description: 'Beleza, bem-estar, tatuagem e outros serviços.',
    icon: Store,
  },
] as const

const establishmentDetails = [
  'Endereço e horários de atendimento',
  'Categorias e características do lugar',
  'Fotos e canais de contato disponíveis',
] as const

const discoverySteps = [
  {
    title: 'Escolha uma cidade',
    description: 'Veja os estabelecimentos e serviços publicados naquela região.',
  },
  {
    title: 'Filtre ou pesquise',
    description: 'Use categorias, nome e informações de atendimento para comparar opções.',
  },
  {
    title: 'Abra a ficha',
    description: 'Confira os detalhes e siga para o canal de contato do estabelecimento.',
  },
] as const

export default function Home() {
  return (
    <PublicShell
      title="Experimente+ — Lugares e serviços da sua região"
      description="Encontre restaurantes, cafés, cultura, bem-estar e serviços locais em cidades do Norte do Paraná."
    >
      <section className="border-b bg-primary-soft/35">
        <div className="app-container grid gap-10 py-12 sm:py-16 lg:grid-cols-[minmax(0,1.15fr)_minmax(20rem,0.85fr)] lg:items-center lg:py-20">
          <div className="max-w-3xl">
            <p className="text-sm font-semibold text-primary-accent">
              Descoberta regional no Norte do Paraná
            </p>
            <h1 className="mt-4 text-4xl font-bold leading-[1.08] tracking-tight text-balance sm:text-5xl lg:text-6xl">
              Encontre lugares e serviços na sua cidade.
            </h1>
            <p className="mt-5 max-w-2xl text-base leading-7 text-muted-foreground sm:text-lg sm:leading-8">
              Escolha uma cidade para explorar restaurantes, cafés, cultura, bem-estar e outros
              negócios locais com informações organizadas em um só lugar.
            </p>

            <div className="mt-8 flex flex-col items-start gap-3 sm:flex-row sm:items-center">
              <Button variant="cta" size="lg" asChild>
                <Link href="/cidades">
                  <Compass /> Escolher uma cidade
                </Link>
              </Button>
              <p className="text-sm text-muted-foreground">Explore sem precisar criar uma conta.</p>
            </div>
          </div>

          <Card className="w-full max-w-2xl bg-card lg:max-w-lg lg:justify-self-end">
            <CardContent className="p-0">
              <div className="border-b p-5 sm:p-6">
                <span className="flex size-10 items-center justify-center rounded-md bg-primary-soft text-primary-accent">
                  <MapPinned className="size-5" />
                </span>
                <h2 className="mt-4 text-xl font-semibold">Informação para decidir</h2>
                <p className="mt-2 text-sm leading-6 text-muted-foreground">
                  Cada ficha reúne o contexto público disponível sobre o estabelecimento.
                </p>
              </div>
              <ul className="divide-y" aria-label="Informações disponíveis nas fichas">
                {establishmentDetails.map((detail) => (
                  <li key={detail} className="flex items-start gap-3 px-5 py-4 text-sm sm:px-6">
                    <BadgeCheck className="mt-0.5 size-4 shrink-0 text-primary-accent" />
                    <span>{detail}</span>
                  </li>
                ))}
              </ul>
              <p className="border-t bg-muted/50 px-5 py-4 text-xs leading-5 text-muted-foreground sm:px-6">
                O conteúdo público passa por revisão antes de aparecer no catálogo.
              </p>
            </CardContent>
          </Card>
        </div>
      </section>

      <section aria-labelledby="categories-title" className="app-container py-12 sm:py-16 lg:py-20">
        <div className="max-w-2xl">
          <p className="text-sm font-semibold text-primary-accent">Categorias</p>
          <h2 id="categories-title" className="mt-2 text-2xl font-bold tracking-tight sm:text-3xl">
            O que você pode encontrar
          </h2>
          <p className="mt-3 leading-7 text-muted-foreground">
            A disponibilidade varia por cidade. Estas são algumas das categorias previstas no
            catálogo regional.
          </p>
        </div>

        <ul className="mt-8 grid border-y sm:grid-cols-2 lg:grid-cols-4">
          {categories.map((category, index) => {
            const Icon = category.icon
            return (
              <li
                key={category.label}
                className={`py-5 sm:p-5 ${index > 0 ? 'border-t' : ''} ${
                  index === 1 ? 'sm:border-t-0' : ''
                } ${index % 2 === 1 ? 'sm:border-l' : ''} ${index > 1 ? 'lg:border-t-0' : ''} ${
                  index > 0 ? 'lg:border-l' : ''
                }`}
              >
                <Icon className="size-5 text-primary-accent" />
                <h3 className="mt-3 font-semibold">{category.label}</h3>
                <p className="mt-1.5 text-sm leading-6 text-muted-foreground">
                  {category.description}
                </p>
              </li>
            )
          })}
        </ul>
      </section>

      <section aria-labelledby="how-title" className="border-y bg-primary text-primary-foreground">
        <div className="app-container py-12 sm:py-14">
          <div className="max-w-2xl">
            <p className="text-sm font-semibold text-primary-foreground/85">Como funciona</p>
            <h2 id="how-title" className="mt-2 text-2xl font-bold tracking-tight sm:text-3xl">
              Da cidade até o contato
            </h2>
          </div>

          <ol className="mt-8 grid border-y border-primary-foreground/25 lg:grid-cols-3">
            {discoverySteps.map((step, index) => (
              <li
                key={step.title}
                className={`py-5 lg:p-6 ${
                  index > 0 ? 'border-t border-primary-foreground/25 lg:border-l lg:border-t-0' : ''
                }`}
              >
                <span className="text-sm font-bold text-primary-foreground/85">
                  {String(index + 1).padStart(2, '0')}
                </span>
                <h3 className="mt-3 font-semibold">{step.title}</h3>
                <p className="mt-2 text-sm leading-6 text-primary-foreground/85">
                  {step.description}
                </p>
              </li>
            ))}
          </ol>
        </div>
      </section>

      <section aria-labelledby="partner-title" className="app-container py-12 sm:py-16 lg:py-20">
        <Card>
          <CardContent className="grid gap-6 p-6 sm:p-8 lg:grid-cols-[1fr_auto] lg:items-center">
            <div className="max-w-2xl">
              <p className="text-sm font-semibold text-primary-accent">Para negócios da região</p>
              <h2 id="partner-title" className="mt-2 text-2xl font-bold tracking-tight sm:text-3xl">
                Seu negócio atende em uma das cidades da plataforma?
              </h2>
              <p className="mt-3 leading-7 text-muted-foreground">
                Crie uma conta para cadastrar sua organização e preparar as fichas das unidades. A
                publicação depende de revisão.
              </p>
            </div>
            <Button variant="cta" size="lg" className="w-full sm:w-auto" asChild>
              <Link href="/register">
                <Store /> Cadastrar negócio
              </Link>
            </Button>
          </CardContent>
        </Card>
      </section>
    </PublicShell>
  )
}
