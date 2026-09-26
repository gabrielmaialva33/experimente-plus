import { describe, expect, it, vi } from 'vitest'

import { HoursSection } from '~/components/portal/establishment_editor/hours_section'
import type { HourInput, HoursForm } from '~/components/portal/establishment_editor/types'
import { render, screen, within } from '~/tests/test_utils'

function hoursForm(hours: HourInput[]) {
  const setData = vi.fn()
  const form = {
    data: { hours },
    errors: {},
    hasErrors: false,
    processing: false,
    recentlySuccessful: false,
    isDirty: false,
    setData,
  } as unknown as HoursForm
  return { form, setData }
}

const interval = (weekday: number, opens_at: string, closes_at: string, sort_order = 0) => ({
  weekday,
  opens_at,
  closes_at,
  spans_next_day: false,
  sort_order,
})

function renderHours(hours: HourInput[]) {
  const { form, setData } = hoursForm(hours)
  const view = render(
    <HoursSection
      form={form}
      editable
      busy={false}
      issues={[]}
      availabilityType="regular_hours"
      availabilityLabel="Horário regular"
      onSubmit={(event) => event.preventDefault()}
      onReviewIdentity={() => undefined}
    />
  )
  return { ...view, setData }
}

describe('HoursSection', () => {
  it('lists the week as one compact row per day, starting on Monday', () => {
    renderHours([interval(1, '11:00', '15:00'), interval(1, '18:00', '23:00', 1)])

    const rows = within(screen.getByRole('table')).getAllByRole('row').slice(1)
    expect(rows.map((row) => within(row).getByRole('rowheader').textContent)).toEqual([
      'Segunda',
      'Terça',
      'Quarta',
      'Quinta',
      'Sexta',
      'Sábado',
      'Domingo',
    ])
    expect(within(rows[0]).getAllByLabelText('Segunda, abre às')).toHaveLength(2)
    expect(within(rows[1]).getByText('Fechado')).toBeVisible()
  })

  it('copies Monday to Tuesday through Friday, replacing their intervals', async () => {
    const { user, setData } = renderHours([
      interval(1, '11:00', '15:00'),
      interval(3, '08:00', '09:00', 1),
      interval(6, '10:00', '14:00', 2),
    ])

    await user.click(screen.getByRole('button', { name: 'Copiar segunda para terça a sexta' }))

    const [key, hours] = setData.mock.calls[0]
    expect(key).toBe('hours')
    expect(hours.map((hour: HourInput) => [hour.weekday, hour.opens_at, hour.closes_at])).toEqual([
      [1, '11:00', '15:00'],
      [6, '10:00', '14:00'],
      [2, '11:00', '15:00'],
      [3, '11:00', '15:00'],
      [4, '11:00', '15:00'],
      [5, '11:00', '15:00'],
    ])
    expect(hours.map((hour: HourInput) => hour.sort_order)).toEqual([0, 1, 2, 3, 4, 5])
  })

  it('does not offer the copy while Monday has no hours', () => {
    renderHours([interval(2, '11:00', '15:00')])

    expect(screen.getByRole('button', { name: 'Copiar segunda para terça a sexta' })).toBeDisabled()
  })
})
