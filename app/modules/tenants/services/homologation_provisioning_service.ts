import { createHash } from 'node:crypto'
import { DateTime } from 'luxon'
import db from '@adonisjs/lucid/services/db'
import drive from '@adonisjs/drive/services/main'
import type { TransactionClientContract } from '@adonisjs/lucid/types/database'
import env from '#start/env'
import { deploymentEnvironment } from '#shared/utils/deployment_environment'
import {
  developmentIllustration,
  DEVELOPMENT_MEDIA_WIDTH,
  DEVELOPMENT_MEDIA_HEIGHT,
} from '#database/support/development_media'
import {
  ACCOUNT_KINDS,
  parseProvisioningConfig,
  ProvisioningError,
  type HomologationProvisioningConfig,
  type AccountKind,
} from '#modules/tenants/services/homologation_provisioning_config'
import Tenant from '#modules/tenants/models/tenant'
import User from '#modules/users/models/user'
import Role from '#modules/roles/models/role'
import AuditLog from '#modules/audits/models/audit_log'
import Region from '#modules/geography/models/region'
import City from '#modules/geography/models/city'
import CategoryFamily from '#modules/taxonomy/models/category_family'
import Category from '#modules/taxonomy/models/category'
import Organization from '#modules/organizations/models/organization'
import OrganizationMember from '#modules/organizations/models/organization_member'
import Establishment from '#modules/establishments/models/establishment'
import EstablishmentRevision from '#modules/establishments/models/establishment_revision'
import EstablishmentRevisionAddress from '#modules/establishments/models/establishment_revision_address'
import EstablishmentRevisionCategory from '#modules/establishments/models/establishment_revision_category'
import EstablishmentRevisionHour from '#modules/establishments/models/establishment_revision_hour'
import EstablishmentRevisionEvent from '#modules/establishments/models/establishment_revision_event'
import EstablishmentRevisionRepository from '#modules/establishments/repositories/establishment_revision_repository'
import { evaluateEstablishmentCompleteness } from '#modules/establishments/services/establishment_completeness_evaluator'
import StoredFile from '#modules/files/models/file'
import MediaAsset from '#modules/media/models/media_asset'
import EstablishmentRevisionMedia from '#modules/media/models/establishment_revision_media'
import MediaModerationEvent from '#modules/media/models/media_moderation_event'
import BenefitEdition from '#modules/benefits/models/benefit_edition'
import BenefitOffer from '#modules/benefits/models/benefit_offer'
import BenefitAccess from '#modules/benefits/models/benefit_access'
import PaymentMethodsService from '#modules/purchases/services/payment_methods_service'
import PaymentProviderService from '#modules/purchases/services/payment_provider_service'
import HomologationDemoContent, {
  type DemoContentOutcome,
} from '#modules/tenants/services/homologation_demo_content'

const ACTION = 'homologation.provision.v1'
const VENUES = [
  {
    slug: 'casa-de-petiscos-demo',
    name: 'Casa de Petiscos — demonstração',
    scene: 'petiscos' as const,
  },
  { slug: 'atelier-do-cafe-demo', name: 'Ateliê do Café — demonstração', scene: 'coffee' as const },
]

export interface ProvisioningReceipt {
  tenantId: number
  accounts: Record<AccountKind, number>
  establishmentIds: number[]
  editionIds: number[]
  offerIds: number[]
  courtesyAccessId: number
}

/** Explicit one-shot bootstrap; never called by migrations, HTTP or development seed. */
export default class HomologationProvisioningService {
  assertEnvironment() {
    if (deploymentEnvironment(env.get('DEPLOYMENT_ENV')) !== 'homologation')
      throw new ProvisioningError(
        'Provisioning requires DEPLOYMENT_ENV=homologation; development and production are refused'
      )
    if (env.get('PAYMENT_ENVIRONMENT', 'test') !== 'test')
      throw new ProvisioningError('Demonstration provisioning requires sandbox payments')
  }

  async run(input: HomologationProvisioningConfig) {
    this.assertEnvironment()
    const config = parseProvisioningConfig(input)
    try {
      // A replay does not even upload media. It must never reset editorial/financial decisions.
      const existing = await Tenant.findBy('slug', config.tenantSlug)
      if (existing) return { created: false, ...(await this.replay(existing, config)) }

      const methods = new PaymentMethodsService(new PaymentProviderService())
      if (
        !methods.forEdition(new BenefitEdition().fill({ price_cents: 4990, currency: 'BRL' }))
          .length
      )
        throw new ProvisioningError(
          'Configure a sandbox payment provider and available PAYMENT_METHODS before provisioning'
        )

      // Immutable original objects before DB transaction/locks; failures may leave only harmless
      // unreferenced demo objects. Checksummed keys make retries safe, including on R2.
      const images: Array<{
        venue: (typeof VENUES)[number]
        buffer: Buffer
        checksum: string
        key: string
        url: string
      }> = []
      for (const venue of VENUES) {
        const buffer = developmentIllustration(venue.scene)
        const checksum = createHash('sha256').update(buffer).digest('hex')
        const key = `homologation/media/v1/${env.get('DRIVE_DISK')}/${config.tenantSlug}/${venue.slug}/${checksum}.png`
        await drive.use().put(key, buffer, { contentType: 'image/png' })
        images.push({ venue, buffer, checksum, key, url: await drive.use().getUrl(key) })
      }
      return await db.transaction(async (client) => {
        // Serializes competing initial commands without a global transaction or network under lock.
        await client.rawQuery('select pg_advisory_xact_lock(?, hashtext(?))', [
          14026,
          config.tenantSlug,
        ])
        const concurrent = await Tenant.query({ client }).where('slug', config.tenantSlug).first()
        if (concurrent)
          return { created: false, ...(await this.replay(concurrent, config, client)) }
        const tenant = await Tenant.create(
          { slug: config.tenantSlug, name: config.tenantName, is_active: true },
          { client }
        )
        const users = await this.createAccounts(config, tenant.id, 'admin', client)
        const now = DateTime.utc()
        const administrator = users.administrator.id
        const region = await Region.create(
          {
            tenant_id: tenant.id,
            slug: 'norte-do-parana',
            name: 'Norte do Paraná',
            is_active: true,
            sort_order: 0,
          },
          { client }
        )
        const city = await City.create(
          {
            tenant_id: tenant.id,
            region_id: region.id,
            slug: 'londrina',
            name: 'Londrina',
            state_code: 'PR',
            country_code: 'BR',
            ibge_code: '4113700',
            timezone: 'America/Sao_Paulo',
            latitude: -23.3045,
            longitude: -51.1696,
            is_active: true,
            sort_order: 0,
          },
          { client }
        )
        const family = await CategoryFamily.create(
          {
            tenant_id: tenant.id,
            name: 'Comer & Beber',
            slug: 'comer-e-beber',
            icon: 'utensils',
            is_active: true,
            sort_order: 0,
          },
          { client }
        )
        const category = await Category.create(
          {
            tenant_id: tenant.id,
            family_id: family.id,
            name: 'Gastronomia demonstrativa',
            slug: 'gastronomia-demo',
            is_active: true,
            sort_order: 0,
            allows_always_open: false,
          },
          { client }
        )
        const organization = await Organization.create(
          {
            tenant_id: tenant.id,
            legal_name: 'Operação fictícia de homologação',
            trade_name: 'Experimente+ Demonstração',
            slug: 'demonstracao-homologacao',
            tax_id: '12345678000195',
            email: 'demonstracao@example.invalid',
            phone: '4300000000',
            status: 'active',
            created_by: administrator,
            submitted_at: now,
            reviewed_by: administrator,
            reviewed_at: now,
            review_notes: 'Conteúdo fictício provisionado explicitamente para homologação',
          },
          { client }
        )
        await this.attachOrganization(users, tenant.id, organization.id, client)

        const establishmentIds: number[] = []
        for (const image of images) {
          const establishment = await Establishment.create(
            {
              tenant_id: tenant.id,
              organization_id: organization.id,
              lifecycle_status: 'active',
              business_status: 'open',
              created_by: administrator,
            },
            { client }
          )
          const revision = await EstablishmentRevision.create(
            {
              tenant_id: tenant.id,
              establishment_id: establishment.id,
              version: 1,
              status: 'draft',
              city_id: city.id,
              public_name: image.venue.name,
              slug: image.venue.slug,
              short_description: 'Estabelecimento fictício para demonstração de gastronomia local.',
              description:
                'Esta ficha é inteiramente fictícia, com ilustração original. Existe para homologar descoberta, compra e uso de benefícios; não representa uma loja ou uma promoção real.',
              public_email: 'demonstracao@example.invalid',
              availability_type: 'regular_hours',
              created_by: administrator,
            },
            { client }
          )
          await EstablishmentRevisionAddress.create(
            {
              tenant_id: tenant.id,
              revision_id: revision.id,
              postal_code: '86020030',
              street: 'Endereço demonstrativo',
              number: '1',
              without_number: false,
              district: 'Centro',
              latitude: -23.3103,
              longitude: -51.1628,
              coordinate_source: 'manual',
            },
            { client }
          )
          await EstablishmentRevisionCategory.create(
            {
              tenant_id: tenant.id,
              revision_id: revision.id,
              category_id: category.id,
              is_primary: true,
              sort_order: 0,
            },
            { client }
          )
          for (let weekday = 0; weekday < 7; weekday++)
            await EstablishmentRevisionHour.create(
              {
                tenant_id: tenant.id,
                revision_id: revision.id,
                weekday,
                opens_at: '08:00',
                closes_at: '23:00',
                spans_next_day: false,
                sort_order: 0,
              },
              { client }
            )
          const file = await StoredFile.create(
            {
              tenant_id: tenant.id,
              owner_id: administrator,
              client_name: image.venue.slug + '.png',
              file_name: image.key,
              file_size: image.buffer.length,
              file_type: 'image/png',
              file_category: 'image',
              url: image.url,
            },
            { client }
          )
          const asset = await MediaAsset.create(
            {
              tenant_id: tenant.id,
              establishment_id: establishment.id,
              file_id: file.id,
              media_type: 'image',
              file_extension: 'png',
              mime_type: 'image/png',
              checksum_sha256: image.checksum,
              width: DEVELOPMENT_MEDIA_WIDTH,
              height: DEVELOPMENT_MEDIA_HEIGHT,
              created_by: administrator,
            },
            { client }
          )
          const media = await EstablishmentRevisionMedia.create(
            {
              tenant_id: tenant.id,
              establishment_id: establishment.id,
              revision_id: revision.id,
              media_asset_id: asset.id,
              purpose: 'gallery',
              is_cover: true,
              sort_order: 0,
              alt_text:
                'Ilustração original de gastronomia; estabelecimento fictício de homologação',
              moderation_status: 'approved',
              created_by: administrator,
              reviewed_by: administrator,
              reviewed_at: now,
              review_notes:
                'Ilustração original conhecida do provisionamento, sem conteúdo de terceiros',
            },
            { client }
          )
          await MediaModerationEvent.create(
            {
              tenant_id: tenant.id,
              establishment_id: establishment.id,
              revision_id: revision.id,
              media_asset_id: asset.id,
              revision_media_id: media.id,
              from_status: 'pending',
              to_status: 'approved',
              actor_id: administrator,
              reason: 'Aprovação explícita de material demonstrativo original',
              metadata: { source: ACTION },
              created_at: now,
            },
            { client }
          )
          const aggregate = await new EstablishmentRevisionRepository().findAggregate(
            tenant.id,
            revision.id,
            client
          )
          if (!aggregate) throw new ProvisioningError('Provisioning revision is missing')
          const completeness = evaluateEstablishmentCompleteness({
            revision: aggregate,
            organization_active: true,
            city_active: true,
            effective_attributes: [],
            allows_always_open: false,
            checked_at: now.toISO()!,
          })
          if (!completeness.eligible)
            throw new ProvisioningError('Demonstration revision failed completeness validation')
          await revision
            .merge({
              status: 'approved',
              submitted_at: now,
              reviewed_by: administrator,
              reviewed_at: now,
              rules_version: completeness.rules_version,
              review_notes:
                'Publicação explícita de conteúdo fictício pelo provisionamento de homologação',
            })
            .save()
          for (const [eventType, fromStatus, toStatus] of [
            ['created', null, 'draft'],
            ['submitted', 'draft', 'pending_review'],
            ['approved', 'pending_review', 'approved'],
            ['published', 'approved', 'approved'],
          ] as const)
            await EstablishmentRevisionEvent.create(
              {
                tenant_id: tenant.id,
                establishment_id: establishment.id,
                revision_id: revision.id,
                event_type: eventType,
                from_status: fromStatus,
                to_status: toStatus,
                actor_id: administrator,
                metadata: {
                  source: ACTION,
                  score: completeness.score,
                  rules_version: completeness.rules_version,
                },
                created_at: now,
              },
              { client }
            )
          // Projection triggers, pointer, composition, evidence and accounts commit atomically.
          await establishment.merge({ published_revision_id: revision.id }).save()
          establishmentIds.push(establishment.id)
        }
        const editions: BenefitEdition[] = []
        const offerIds: number[] = []
        for (const paid of [false, true]) {
          const edition = await BenefitEdition.create(
            {
              tenant_id: tenant.id,
              city_id: city.id,
              slug: paid ? 'londrina-pacote-homologacao' : 'londrina-cortesia-homologacao',
              name: paid ? 'Londrina — pacote demonstrativo' : 'Londrina — cortesia demonstrativa',
              description:
                'Campanha fictícia exclusiva de homologação, sem promessa de serviço real.',
              price_cents: paid ? 4990 : 0,
              currency: 'BRL',
              sales_starts_at: now.minus({ days: 1 }),
              sales_ends_at: now.plus({ months: 3 }),
              usage_starts_at: now.minus({ days: 1 }),
              usage_ends_at: now.plus({ months: 8 }),
              status: 'published',
              created_by: administrator,
              published_at: now,
            },
            { client }
          )
          editions.push(edition)
          for (const establishmentId of establishmentIds) {
            const offer = await BenefitOffer.create(
              {
                tenant_id: tenant.id,
                edition_id: edition.id,
                establishment_id: establishmentId,
                standalone_price_cents: paid ? 1490 : null,
                title: 'Item em dobro — demonstração',
                description:
                  'Peça um item participante e receba outro, apenas no cenário fictício.',
                benefit_type: 'buy_one_get_one',
                terms:
                  'Demonstração fictícia. Consumo no local; não cumulativo. Sem serviço ou cobrança real no adaptador falso.',
                available_weekdays_mask: 127,
                reservation_required: false,
                on_premise_only: true,
                minimum_party_size: 1,
                max_redemptions_per_access: 1,
                status: 'active',
                created_by: users.partner.id,
                activated_at: now,
              },
              { client }
            )
            offerIds.push(offer.id)
          }
        }
        const access = await this.grantCourtesy(users, tenant.id, editions[0].id, ACTION, client)
        const receipt: ProvisioningReceipt = {
          tenantId: tenant.id,
          accounts: { administrator, partner: users.partner.id, customer: users.customer.id },
          establishmentIds,
          editionIds: editions.map((e) => e.id),
          offerIds,
          courtesyAccessId: access.id,
        }
        await AuditLog.create(
          {
            user_id: administrator,
            resource: 'tenants',
            action: ACTION,
            context: 'console',
            resource_id: tenant.id,
            result: 'granted',
            reason: 'Provisionamento demonstrativo autorizado em homologação',
            metadata: receipt,
          },
          { client }
        )
        return { created: true, ...receipt }
      })
    } catch (error) {
      if (error instanceof ProvisioningError) throw error
      // DB errors may include hashes; SDK errors may include authorization. Never propagate causes.
      throw new ProvisioningError(
        'Provisioning failed; verify infrastructure privately and rerun with the same configuration'
      )
    }
  }

  /**
   * Demonstration content over the baseline: agenda events, experiences,
   * showcase items, reviews with a partner reply and one pending report.
   *
   * It runs after `run` on every invocation of `homologation:provision`, the
   * first and every replay, because the baseline's replay deliberately does
   * nothing — and a homologation provisioned before this content existed would
   * otherwise never receive it. Identities are checked exactly as a replay
   * checks them, and each item is created at most once (see
   * `homologation_demo_content`). Completed steps survive a failure, so a rerun
   * continues where the last one stopped.
   */
  async provisionDemoContent(
    input: HomologationProvisioningConfig,
    now: DateTime = DateTime.utc()
  ): Promise<DemoContentOutcome> {
    this.assertEnvironment()
    const config = parseProvisioningConfig(input)
    const tenant = await Tenant.findBy('slug', config.tenantSlug)
    if (!tenant)
      throw new ProvisioningError(
        'No provisioned tenant; run homologation:provision so the baseline exists first'
      )
    const receipt = await this.replay(tenant, config)
    try {
      return await new HomologationDemoContent(receipt, config.tenantSlug, now).provision()
    } catch (error) {
      if (error instanceof ProvisioningError) throw error
      throw new ProvisioningError(
        'Demonstration content failed; completed steps are kept, verify privately and rerun'
      )
    }
  }

  /** This exception is console-only and must be asserted before even reading private input. */
  assertTestAccountsEnvironment(allowTestAccounts: boolean) {
    const deployment = env.get('DEPLOYMENT_ENV')
    if (deployment !== 'homologation' && deployment !== 'development')
      throw new ProvisioningError(
        'Test accounts require DEPLOYMENT_ENV=homologation or development; production, missing and invalid environments are refused'
      )
    if (allowTestAccounts !== true)
      throw new ProvisioningError(
        'Explicit --allow-test-accounts is required; creates a global root test account'
      )
  }

  async provisionTestAccounts(input: HomologationProvisioningConfig, allowTestAccounts: boolean) {
    this.assertTestAccountsEnvironment(allowTestAccounts)
    const config = parseProvisioningConfig(input, true)
    const action = 'homologation.test-accounts.v1'
    try {
      return await db.transaction(async (client) => {
        await client.rawQuery('select pg_advisory_xact_lock(?, hashtext(?))', [
          14026,
          config.tenantSlug,
        ])
        const tenant = await Tenant.query({ client })
          .where('slug', config.tenantSlug)
          .where('is_active', true)
          .first()
        if (!tenant || tenant.name !== config.tenantName)
          throw new ProvisioningError(
            'An active provisioned tenant with matching name and slug is required'
          )
        const previous = await AuditLog.query({ client })
          .where('resource', 'tenants')
          .where('resource_id', tenant.id)
          .where('action', action)
          .first()
        if (previous)
          return { created: false, ...(await this.replay(tenant, config, client, action)) }
        const baseline = await AuditLog.query({ client })
          .where('resource', 'tenants')
          .where('resource_id', tenant.id)
          .where('action', ACTION)
          .first()
        if (!baseline?.metadata)
          throw new ProvisioningError(
            'Run homologation:provision first; test accounts never create or adopt a baseline'
          )
        const original = baseline.metadata as ProvisioningReceipt
        const courtesy = await BenefitAccess.query({ client })
          .where('id', original.courtesyAccessId)
          .where('tenant_id', tenant.id)
          .where('source', 'courtesy')
          .firstOrFail()
        const edition = await BenefitEdition.query({ client })
          .where('id', courtesy.edition_id)
          .where('tenant_id', tenant.id)
          .where('status', 'published')
          .where('usage_starts_at', '<=', DateTime.utc().toJSDate())
          .where('usage_ends_at', '>', DateTime.utc().toJSDate())
          .first()
        if (!edition)
          throw new ProvisioningError(
            'Baseline courtesy edition is not usable; manage its campaign explicitly'
          )
        const establishments = await Establishment.query({ client })
          .whereIn('id', original.establishmentIds)
          .where('tenant_id', tenant.id)
          .where('lifecycle_status', 'active')
          .whereNotNull('published_revision_id')
          .whereNot('business_status', 'permanently_closed')
        const organizationIds = [
          ...new Set(establishments.map((establishment) => establishment.organization_id)),
        ]
        if (organizationIds.length !== 1)
          throw new ProvisioningError(
            'Baseline must have one active organization with published establishments'
          )
        const organization = await Organization.query({ client })
          .where('id', organizationIds[0])
          .where('tenant_id', tenant.id)
          .where('status', 'active')
          .firstOrFail()
        const offers = await BenefitOffer.query({ client })
          .where('tenant_id', tenant.id)
          .where('edition_id', edition.id)
          .where('status', 'active')
          .whereIn(
            'establishment_id',
            establishments.map((establishment) => establishment.id)
          )
          .where((query) =>
            query.whereNull('ends_at').orWhere('ends_at', '>', DateTime.utc().toJSDate())
          )
        if (!offers.length) throw new ProvisioningError('Baseline has no active courtesy benefit')
        const users = await this.createAccounts(config, tenant.id, 'root', client)
        await this.attachOrganization(users, tenant.id, organization.id, client)
        const access = await this.grantCourtesy(users, tenant.id, edition.id, action, client)
        const receipt: ProvisioningReceipt = {
          tenantId: tenant.id,
          accounts: {
            administrator: users.administrator.id,
            partner: users.partner.id,
            customer: users.customer.id,
          },
          establishmentIds: establishments.map((establishment) => establishment.id),
          editionIds: [edition.id],
          offerIds: offers.map((offer) => offer.id),
          courtesyAccessId: access.id,
        }
        await AuditLog.create(
          {
            user_id: users.administrator.id,
            resource: 'tenants',
            resource_id: tenant.id,
            action,
            context: 'console',
            result: 'granted',
            reason:
              'Explicit non-production test accounts; global root and private operator-supplied credentials',
            metadata: receipt,
          },
          { client }
        )
        return { created: true, ...receipt }
      })
    } catch (error) {
      if (error instanceof ProvisioningError) throw error
      throw new ProvisioningError(
        'Test account provisioning failed; verify privately and rerun with the same configuration'
      )
    }
  }

  private async createAccounts(
    config: HomologationProvisioningConfig,
    tenantId: number,
    administratorRole: 'admin' | 'root',
    client: TransactionClientContract
  ) {
    const emails = ACCOUNT_KINDS.map((kind) => config.accounts[kind].email)
    if (await client.from('users').whereIn('email', emails).first())
      throw new ProvisioningError(
        'Configured identities already exist; provisioning never adopts or elevates existing accounts'
      )
    const adminRole = await Role.query({ client }).where('slug', administratorRole).firstOrFail()
    const userRole = await Role.query({ client }).where('slug', 'user').firstOrFail()
    const users = {} as Record<AccountKind, User>
    for (const kind of ACCOUNT_KINDS) {
      const account = config.accounts[kind]
      const user = await User.create(
        {
          full_name: account.fullName,
          email: account.email,
          password: account.password,
          username: null,
          is_deleted: false,
        },
        { client }
      )
      await user.related('roles').attach([kind === 'administrator' ? adminRole.id : userRole.id])
      await user
        .related('tenants')
        .attach({ [tenantId]: { role: kind === 'administrator' ? 'owner' : 'member' } })
      users[kind] = user
    }
    return users
  }

  private async attachOrganization(
    users: Record<AccountKind, User>,
    tenantId: number,
    organizationId: number,
    client: TransactionClientContract
  ) {
    for (const kind of ['administrator', 'partner'] as const)
      await OrganizationMember.create(
        {
          tenant_id: tenantId,
          organization_id: organizationId,
          user_id: users[kind].id,
          role: kind === 'administrator' ? 'owner' : 'admin',
          status: 'active',
          invited_by: users.administrator.id,
          joined_at: DateTime.utc(),
        },
        { client }
      )
  }

  private async grantCourtesy(
    users: Record<AccountKind, User>,
    tenantId: number,
    editionId: number,
    action: string,
    client: TransactionClientContract
  ) {
    return BenefitAccess.create(
      {
        tenant_id: tenantId,
        edition_id: editionId,
        user_id: users.customer.id,
        source: 'courtesy',
        status: 'active',
        external_reference: action + ':' + tenantId,
        granted_by: users.administrator.id,
        granted_at: DateTime.utc(),
        notes: 'Cortesia demonstrativa; reexecução não restaura cotas nem revogações',
      },
      { client }
    )
  }

  private async replay(
    tenant: Tenant,
    config: HomologationProvisioningConfig,
    client?: TransactionClientContract,
    action = ACTION
  ): Promise<ProvisioningReceipt> {
    const marker = await AuditLog.query({ client })
      .where('resource', 'tenants')
      .where('resource_id', tenant.id)
      .where('action', action)
      .first()
    if (!marker?.metadata)
      throw new ProvisioningError(
        'Existing tenant was not created by this provisioner; automatic adoption is refused'
      )
    const receipt = marker.metadata as ProvisioningReceipt
    for (const kind of ACCOUNT_KINDS) {
      const user = await User.query({ client }).where('id', receipt.accounts[kind]).first()
      if (!user || user.email !== config.accounts[kind].email)
        throw new ProvisioningError(
          'Provisioned identities changed; use account administration instead of reprovisioning'
        )
    }
    return receipt
  }
}
