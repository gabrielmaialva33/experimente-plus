import { describe, expect, it } from 'vitest'

import { changedCount, compareRevision, formatPhone } from '~/lib/moderation_comparison'

const base = {
  'identity.public_name': 'Casa de Petiscos',
  'contacts.public_phone': '43999990000',
  'address.postal_code': '86020030',
  'hours.1': '08:00–23:00',
  'attributes.wifi': 'Sim',
}

describe('moderation comparison', () => {
  it('marks only the fields whose value differs from the published page, with the old value', () => {
    const sections = compareRevision({
      published_version: 2,
      submitted: { ...base, 'contacts.public_phone': '43988881111' },
      published: base,
      labels: { 'attributes.wifi': 'Wi-Fi' },
    })

    expect(changedCount(sections)).toBe(1)
    const contacts = sections.find((section) => section.id === 'contacts')!
    const phone = contacts.fields.find((field) => field.key === 'contacts.public_phone')!
    expect(phone).toMatchObject({
      changed: true,
      value: '(43) 98888-1111',
      before: '(43) 99999-0000',
    })
    expect(contacts.changed).toBe(1)
    expect(sections.find((section) => section.id === 'identity')!.changed).toBe(0)
  })

  it('never marks changes on a first publication and names attribute fields by label', () => {
    const sections = compareRevision({
      published_version: null,
      submitted: base,
      published: null,
      labels: { 'attributes.wifi': 'Wi-Fi' },
    })

    expect(changedCount(sections)).toBe(0)
    const attributes = sections.find((section) => section.id === 'attributes')!
    expect(attributes.fields[0]).toMatchObject({ label: 'Wi-Fi', value: 'Sim', changed: false })
    const address = sections.find((section) => section.id === 'address')!
    expect(address.fields.find((field) => field.key === 'address.postal_code')!.value).toBe(
      '86020-030'
    )
  })

  it('writes Brazilian phone numbers the way people read them', () => {
    expect(formatPhone('4335421201')).toBe('(43) 3542-1201')
    expect(formatPhone('5543999990000')).toBe('(43) 99999-0000')
    expect(formatPhone('0800 123')).toBe('0800 123')
  })
})
