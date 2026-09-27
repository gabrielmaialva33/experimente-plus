import { fireEvent, render, screen } from '@testing-library/react'
import { describe, expect, it } from 'vitest'

import { CatalogCoverImage } from '~/components/catalog/catalog_image_fallback'

describe('CatalogCoverImage', () => {
  it('shows the image while it loads and keeps its description', () => {
    render(
      <CatalogCoverImage
        src="/uploads/aurora.webp"
        alt="Balcão do Café Aurora"
        name="Café Aurora"
        categoryName="Cafés"
        className="aspect-[16/9] w-full object-cover"
      />
    )

    const image = screen.getByRole('img', { name: 'Balcão do Café Aurora' })
    expect(image).toHaveAttribute('src', '/uploads/aurora.webp')
    expect(image).toHaveAttribute('loading', 'lazy')
  })

  it('turns into the illustrated placeholder when the file cannot be delivered', () => {
    // A missing upload left an empty white box with the browser's broken-image text.
    render(
      <CatalogCoverImage
        src="/uploads/missing.webp"
        alt="Balcão do Café Aurora"
        name="Café Aurora"
        categoryName="Cafés"
        className="aspect-[16/9] w-full object-cover"
        fallbackClassName="min-h-72 w-full"
      />
    )

    fireEvent.error(screen.getByRole('img', { name: 'Balcão do Café Aurora' }))

    const placeholder = screen.getByRole('img', { name: 'Imagem ilustrativa de Café Aurora' })
    expect(placeholder).toHaveClass('min-h-72', 'w-full')
    expect(placeholder).toHaveTextContent('Cafés')
    expect(screen.queryByRole('img', { name: 'Balcão do Café Aurora' })).not.toBeInTheDocument()
  })
})
