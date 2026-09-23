import { describe, expect, it } from 'vitest'

import { initialValues, toPayload, type FieldSpec } from '~/lib/resource_form'

const fields: FieldSpec[] = [
  { name: 'name', label: 'Nome', type: 'text' },
  { name: 'slug', label: 'Slug', type: 'text', omitWhenBlank: true },
  { name: 'description', label: 'Descrição', type: 'textarea', nullable: true },
  { name: 'sort_order', label: 'Ordem', type: 'number', defaultValue: '0' },
  { name: 'latitude', label: 'Latitude', type: 'number', nullable: true },
  { name: 'region_id', label: 'Região', type: 'select', numeric: true },
  { name: 'allows_always_open', label: '24h', type: 'checkbox' },
]

describe('resource form conversion', () => {
  it('omits a blank slug so the server derives it from the name', () => {
    const payload = toPayload(fields, initialValues(fields))
    expect(payload).not.toHaveProperty('slug')
  })

  it('sends null for a cleared optional field instead of an empty string', () => {
    const payload = toPayload(fields, { ...initialValues(fields), description: '   ' })
    expect(payload.description).toBeNull()
    expect(payload.latitude).toBeNull()
  })

  it('turns numeric inputs and numeric selects into numbers, accepting a comma', () => {
    const payload = toPayload(fields, {
      ...initialValues(fields),
      latitude: '-23,31',
      region_id: '7',
      sort_order: '3',
    })
    expect(payload.latitude).toBe(-23.31)
    expect(payload.region_id).toBe(7)
    expect(payload.sort_order).toBe(3)
  })

  it('starts a new record from each field default, and an existing one from the record', () => {
    expect(initialValues(fields)).toMatchObject({ sort_order: '0', allows_always_open: false })
    expect(
      initialValues(fields, { name: 'Cafés', allows_always_open: true, latitude: null })
    ).toMatchObject({ name: 'Cafés', allows_always_open: true, latitude: '' })
  })

  it('always sends a checkbox, so unchecking is a change and not an omission', () => {
    expect(toPayload(fields, initialValues(fields)).allows_always_open).toBe(false)
  })
})
