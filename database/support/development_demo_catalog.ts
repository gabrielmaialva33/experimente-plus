import logger from '@adonisjs/core/services/logger'
import { DateTime } from 'luxon'

import DemoCatalogProvisioner, {
  type DemoCatalogOutcome,
} from '#database/support/demo/demo_catalog_provisioner'
import BenefitAccess from '#modules/benefits/models/benefit_access'
import BenefitEdition from '#modules/benefits/models/benefit_edition'
import OrganizationMember from '#modules/organizations/models/organization_member'
import type Tenant from '#modules/tenants/models/tenant'
import type User from '#modules/users/models/user'
import env from '#start/env'

export const DEVELOPMENT_DEMO_CATALOG_ACTION = 'development.demo-catalog.v1'

/** Passports the local customer holds, so the wallet has something to present. */
const HELD_PASSPORTS = ['passaporte-londrina-demo', 'passaporte-maringa-demo']

/**
 * The rich demo catalogue in the local development operation.
 *
 * Demo accounts use `@experimente.local` addresses and the password in
 * `DEV_DEMO_PASSWORD` (default `experimente123`), so a developer can sign in as
 * any fictitious partner or consumer. Two local conveniences sit on top: the
 * development partner also administers a multi-city organization, and the
 * development customer holds the Londrina and Maringá passports.
 */
export async function seedDevelopmentDemoCatalog(
  tenant: Tenant,
  administrator: User,
  partner: User,
  holder: User,
  now: DateTime = DateTime.utc()
): Promise<DemoCatalogOutcome> {
  const provisioner = new DemoCatalogProvisioner({
    tenant,
    administrator,
    markerAction: DEVELOPMENT_DEMO_CATALOG_ACTION,
    storagePrefix: ['seed/demo/v1', env.get('DRIVE_DISK'), tenant.id].join('/'),
    emailDomain: 'experimente.local',
    accountPassword: env.get('DEV_DEMO_PASSWORD', 'experimente123'),
    source: 'development_seeder',
    now,
  })
  const outcome = await provisioner.provision()

  const organization = provisioner.organization('casa-paineira')
  if (organization)
    await OrganizationMember.firstOrCreate(
      { tenant_id: tenant.id, organization_id: organization.id, user_id: partner.id },
      {
        tenant_id: tenant.id,
        organization_id: organization.id,
        user_id: partner.id,
        role: 'admin',
        status: 'active',
        invited_by: administrator.id,
        joined_at: now,
      }
    )

  for (const slug of HELD_PASSPORTS) {
    const edition = await BenefitEdition.query()
      .where('tenant_id', tenant.id)
      .where('slug', slug)
      .where('status', 'published')
      .first()
    if (!edition) continue
    await BenefitAccess.firstOrCreate(
      {
        tenant_id: tenant.id,
        source: 'courtesy',
        external_reference: `development:${slug}:${holder.id}`,
      },
      {
        tenant_id: tenant.id,
        edition_id: edition.id,
        user_id: holder.id,
        source: 'courtesy',
        status: 'active',
        external_reference: `development:${slug}:${holder.id}`,
        notes: 'Acesso fictício do catálogo de demonstração local.',
        granted_by: administrator.id,
        granted_at: now,
      }
    )
  }

  // Keys and domain reasons only: never credentials or raw errors.
  logger.info(
    `Demo catalogue: ${outcome.created.length} created, ${outcome.alreadyPresent.length} already present, ${outcome.notCreated.length} not created`
  )
  for (const skipped of outcome.notCreated)
    logger.warn(`Not created ${skipped.key}: ${skipped.reason}`)
  return outcome
}
