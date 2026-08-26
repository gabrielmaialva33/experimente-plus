import { describe, expect, it } from 'vitest'

import { collection, numeric, record, text } from '~/lib/json'

describe('json helpers', () => {
  it('accepts only plain objects as records', () => {
    expect(record({ id: 1 })).toEqual({ id: 1 })
    expect(record([1, 2])).toBeNull()
    expect(record('texto')).toBeNull()
    expect(record(10)).toBeNull()
    expect(record(null)).toBeNull()
    expect(record(undefined)).toBeNull()
  })

  it('collects object entries from plain arrays', () => {
    expect(collection([{ id: 1 }, 'ruído', 2, null, { id: 2 }])).toEqual([{ id: 1 }, { id: 2 }])
  })

  it('collects object entries from Lucid paginator payloads', () => {
    const paginator = {
      meta: { total: 2, current_page: 1 },
      data: [{ id: 1 }, 'ruído', { id: 2 }],
    }

    expect(collection(paginator)).toEqual([{ id: 1 }, { id: 2 }])
  })

  it('degrades unknown collection shapes to an empty array', () => {
    expect(collection(null)).toEqual([])
    expect(collection('texto')).toEqual([])
    expect(collection({ data: 'não é lista' })).toEqual([])
    expect(collection({ meta: {} })).toEqual([])
  })

  it('reads strings with an explicit fallback', () => {
    expect(text({ name: 'Unidade' }, 'name')).toBe('Unidade')
    expect(text({ name: 10 }, 'name')).toBe('')
    expect(text({ name: 10 }, 'name', '—')).toBe('—')
    expect(text(null, 'name', '—')).toBe('—')
  })

  it('keeps the permissive numeric coercion the pages rely on', () => {
    expect(numeric({ id: 7 }, 'id')).toBe(7)
    expect(numeric({ id: '7' }, 'id')).toBe(7)
    expect(numeric({ id: undefined }, 'id')).toBe(0)
    expect(numeric(null, 'id')).toBe(0)
    expect(numeric({ id: 'abc' }, 'id')).toBeNaN()
  })
})
