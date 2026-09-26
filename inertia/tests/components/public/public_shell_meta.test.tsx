import type { ComponentProps, ReactNode } from 'react'
import { describe, expect, it, vi } from 'vitest'

import { PublicShell } from '~/components/public/public_shell'
import { render } from '~/tests/test_utils'

vi.mock('@inertiajs/react', () => ({
  Head: ({ children }: { children?: ReactNode }) => <>{children}</>,
  Link: ({ href, children, ...props }: ComponentProps<'a'> & { href: string }) => (
    <a href={href} {...props}>
      {children}
    </a>
  ),
  router: { post: vi.fn() },
  usePage: () => ({
    url: '/cidades/londrina',
    props: { auth: { user: null, tenants: [], activeTenantId: null, permissions: [] } },
  }),
}))

vi.mock('~/components/theme/theme_toggle', () => ({
  ThemeToggle: () => <button type="button">Alterar tema</button>,
}))

// React 19 hoists <meta> into document.head, as the SSR output places it.
function metaContent(selector: string) {
  return document.head.querySelector(selector)?.getAttribute('content')
}

describe('public page metadata', () => {
  it('names the site and its locale, and previews a place photo as a large card', () => {
    render(
      <PublicShell
        title="Bar Estação 43"
        description="Bar regional com música ao vivo."
        image="https://cdn.example/bar.png"
      >
        <p>Conteúdo</p>
      </PublicShell>
    )

    expect(metaContent('meta[property="og:site_name"]')).toBe('Experimente+')
    expect(metaContent('meta[property="og:locale"]')).toBe('pt_BR')
    expect(metaContent('meta[property="og:image"]')).toBe('https://cdn.example/bar.png')
    expect(metaContent('meta[name="twitter:card"]')).toBe('summary_large_image')
  })

  it('falls back to a summary card when the page has no image', () => {
    render(
      <PublicShell title="Cidades" description="Escolha uma cidade.">
        <p>Conteúdo</p>
      </PublicShell>
    )

    expect(document.head.querySelector('meta[property="og:image"]')).toBeNull()
    expect(metaContent('meta[name="twitter:card"]')).toBe('summary')
  })
})
