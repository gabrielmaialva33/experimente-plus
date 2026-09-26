/**
 * Reading a revision against the public page — audit finding W2.
 *
 * The server sends the same flat map of display values for the submitted
 * revision and for the published one. This file only names the fields, groups
 * them the way a moderator reads a place and says which ones differ; it holds no
 * rule of its own.
 */

import { availabilityTypeLabel } from '~/lib/labels'

export type Snapshot = Record<string, string | null>

export type ComparisonProps = {
  published_version: number | null
  submitted: Snapshot
  published: Snapshot | null
  labels: Record<string, string>
}

export type ComparedField = {
  key: string
  label: string
  value: string | null
  before: string | null
  changed: boolean
}

export type ComparedSection = {
  id: string
  title: string
  fields: ComparedField[]
  changed: number
}

const WEEKDAY_LABELS = [
  'Domingo',
  'Segunda-feira',
  'Terça-feira',
  'Quarta-feira',
  'Quinta-feira',
  'Sexta-feira',
  'Sábado',
]

const SECTIONS: Array<{ id: string; title: string; fields: Array<[string, string]> }> = [
  {
    id: 'identity',
    title: 'Identificação',
    fields: [
      ['identity.public_name', 'Nome público'],
      ['identity.city', 'Cidade'],
      ['identity.short_description', 'Descrição curta'],
      ['identity.description', 'Descrição'],
      ['identity.availability_type', 'Disponibilidade'],
    ],
  },
  {
    id: 'contacts',
    title: 'Contatos',
    fields: [
      ['contacts.public_phone', 'Telefone'],
      ['contacts.whatsapp', 'WhatsApp'],
      ['contacts.public_email', 'E-mail'],
      ['contacts.website', 'Site'],
      ['contacts.instagram', 'Instagram'],
      ['contacts.booking_url', 'Link de reserva'],
    ],
  },
  {
    id: 'address',
    title: 'Endereço',
    fields: [
      ['address.street', 'Rua'],
      ['address.number', 'Número'],
      ['address.complement', 'Complemento'],
      ['address.district', 'Bairro'],
      ['address.postal_code', 'CEP'],
      ['address.reference', 'Referência'],
      ['address.coordinates', 'Coordenadas'],
    ],
  },
  {
    id: 'hours',
    title: 'Horários',
    fields: WEEKDAY_LABELS.map((label, weekday) => [`hours.${weekday}`, label] as [string, string]),
  },
  {
    id: 'categories',
    title: 'Categorias',
    fields: [
      ['categories.primary', 'Categoria principal'],
      ['categories.all', 'Todas as categorias'],
    ],
  },
  {
    id: 'media',
    title: 'Fotos',
    fields: [
      ['media.cover', 'Capa'],
      ['media.count', 'Quantidade de imagens'],
    ],
  },
]

/** Brazilian landline or mobile digits as people write them; anything else as stored. */
export function formatPhone(value: string): string {
  const digits = value.replace(/\D/g, '')
  const national = digits.startsWith('55') && digits.length > 11 ? digits.slice(2) : digits
  if (national.length === 11)
    return `(${national.slice(0, 2)}) ${national.slice(2, 7)}-${national.slice(7)}`
  if (national.length === 10)
    return `(${national.slice(0, 2)}) ${national.slice(2, 6)}-${national.slice(6)}`
  return value
}

function display(key: string, value: string | null): string | null {
  if (value === null) return null
  if (key === 'identity.availability_type') return availabilityTypeLabel(value)
  if (key === 'contacts.public_phone' || key === 'contacts.whatsapp') return formatPhone(value)
  if (key === 'address.postal_code' && /^\d{8}$/.test(value)) {
    return `${value.slice(0, 5)}-${value.slice(5)}`
  }
  return value
}

export function compareRevision(comparison: ComparisonProps): ComparedSection[] {
  const { submitted, published, labels } = comparison
  const attributeKeys = [...new Set([...Object.keys(submitted), ...Object.keys(published ?? {})])]
    .filter((key) => key.startsWith('attributes.'))
    .sort((left, right) => (labels[left] ?? left).localeCompare(labels[right] ?? right, 'pt-BR'))

  const sections = [
    ...SECTIONS,
    ...(attributeKeys.length > 0
      ? [
          {
            id: 'attributes',
            title: 'Características',
            fields: attributeKeys.map((key) => [key, labels[key] ?? key] as [string, string]),
          },
        ]
      : []),
  ]

  return sections.map((section) => {
    const fields = section.fields.map(([key, label]) => {
      const value = display(key, submitted[key] ?? null)
      const before = published ? display(key, published[key] ?? null) : null
      return { key, label, value, before, changed: published !== null && value !== before }
    })
    return {
      id: section.id,
      title: section.title,
      fields,
      changed: fields.filter((field) => field.changed).length,
    }
  })
}

export function changedCount(sections: ComparedSection[]): number {
  return sections.reduce((total, section) => total + section.changed, 0)
}
