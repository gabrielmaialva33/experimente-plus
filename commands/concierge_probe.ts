import { BaseCommand, flags } from '@adonisjs/core/ace'

import type IConcierge from '#modules/concierge/interfaces/concierge_interface'
import ConciergeService from '#modules/concierge/services/concierge_service'

/**
 * Operational probe for the Concierge — ADR-0029.
 *
 * The provider is a third party that has been observed returning 529 under
 * load and 404 for models its own catalogue lists, so being able to ask "does
 * it answer right now, and does the answer survive validation" without
 * deploying anything is worth a command. It reads the published catalogue and
 * writes nothing.
 */
export default class ConciergeProbe extends BaseCommand {
  static commandName = 'concierge:probe'
  static description =
    'Ask the Concierge a question against the published catalogue; writes nothing'
  static options = { startApp: true }

  @flags.string({ description: 'Question to ask', required: true })
  declare question: string

  @flags.string({ description: 'City slug used to ground the answer' })
  declare city: string

  async run() {
    const { default: db } = await import('@adonisjs/lucid/services/db')
    const service = await this.app.container.make(ConciergeService)

    // Only what the public projection already publishes, and only what is
    // discoverable: the model must never see a withheld establishment.
    const rows = await db
      .from('catalog_establishments')
      .select('establishment_id', 'public_name', 'city_slug', 'address', 'categories')
      .where('is_discoverable', true)
      .if(this.city, (query) => query.where('city_slug', this.city))
      .limit(20)

    const offered: IConcierge.GroundingItem[] = rows.map((row) => {
      const address = (row.address ?? {}) as Record<string, unknown>
      const categories = Array.isArray(row.categories) ? row.categories : []
      const first = (categories[0] ?? {}) as Record<string, unknown>
      return {
        id: Number(row.establishment_id),
        kind: 'establishment' as const,
        name: String(row.public_name),
        city: String(row.city_slug ?? ''),
        district: address.district ? String(address.district) : null,
        category: first.name ? String(first.name) : null,
        opens_at: null,
        closes_at: null,
      }
    })

    this.logger.info(`Catalogue items offered: ${offered.length}`)

    const started = Date.now()
    const reply = await service.answer(this.question, offered)
    const elapsed = Date.now() - started

    this.logger.info(`outcome=${reply.outcome} model=${reply.model ?? 'none'} in ${elapsed}ms`)
    if (reply.text) this.logger.log(reply.text)
    if (!reply.text) this.logger.log(offered.map((item) => `- ${item.name}`).join('\n'))
  }
}
