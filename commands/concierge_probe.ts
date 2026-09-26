import { BaseCommand, flags } from '@adonisjs/core/ace'

import type IConcierge from '#modules/concierge/interfaces/concierge_interface'
import CatalogGroundingRepository from '#modules/concierge/repositories/catalog_grounding_repository'
import ConciergePolicyService from '#modules/concierge/services/concierge_policy_service'
import ConciergeService from '#modules/concierge/services/concierge_service'
import PublicOperationResolver from '#modules/tenants/services/public_operation_resolver'

/**
 * Operational probe for the Concierge — ADR-0029.
 *
 * The provider is a third party that has been observed returning 529 under
 * load and 404 for models its own catalogue lists, so being able to ask "does
 * it answer right now, and does the answer survive validation" without
 * deploying anything is worth a command. It reads the published catalogue and
 * writes nothing.
 *
 * It grounds through the same repository the route uses, rather than assembling
 * catalogue rows of its own. The hand-rolled copy it used to carry drifted the
 * moment the grounding set grew past establishments, and a probe that grounds
 * differently from production answers a question nobody asked.
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

  @flags.string({
    description: 'Hostname to resolve the operation from, as a visitor request would',
  })
  declare host: string

  async run() {
    const resolver = await this.app.container.make(PublicOperationResolver)
    const grounding = await this.app.container.make(CatalogGroundingRepository)
    const service = await this.app.container.make(ConciergeService)
    const policies = await this.app.container.make(ConciergePolicyService)

    // The operation comes from the trusted hostname, exactly as it does for a
    // visitor (ADR-0003), falling back to the configured public slug.
    const tenant = await resolver.resolve(this.host ?? null)

    // The operation's own policy, as the route reads it. No quota: the probe is
    // an operator's check, not a person's question.
    const policy = await policies.effective(tenant.id)
    const { offered, withheld } = await grounding.forQuestion(
      tenant.id,
      this.city ?? null,
      policy.max_catalog_items
    )

    const counted = (kind: IConcierge.GroundingKind) =>
      offered.filter((item) => item.kind === kind).length

    this.logger.info(
      `operation=${tenant.slug} enabled=${policy.enabled} offered=${offered.length} ` +
        `(lugares ${counted('establishment')}, experiências ${counted('experience')}, ` +
        `eventos ${counted('event')}) withheld=${withheld.length}`
    )

    const started = Date.now()
    const reply = await service.answer(this.question, offered, withheld, {
      enabled: policy.enabled,
    })
    const elapsed = Date.now() - started

    this.logger.info(`outcome=${reply.outcome} model=${reply.model ?? 'none'} in ${elapsed}ms`)
    if (reply.text) this.logger.log(reply.text)

    // The reference is a citation token; the link is always built from the slugs.
    for (const item of reply.items) {
      this.logger.log(
        `- [${item.kind}] ${item.name} → /cidades/${item.city_slug}/estabelecimentos/${item.establishment_slug}`
      )
    }
  }
}
