import { ImageIcon } from 'lucide-react'

import { cn } from '~/lib/utils'

interface CatalogImageFallbackProps {
  name: string
  categoryName?: string | null
  className?: string
}

export function CatalogImageFallback({ name, categoryName, className }: CatalogImageFallbackProps) {
  const initial = name.trim().charAt(0).toLocaleUpperCase('pt-BR') || 'E'

  return (
    <div
      role="img"
      aria-label={`Imagem ilustrativa de ${name}`}
      className={cn(
        'relative isolate flex overflow-hidden bg-gradient-to-br from-primary/20 via-accent to-warning/25 text-foreground',
        className
      )}
    >
      <div
        aria-hidden="true"
        className="absolute inset-0 bg-grid-pattern opacity-30 [mask-image:linear-gradient(to_bottom,black,transparent)]"
      />
      <div
        aria-hidden="true"
        className="absolute -start-10 -top-12 size-44 rounded-full bg-primary/30 blur-3xl"
      />
      <div
        aria-hidden="true"
        className="absolute -end-12 bottom-0 size-48 rounded-full bg-warning/35 blur-3xl"
      />

      <div className="relative m-auto flex max-w-[80%] flex-col items-center gap-3 text-center">
        <span className="flex size-16 items-center justify-center rounded-2xl border border-white/35 bg-background/80 text-3xl font-bold tracking-[-0.04em] text-primary shadow-lg backdrop-blur">
          {initial}
        </span>
        <span className="inline-flex max-w-full items-center gap-1.5 rounded-full border border-white/30 bg-background/75 px-3 py-1.5 text-xs font-medium shadow-sm backdrop-blur">
          <ImageIcon className="size-3.5 shrink-0 text-primary" aria-hidden="true" />
          <span className="truncate">{categoryName ?? 'Estabelecimento local'}</span>
        </span>
      </div>
    </div>
  )
}
