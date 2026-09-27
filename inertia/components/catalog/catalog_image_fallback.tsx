import { useEffect, useRef, useState } from 'react'

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
          {categoryName ?? 'Lugar da região'}
        </span>
      </div>
    </div>
  )
}

interface CatalogCoverImageProps {
  src: string
  alt: string
  /** Names the placeholder that replaces an image the server cannot deliver. */
  name: string
  categoryName?: string | null
  width?: number | null
  height?: number | null
  loading?: 'lazy' | 'eager'
  className?: string
  /** Size classes for the placeholder when they differ from the image's. */
  fallbackClassName?: string
}

/**
 * A catalogue image that turns into the illustrated placeholder when it fails to
 * load, instead of leaving an empty box with the browser's broken-image alt text.
 */
export function CatalogCoverImage({
  src,
  alt,
  name,
  categoryName,
  width,
  height,
  loading = 'lazy',
  className,
  fallbackClassName,
}: CatalogCoverImageProps) {
  const imageRef = useRef<HTMLImageElement>(null)
  const [failedSrc, setFailedSrc] = useState<string | null>(null)

  useEffect(() => {
    // An image that failed while the server-rendered page was hydrating never reported
    // its error to React; a finished load with no pixels is that failure.
    const image = imageRef.current
    if (image?.complete && image.naturalWidth === 0) setFailedSrc(src)
  }, [src])

  if (failedSrc === src) {
    return (
      <CatalogImageFallback
        name={name}
        categoryName={categoryName}
        className={fallbackClassName ?? className}
      />
    )
  }

  return (
    <img
      ref={imageRef}
      src={src}
      alt={alt}
      width={width ?? undefined}
      height={height ?? undefined}
      loading={loading}
      decoding="async"
      onError={() => setFailedSrc(src)}
      className={className}
    />
  )
}
