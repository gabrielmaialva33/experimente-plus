import { Link } from '@inertiajs/react'

import { AppBrand } from '~/components/app_brand'
import { PUBLIC_NAVIGATION } from '~/config/navigation'

export function PublicFooter() {
  return (
    <footer className="border-t bg-background">
      <div className="app-container py-8 sm:py-10">
        <div className="flex flex-col gap-7 lg:flex-row lg:items-start lg:justify-between">
          <div className="max-w-lg">
            <AppBrand href="/" />
            <p className="mt-3 text-sm leading-6 text-muted-foreground">
              Encontre estabelecimentos e serviços publicados nas cidades atendidas pela
              plataforma. A descoberta pública não exige cadastro.
            </p>
          </div>

          <nav aria-label="Navegação do rodapé">
            <ul className="flex flex-wrap gap-x-6 gap-y-3 text-sm font-medium">
              {PUBLIC_NAVIGATION.footer.map((item) => (
                <li key={item.href}>
                  <Link
                    href={item.href}
                    className="text-muted-foreground transition-colors hover:text-foreground"
                  >
                    {item.label}
                  </Link>
                </li>
              ))}
            </ul>
          </nav>
        </div>

        <div className="mt-8 flex flex-col gap-2 border-t pt-5 text-xs text-muted-foreground sm:flex-row sm:items-center sm:justify-between">
          <p>&copy; {new Date().getFullYear()} Experimente+. Todos os direitos reservados.</p>
          <p>Conteúdo público revisado antes da publicação.</p>
        </div>
      </div>
    </footer>
  )
}
