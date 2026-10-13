import { screen, within } from '@testing-library/react'
import { beforeEach, describe, expect, it, vi } from 'vitest'

import { CatalogConcierge } from '~/components/catalog/catalog_concierge'
import { render } from '~/tests/test_utils'

const fetchMock = vi.fn()

const jsonReply = (body: unknown) =>
  new Response(JSON.stringify(body), {
    status: 200,
    headers: { 'Content-Type': 'application/json' },
  })

async function ask(question = 'quero um café para a tarde') {
  const { user } = render(<CatalogConcierge citySlug="londrina" cityName="Londrina" />)

  await user.type(screen.getByLabelText('Pergunta para o Concierge'), question)
  await user.click(screen.getByRole('button', { name: 'Perguntar' }))
}

describe('CatalogConcierge', () => {
  beforeEach(() => {
    fetchMock.mockReset()
    vi.stubGlobal('fetch', fetchMock)
  })

  it('keeps short questions disabled', async () => {
    const { user } = render(<CatalogConcierge citySlug="londrina" cityName="Londrina" />)

    const button = screen.getByRole('button', { name: 'Perguntar' })
    expect(button).toBeDisabled()

    await user.type(screen.getByLabelText('Pergunta para o Concierge'), 'oi')
    expect(button).toBeDisabled()
    expect(fetchMock).not.toHaveBeenCalled()
  })

  it('asks the public route without an authorization header and renders grounded places', async () => {
    fetchMock.mockResolvedValue(
      jsonReply({
        outcome: 'grounded',
        text: 'Comece pelo café e siga para o parque.',
        items: [
          {
            ref: 'establishment:10',
            kind: 'establishment',
            name: 'Café Central',
            city_slug: 'londrina',
            establishment_slug: 'cafe-central',
            establishment_name: 'Café Central',
            district: 'Centro',
            category: 'Cafés',
            starts_at: null,
            ends_at: null,
          },
        ],
        model: 'modelo-teste',
      })
    )

    await ask()

    expect(await screen.findByText('Comece pelo café e siga para o parque.')).toBeInTheDocument()
    expect(screen.getByText('Café Central')).toBeInTheDocument()

    expect(fetchMock).toHaveBeenCalledOnce()
    const [url, options] = fetchMock.mock.calls[0] as [string, RequestInit]
    expect(url).toBe('/api/v1/catalog/concierge')
    expect(options.method).toBe('POST')
    expect(options.cache).toBe('no-store')
    expect(JSON.parse(String(options.body))).toEqual({
      question: 'quero um café para a tarde',
      city: 'londrina',
    })

    const headers = new Headers(options.headers)
    expect(headers.get('authorization')).toBeNull()
    expect(headers.get('cache-control')).toBe('no-store')
  })

  it('links every reference to its establishment through the city and establishment slugs', async () => {
    fetchMock.mockResolvedValue(
      jsonReply({
        outcome: 'grounded',
        text: 'Comece no café e termine no show.',
        items: [
          {
            ref: 'establishment:10',
            kind: 'establishment',
            name: 'Café Central',
            city_slug: 'londrina',
            establishment_slug: 'cafe-central',
            establishment_name: 'Café Central',
            district: 'Centro',
            category: 'Cafés',
            starts_at: null,
            ends_at: null,
          },
          {
            ref: 'event:7',
            kind: 'event',
            name: 'Noite de jazz',
            city_slug: 'londrina',
            establishment_slug: 'bar-do-porto',
            establishment_name: 'Bar do Porto',
            district: 'Vila Nova',
            category: 'Bares',
            starts_at: '2026-09-20T23:00:00.000Z',
            ends_at: '2026-09-21T02:00:00.000Z',
          },
        ],
        model: 'modelo-teste',
      })
    )

    await ask('o que fazer hoje à noite')

    const references = await screen.findByRole('list', { name: 'Referências no catálogo' })
    const links = await screen.findAllByRole('link')

    expect(links.map((link) => link.getAttribute('href'))).toEqual([
      '/cidades/londrina/estabelecimentos/cafe-central',
      '/cidades/londrina/estabelecimentos/bar-do-porto',
    ])

    // An event points at the place that hosts it, and says so.
    expect(references).toHaveTextContent('Noite de jazz')
    expect(references).toHaveTextContent('Evento em Bar do Porto')
    expect(links[1]).toHaveAccessibleName('Noite de jazz Evento em Bar do Porto')
  })

  it('never invents a link for a place the reply only mentions in prose', async () => {
    fetchMock.mockResolvedValue(
      jsonReply({
        outcome: 'grounded',
        text: 'Comece no Café Central e depois passe na Padaria Primavera.',
        items: [
          {
            ref: 'establishment:10',
            kind: 'establishment',
            name: 'Café Central',
            city_slug: 'londrina',
            establishment_slug: 'cafe-central',
            establishment_name: 'Café Central',
            district: 'Centro',
            category: 'Cafés',
            starts_at: null,
            ends_at: null,
          },
        ],
        model: 'modelo-teste',
      })
    )

    await ask('onde tomar café')

    expect(
      await screen.findByText('Comece no Café Central e depois passe na Padaria Primavera.')
    ).toBeInTheDocument()

    // The prose is the model's and is shown as it came, but only what arrived in
    // `items` may be linked: the client does not resolve names into addresses.
    const links = screen.getAllByRole('link')
    expect(links).toHaveLength(1)
    expect(links[0]).toHaveAttribute('href', '/cidades/londrina/estabelecimentos/cafe-central')
    expect(links.map((link) => link.textContent).join(' ')).not.toContain('Padaria Primavera')
  })

  it('renders an item without slugs as text instead of guessing an address', async () => {
    fetchMock.mockResolvedValue(
      jsonReply({
        outcome: 'grounded',
        text: 'Uma opção publicada.',
        items: [{ ref: 'establishment:10', kind: 'establishment', name: 'Lugar sem slug' }],
        model: 'modelo-teste',
      })
    )

    await ask('me dá uma ideia')

    expect(await screen.findByText('Lugar sem slug')).toBeInTheDocument()
    expect(screen.queryByRole('link')).toBeNull()
  })

  it('explains the degraded fallback instead of exposing a raw provider failure', async () => {
    fetchMock.mockResolvedValue(
      jsonReply({
        outcome: 'degraded',
        text: null,
        items: [
          {
            ref: 'establishment:11',
            kind: 'establishment',
            name: 'Lugar publicado',
            city_slug: 'londrina',
            establishment_slug: 'lugar-publicado',
            establishment_name: 'Lugar publicado',
            district: null,
            category: 'Restaurante',
            starts_at: null,
            ends_at: null,
          },
        ],
        model: null,
      })
    )

    await ask('onde posso jantar?')

    expect(
      await screen.findByText(
        'O assistente está indisponível agora, então trouxe opções publicadas no catálogo.'
      )
    ).toBeInTheDocument()

    // Degrading keeps the catalogue usable: the list is real, so it still links.
    expect(screen.getByRole('link')).toHaveAttribute(
      'href',
      '/cidades/londrina/estabelecimentos/lugar-publicado'
    )
    expect(screen.getByText('Lugar publicado')).toBeInTheDocument()
  })

  it('shows the fixed refusal alone, with nothing to link', async () => {
    fetchMock.mockResolvedValue(
      jsonReply({
        outcome: 'refused',
        text: 'Só consigo ajudar a descobrir lugares, experiências e eventos cadastrados no Experimente+.',
        items: [],
        model: null,
      })
    )

    await ask('preciso de um advogado agora')

    expect(await screen.findByText(/Só consigo ajudar a descobrir lugares/)).toBeInTheDocument()
    expect(screen.queryByRole('list', { name: 'Referências no catálogo' })).toBeNull()
    expect(screen.queryByRole('link')).toBeNull()
  })

  it('offers the shortcuts as optional checkboxes above the question', async () => {
    const { user } = render(<CatalogConcierge citySlug="londrina" cityName="Londrina" />)

    const group = screen.getByRole('group', { name: 'Atalhos (opcional)' })
    expect(group).toHaveAccessibleDescription(
      'Os valores seguem o ticket médio por pessoa informado pelo lugar.'
    )
    const boxes = within(group).getAllByRole('checkbox')
    expect(boxes.map((box) => box.getAttribute('value'))).toEqual([
      'open_now',
      'food',
      'leisure',
      'services',
      'well_rated',
      'up_to_50',
      '50_100',
      'over_100',
    ])
    for (const name of [
      'Aberto agora',
      'Comida',
      'Lazer',
      'Serviços',
      'Bem avaliados (4+)',
      'Até R$ 50',
      'R$ 50 a 100',
      'Acima de R$ 100',
    ]) {
      expect(within(group).getByRole('checkbox', { name })).not.toBeChecked()
    }

    // The chips sit before the question in the reading order.
    const question = screen.getByLabelText('Pergunta para o Concierge')
    expect(group.compareDocumentPosition(question) & Node.DOCUMENT_POSITION_FOLLOWING).toBeTruthy()

    const openNow = screen.getByRole('checkbox', { name: 'Aberto agora' })
    await user.click(openNow)
    expect(openNow).toBeChecked()
    await user.click(openNow)
    expect(openNow).not.toBeChecked()

    // A shortcut is not a question: the free text stays required.
    await user.click(screen.getByRole('checkbox', { name: 'Comida' }))
    expect(screen.getByRole('button', { name: 'Perguntar' })).toBeDisabled()
    expect(fetchMock).not.toHaveBeenCalled()
  })

  it('sends the ticked shortcuts with the question', async () => {
    fetchMock.mockResolvedValue(
      jsonReply({ outcome: 'grounded', text: 'Uma sugestão.', items: [], model: 'modelo-teste' })
    )
    const { user } = render(<CatalogConcierge citySlug="londrina" cityName="Londrina" />)

    for (const name of ['Serviços', 'Aberto agora', 'Lazer', 'Bem avaliados (4+)', 'Até R$ 50']) {
      await user.click(screen.getByRole('checkbox', { name }))
    }
    await user.type(screen.getByLabelText('Pergunta para o Concierge'), 'algo para hoje')
    await user.click(screen.getByRole('button', { name: 'Perguntar' }))

    expect(await screen.findByText('Uma sugestão.')).toBeInTheDocument()
    const [, options] = fetchMock.mock.calls[0] as [string, RequestInit]
    expect(JSON.parse(String(options.body))).toEqual({
      question: 'algo para hoje',
      city: 'londrina',
      filters: {
        open_now: true,
        kind: ['leisure', 'services'],
        min_rating: 4,
        price: ['up_to_50'],
      },
    })
  })

  it('says when nothing matches the shortcuts instead of blaming the assistant', async () => {
    fetchMock.mockResolvedValue(
      jsonReply({ outcome: 'degraded', text: null, items: [], model: null })
    )
    const { user } = render(<CatalogConcierge citySlug="londrina" cityName="Londrina" />)

    await user.click(screen.getByRole('checkbox', { name: 'Acima de R$ 100' }))
    await user.type(screen.getByLabelText('Pergunta para o Concierge'), 'um jantar especial')
    await user.click(screen.getByRole('button', { name: 'Perguntar' }))

    expect(
      await screen.findByText(
        'Nenhum lugar publicado combina com esses atalhos agora. Desmarque algum e pergunte de novo.'
      )
    ).toBeInTheDocument()
    expect(screen.queryByText(/O assistente está indisponível agora/)).toBeNull()
    expect(screen.queryByRole('list', { name: 'Referências no catálogo' })).toBeNull()

    // Unticking afterwards does not rewrite the answer already on screen.
    await user.click(screen.getByRole('checkbox', { name: 'Acima de R$ 100' }))
    expect(screen.getByText(/Nenhum lugar publicado combina/)).toBeInTheDocument()
  })

  it('renders references without any image, because no media travels in a reply', async () => {
    fetchMock.mockResolvedValue(
      jsonReply({
        outcome: 'grounded',
        text: 'Uma sugestão.',
        items: [
          {
            ref: 'experience:3',
            kind: 'experience',
            name: 'Degustação de cafés',
            city_slug: 'londrina',
            establishment_slug: 'cafe-central',
            establishment_name: 'Café Central',
            district: null,
            category: null,
            starts_at: null,
            ends_at: null,
          },
        ],
        model: 'modelo-teste',
      })
    )

    await ask('tem alguma experiência?')

    const references = await screen.findByRole('list', { name: 'Referências no catálogo' })
    expect(references).toHaveTextContent('Degustação de cafés')
    expect(references).toHaveTextContent('Experiência em Café Central')
    expect(references.querySelectorAll('img')).toHaveLength(0)
    expect(screen.queryAllByRole('img')).toHaveLength(0)
  })
})
