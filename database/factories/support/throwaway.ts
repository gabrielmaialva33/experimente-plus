import { createHash, randomUUID } from 'node:crypto'

import type { FactoryContextContract } from '@adonisjs/lucid/types/factory'

type Faker = FactoryContextContract['faker']

/**
 * The stored shape of a hashed credential or origin — 64 lowercase hex
 * characters — computed over a throwaway value nobody holds. Rows written
 * with it can be listed, expired and revoked, never presented; a test that
 * needs a usable token issues it through the owning service instead.
 */
export function throwawayDigest(): string {
  return createHash('sha256').update(`factory:${randomUUID()}`).digest('hex')
}

/** An address of the RFC 5737 documentation ranges, which never routes to anyone. */
export function documentationIp(faker: Faker): string {
  const network = faker.helpers.arrayElement(['192.0.2', '198.51.100', '203.0.113'])
  return `${network}.${faker.number.int({ min: 1, max: 254 })}`
}
