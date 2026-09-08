import { act, screen } from '@testing-library/react'
import { useState } from 'react'
import { afterEach, describe, expect, it, vi } from 'vitest'

import { CatalogImageFallback } from '~/components/catalog/catalog_image_fallback'
import { CatalogWeeklyHours, currentWeekday } from '~/components/catalog/catalog_weekly_hours'
import { EstablishmentStatus } from '~/components/catalog/establishment_status'
import { Button } from '~/components/ui/button'
import { FilterChip } from '~/components/ui/choice'
import { Tabs, TabsContent, TabsList, TabsTrigger } from '~/components/ui/tabs'
import { render } from '~/tests/test_utils'

afterEach(() => vi.useRealTimers())

describe('distinct catalog color roles', () => {
  it('separates absent content, neutral status and today without deriving availability', () => {
    vi.useFakeTimers()
    vi.setSystemTime(new Date('2026-09-08T02:59:00Z')) // Monday in Londrina, Tuesday UTC
    const { container } = render(
      <>
        <CatalogImageFallback name="Café" />
        <EstablishmentStatus
          businessStatus="open"
          isOpenNow={false}
          availabilityType="regular_hours"
        />
        <CatalogWeeklyHours hours={[]} timeZone="America/Sao_Paulo" />
      </>
    )
    expect(screen.getByRole('img')).toHaveClass('bg-content-absent')
    expect(screen.getByText('Fechado agora')).toHaveClass('bg-status-neutral')
    const current = container.querySelector('[aria-current="date"]')
    expect(current).toHaveClass('bg-temporal-emphasis')
    expect(current).toHaveTextContent('Segunda-feira')
    expect(current).toHaveTextContent('Hoje')
    expect(current).toHaveTextContent('Fechado')
    act(() => vi.advanceTimersByTime(60_000))
    expect(container.querySelector('[aria-current="date"]')).toHaveTextContent('Terça-feira')
    expect(container.querySelectorAll('[aria-current="date"]')).toHaveLength(1)
    expect(screen.getByText('Fechado agora')).toBeInTheDocument()
  })

  it('does not invent a local day if the establishment timezone is missing or invalid', () => {
    expect(currentWeekday(null)).toBeNull()
    expect(currentWeekday('invalid/timezone')).toBeNull()
    const { container } = render(<CatalogWeeklyHours hours={[]} timeZone={null} />)
    expect(container.querySelector('[aria-current="date"]')).toBeNull()
    expect(screen.queryByText('Hoje')).not.toBeInTheDocument()
  })

  it('shows a persistent filter selection and separates its pill from a contact command', async () => {
    function Example() {
      const [checked, setChecked] = useState(false)
      return (
        <>
          <FilterChip checked={checked} onChange={(e) => setChecked(e.target.checked)}>
            Aberto agora
          </FilterChip>
          <Button variant="contact" className="h-12">
            Ligar
          </Button>
        </>
      )
    }
    const { user } = render(<Example />)
    const checkbox = screen.getByRole('checkbox', { name: 'Aberto agora' })
    const chip = checkbox.closest('label')
    expect(chip).toHaveClass('choice-control', 'rounded-full', 'min-h-11')
    expect(chip).toHaveAttribute('data-selected', 'false')
    await user.click(checkbox)
    expect(checkbox).toBeChecked()
    expect(chip).toHaveAttribute('data-selected', 'true')
    await user.keyboard(' ')
    expect(checkbox).not.toBeChecked()
    const command = screen.getByRole('button', { name: 'Ligar' })
    expect(command).toHaveClass('rounded-md', 'h-12', 'bg-action-secondary')
    expect(command).not.toHaveAttribute('aria-pressed')
    expect(command).not.toHaveClass('choice-control', 'rounded-full')
  })

  it.each(['default', 'button', 'line'] as const)(
    'uses the same selection language for the %s tab layout',
    async (variant) => {
      const { user } = render(
        <Tabs defaultValue="list">
          <TabsList variant={variant} aria-label="Apresentação">
            <TabsTrigger value="list">Lista</TabsTrigger>
            <TabsTrigger value="map">Mapa</TabsTrigger>
          </TabsList>
          <TabsContent value="list">Lista local</TabsContent>
          <TabsContent value="map">Mapa local</TabsContent>
        </Tabs>
      )
      const list = screen.getByRole('tab', { name: 'Lista' })
      const map = screen.getByRole('tab', { name: 'Mapa' })
      expect(list).toHaveClass('choice-control')
      expect(map).toHaveClass('choice-control')
      expect(list).toHaveAttribute('aria-selected', 'true')
      await user.click(map)
      expect(map).toHaveAttribute('aria-selected', 'true')
      expect(list).toHaveAttribute('aria-selected', 'false')
      expect(screen.getByRole('tabpanel')).toHaveTextContent('Mapa local')
    }
  )
})
