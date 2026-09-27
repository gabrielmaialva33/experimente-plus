import type { FactoryContextContract } from '@adonisjs/lucid/types/factory'

import { demoCity, type DemoCity } from '#database/support/demo/catalog/geography'

/**
 * Brazilian Portuguese building blocks for the factories.
 *
 * The factory context ships an English faker; these lists give the test data
 * the shape of the product (pt-BR names, Paraná cities, valid CNPJ check
 * digits, Brazilian phone formats) without adding a dependency. Everything
 * generated is fictitious and uses reserved `example.test` domains.
 */

type Faker = FactoryContextContract['faker']

export const FIRST_NAMES = [
  'Ana',
  'Beatriz',
  'Bruno',
  'Camila',
  'Carlos',
  'Daniela',
  'Diego',
  'Eduarda',
  'Fernanda',
  'Gabriel',
  'Gustavo',
  'Helena',
  'Isabela',
  'João',
  'Juliana',
  'Larissa',
  'Leonardo',
  'Luana',
  'Lucas',
  'Marcos',
  'Mariana',
  'Mateus',
  'Natália',
  'Otávio',
  'Patrícia',
  'Pedro',
  'Rafael',
  'Renata',
  'Rodrigo',
  'Sofia',
  'Thiago',
  'Vinícius',
] as const

export const SURNAMES = [
  'Almeida',
  'Barbosa',
  'Cardoso',
  'Carvalho',
  'Costa',
  'Dias',
  'Fernandes',
  'Ferreira',
  'Gomes',
  'Kobayashi',
  'Lima',
  'Martins',
  'Mendes',
  'Nakamura',
  'Oliveira',
  'Pereira',
  'Ribeiro',
  'Rocha',
  'Santos',
  'Silva',
  'Souza',
  'Tavares',
  'Teixeira',
  'Yamamoto',
] as const

const BUSINESS_KINDS = [
  'Café',
  'Cantina',
  'Bar',
  'Padaria',
  'Empório',
  'Ateliê',
  'Bistrô',
  'Pizzaria',
  'Casa',
  'Estúdio',
  'Confeitaria',
  'Espaço',
] as const

const BUSINESS_NAMES = [
  'Ipê',
  'Paineira',
  'Aroeira',
  'Jatobá',
  'Figueira',
  'Seriema',
  'Araucária',
  'Canção',
  'Terra Roxa',
  'Primavera',
  'Aurora',
  'Horizonte',
  'Recanto',
  'Estação',
  'Colina',
  'Vale Verde',
] as const

const SHORT_DESCRIPTIONS = [
  'Cozinha de bairro com receitas da casa e atendimento atencioso.',
  'Cafés especiais, confeitaria artesanal e mesas para trabalhar.',
  'Petiscos regionais, música ao vivo e mesas na calçada.',
  'Oficinas criativas e peças feitas à mão por artistas locais.',
  'Programação cultural semanal com entrada acessível.',
  'Serviço de bairro com hora marcada e equipe dedicada.',
] as const

const STREETS = [
  'Rua das Flores',
  'Avenida Brasil',
  'Rua XV de Novembro',
  'Rua Sete de Setembro',
  'Avenida Paraná',
  'Rua dos Pioneiros',
  'Rua das Palmeiras',
  'Avenida Getúlio Vargas',
] as const

export function personName(faker: Faker): string {
  return `${faker.helpers.arrayElement(FIRST_NAMES)} ${faker.helpers.arrayElement(SURNAMES)}`
}

export function asciiSlug(value: string): string {
  return value
    .normalize('NFD')
    .replace(/[̀-ͯ]/g, '')
    .toLowerCase()
    .replace(/&/g, ' e ')
    .replace(/[^a-z0-9]+/g, '-')
    .replace(/^-+|-+$/g, '')
}

/** A unique, reserved-domain e-mail derived from a name. */
export function emailFor(faker: Faker, name: string): string {
  return `${asciiSlug(name).replace(/-/g, '.')}.${faker.string.alphanumeric(6).toLowerCase()}@example.test`
}

export function businessName(faker: Faker): string {
  return `${faker.helpers.arrayElement(BUSINESS_KINDS)} ${faker.helpers.arrayElement(BUSINESS_NAMES)}`
}

export function shortDescription(faker: Faker): string {
  return faker.helpers.arrayElement(SHORT_DESCRIPTIONS)
}

export function street(faker: Faker): string {
  return faker.helpers.arrayElement(STREETS)
}

/**
 * A Brazilian phone number as stored by the domain (digits only): a landline
 * starts with 2–5 and has eight digits, a mobile starts with 9 and has nine.
 */
export function brazilianPhone(
  faker: Faker,
  kind: 'landline' | 'mobile' = 'landline',
  area = '43'
) {
  return kind === 'mobile'
    ? `${area}9${faker.string.numeric(8)}`
    : `${area}${faker.helpers.arrayElement(['2', '3', '4', '5'])}${faker.string.numeric(7)}`
}

/** A CNPJ with valid check digits over a random root; use only in test data. */
export function cnpj(faker: Faker): string {
  let base = faker.string.numeric(8) + '0001'
  if (/^(\d)\1+$/.test(base)) base = '1' + base.slice(1)
  const digit = (value: string, weights: number[]) => {
    const sum = [...value].reduce((total, char, index) => total + Number(char) * weights[index], 0)
    const remainder = sum % 11
    return remainder < 2 ? 0 : 11 - remainder
  }
  const first = digit(base, [5, 4, 3, 2, 9, 8, 7, 6, 5, 4, 3, 2])
  const second = digit(`${base}${first}`, [6, 5, 4, 3, 2, 9, 8, 7, 6, 5, 4, 3, 2])
  return `${base}${first}${second}`
}

/** A point inside the central area of a city, `km` at most from its centre. */
export function pointNear(faker: Faker, city: Pick<DemoCity, 'latitude' | 'longitude'>, km = 2.5) {
  const distance = km * Math.sqrt(faker.number.float({ min: 0, max: 1 }))
  const angle = faker.number.float({ min: 0, max: Math.PI * 2 })
  const latitude = city.latitude + (distance * Math.cos(angle)) / 111.32
  const longitude =
    city.longitude +
    (distance * Math.sin(angle)) / (111.32 * Math.cos((city.latitude * Math.PI) / 180))
  return { latitude: Number(latitude.toFixed(7)), longitude: Number(longitude.toFixed(7)) }
}

/** The attributes of a real city of the demo geography, for `CityFactory.merge`. */
export function realCity(slug: string) {
  const city = demoCity(slug)
  return {
    name: city.name,
    slug: city.slug,
    ibge_code: city.ibge_code,
    latitude: city.latitude,
    longitude: city.longitude,
    timezone: 'America/Sao_Paulo',
    state_code: 'PR',
    country_code: 'BR',
  }
}

export const LONDRINA = demoCity('londrina')
