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
        'flex items-center justify-center overflow-hidden bg-content-absent text-content-absent-foreground',
        className
      )}
    >
      <div className="flex max-w-[80%] flex-col items-center gap-3 text-center">
        <span
          aria-hidden="true"
          className="flex size-14 items-center justify-center rounded-md border border-content-absent-border border-dashed bg-content-absent text-2xl font-semibold"
        >
          {initial}
        </span>
        <span className="max-w-full truncate text-xs font-medium text-content-absent-foreground">
          {categoryName ?? 'Estabelecimento local'}
        </span>
      </div>
    </div>
  )
}
