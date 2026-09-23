import { randomBytes } from 'node:crypto'
import { DateTime } from 'luxon'

/**
 * Human-facing identifier of a report, shared by people and rules. Random
 * suffix rather than a sequence so the protocol does not disclose how many
 * reports exist.
 */
export function buildProtocolNumber(): string {
  const day = DateTime.now().toFormat('yyyyLLdd')
  const suffix = randomBytes(4).toString('hex').toUpperCase()
  return `DEN-${day}-${suffix}`
}
