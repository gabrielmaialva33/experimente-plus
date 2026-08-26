import { Link } from '@inertiajs/react'
import { Compass, HeartHandshake, MapPinned, Store } from 'lucide-react'

import { AppBrand } from '~/components/app_brand'

const footerLinks = [
  { label: 'Explorar cidades', href: '/cidades' },
  { label: 'Entrar', href: '/login' },
  { label: 'Cadastrar negócio', href: '/register' },
] as const

export function PublicFooter() {
  return (
    <footer className="border-t bg-card/55">
      <div className="mx-auto w-full max-w-7xl px-4 py-10 sm:px-6 lg:px-8 lg:py-14">
        <div className="grid gap-10 lg:grid-cols-[1.2fr_1fr] lg:items-start">
          <div className="max-w-xl">
            <AppBrand href="/" />
            <p className="mt-4 text-sm leading-6 text-muted-foreground">
              Descoberta regional feita para aproximar pessoas de restaurantes, cafés, cultura,
              bem-estar e serviços locais — sem exigir cadastro para explorar.
            </p>
            <div className="mt-5 flex flex-wrap gap-2 text-xs text-muted-foreground">
              <span className="inline-flex items-center gap-1.5 rounded-full border bg-background px-3 py-1.5">
                <MapPinned className="size-3.5 text-primary" /> Norte do Paraná
              </span>
              <span className="inline-flex items-center gap-1.5 rounded-full border bg-background px-3 py-1.5">
                <Compass className="size-3.5 text-primary" /> Descoberta sem login
              </span>
            </div>
          </div>

          <div className="grid gap-7 sm:grid-cols-2 lg:justify-self-end">
            <div>
              <h2 className="text-sm font-semibold">Navegação</h2>
              <ul className="mt-3 space-y-2.5 text-sm text-muted-foreground">
                {footerLinks.map((item) => (
                  <li key={item.href}>
                    <Link href={item.href} className="transition-colors hover:text-foreground">
                      {item.label}
                    </Link>
                  </li>
                ))}
              </ul>
            </div>
            <div>
              <h2 className="text-sm font-semibold">Para a região</h2>
              <ul className="mt-3 space-y-2.5 text-sm text-muted-foreground">
                <li className="flex items-center gap-2">
                  <Store className="size-4 text-primary" /> Negócios locais
                </li>
                <li className="flex items-center gap-2">
                  <HeartHandshake className="size-4 text-primary" /> Curadoria humana
                </li>
              </ul>
            </div>
          </div>
        </div>

        <div className="mt-10 flex flex-col gap-2 border-t pt-6 text-xs text-muted-foreground sm:flex-row sm:items-center sm:justify-between">
          <p>&copy; {new Date().getFullYear()} Experimente+. Todos os direitos reservados.</p>
          <p>Conteúdo público revisado antes da publicação.</p>
        </div>
      </div>
    </footer>
  )
}
