import { renderToStaticMarkup } from 'react-dom/server'

import { screen } from '@testing-library/react'
import { DateTime } from 'luxon'
import { describe, expect, it } from 'vitest'

import { catalogDetail, type CatalogDetail } from '~/lib/catalog'
import { CatalogPublicationMetadata } from '~/pages/catalog/establishment'
import { render } from '~/tests/test_utils'

function publishedDetailFrom(value: unknown): CatalogDetail {
  const detail = catalogDetail(value)

  if (!detail || detail.historical) {
    throw new Error('Expected a published catalog detail')
  }

  return detail
}

describe('catalog establishment publication metadata', () => {
  it('keeps server and JSON-hydrated dates deterministic in the canonical city timezone', () => {
    const boundaryInstant = '2026-08-21T01:30:00.000Z'
    const serverProps = {
      slug: 'bar-estacao-43-londrina',
      name: 'Bar Estação 43',
      city: {
        slug: 'londrina',
        name: 'Londrina',
        state_code: 'PR',
        timezone: 'America/Sao_Paulo',
      },
      published_at: DateTime.fromISO(boundaryInstant, { zone: 'UTC' }),
      updated_at: DateTime.fromISO(boundaryInstant, { zone: 'UTC' }),
    }
    const hydratedProps = JSON.parse(JSON.stringify(serverProps)) as unknown
    const serverDetail = publishedDetailFrom(serverProps)
    const hydratedDetail = publishedDetailFrom(hydratedProps)

    expect(serverDetail.publishedAt).toBe(hydratedDetail.publishedAt)
    expect(serverDetail.updatedAt).toBe(hydratedDetail.updatedAt)
    expect(Boolean(serverDetail.publishedAt)).toBe(Boolean(hydratedDetail.publishedAt))
    expect(Boolean(serverDetail.updatedAt)).toBe(Boolean(hydratedDetail.updatedAt))

    const serverMarkup = renderToStaticMarkup(
      <CatalogPublicationMetadata
        publishedAt={serverDetail.publishedAt}
        updatedAt={serverDetail.updatedAt}
        timeZone={serverDetail.city.timezone}
      />
    )
    const hydratedMarkup = renderToStaticMarkup(
      <CatalogPublicationMetadata
        publishedAt={hydratedDetail.publishedAt}
        updatedAt={hydratedDetail.updatedAt}
        timeZone={hydratedDetail.city.timezone}
      />
    )

    const utcDate = new Intl.DateTimeFormat('pt-BR', {
      dateStyle: 'long',
      timeZone: 'UTC',
    }).format(new Date(boundaryInstant))

    expect(serverMarkup).toBe(hydratedMarkup)
    expect(utcDate).toBe('21 de agosto de 2026')
    expect(serverMarkup).toContain('Publicado em 20 de agosto de 2026')
    expect(serverMarkup).toContain('Atualizado em 20 de agosto de 2026')
  })

  it('renders the approved-content block and omits an empty date list', () => {
    const { rerender } = render(
      <CatalogPublicationMetadata
        publishedAt="2026-08-20T12:00:00.000Z"
        updatedAt="2026-08-21T12:00:00.000Z"
        timeZone="America/Sao_Paulo"
      />
    )

    const region = screen.getByRole('region', { name: 'Conteúdo publicado' })
    expect(region).toHaveTextContent(
      'Esta ficha mostra somente dados aprovados e publicados no catálogo.'
    )
    expect(region).toHaveTextContent('Publicado em 20 de agosto de 2026')
    expect(region).toHaveTextContent('Atualizado em 21 de agosto de 2026')

    rerender(
      <CatalogPublicationMetadata
        publishedAt={null}
        updatedAt={null}
        timeZone="America/Sao_Paulo"
      />
    )

    expect(screen.queryByText(/^Publicado em /)).not.toBeInTheDocument()
    expect(screen.queryByText(/^Atualizado em /)).not.toBeInTheDocument()
  })

  it('falls back deterministically when a stale payload carries an invalid timezone', () => {
    render(
      <CatalogPublicationMetadata
        publishedAt="2026-08-21T01:30:00.000Z"
        updatedAt={null}
        timeZone="Parana/Invalid"
      />
    )

    expect(screen.getByText('Publicado em 21 de agosto de 2026')).toBeInTheDocument()
  })
})
