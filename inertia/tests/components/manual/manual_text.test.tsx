import { describe, expect, it } from 'vitest'

import { ManualText, parseManualText } from '~/components/manual/manual_text'
import { render, screen } from '~/tests/test_utils'

describe('manual inline text', () => {
  it('splits bold words and links from plain text', () => {
    expect(parseManualText('Toque em **Buscar** e veja [Dúvidas](#duvidas).')).toEqual([
      { kind: 'text', value: 'Toque em ' },
      { kind: 'bold', value: 'Buscar' },
      { kind: 'text', value: ' e veja ' },
      { kind: 'link', value: 'Dúvidas', href: '#duvidas' },
      { kind: 'text', value: '.' },
    ])
  })

  it('leaves unmatched marks as they are', () => {
    expect(parseManualText('2 * 3 e [sem link]')).toEqual([
      { kind: 'text', value: '2 * 3 e [sem link]' },
    ])
  })

  it('renders anchors on the page and site paths as links', () => {
    render(
      <p>
        <ManualText text="Leia **com calma**: [a carteira](#consumidor-carteira) e [o app](/app)." />
      </p>
    )

    expect(screen.getByText('com calma').tagName).toBe('STRONG')
    expect(screen.getByRole('link', { name: 'a carteira' })).toHaveAttribute(
      'href',
      '#consumidor-carteira'
    )
    expect(screen.getByRole('link', { name: 'o app' })).toHaveAttribute('href', '/app')
  })
})
