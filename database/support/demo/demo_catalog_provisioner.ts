import { createHash, randomBytes } from 'node:crypto'

import app from '@adonisjs/core/services/app'
import drive from '@adonisjs/drive/services/main'
import db from '@adonisjs/lucid/services/db'
import { DateTime } from 'luxon'

import { DEMO_EDITIONS, DEMO_OFFER_TERMS_NOTICE } from '#database/support/demo/catalog/benefits'
import {
  DEMO_CONTENT_NOTICE,
  DEMO_EVENTS,
  DEMO_EXPERIENCES,
  DEMO_SHOWCASE_ITEMS,
  type DemoEvent,
} from '#database/support/demo/catalog/content'
import { DEMO_CITIES, DEMO_REGIONS, demoCity } from '#database/support/demo/catalog/geography'
import {
  DEMO_CONSUMERS,
  DEMO_ORGANIZATIONS,
  DEMO_PARTNERS,
  demoCnpj,
  type DemoPerson,
} from '#database/support/demo/catalog/people'
import {
  DEMO_HOURS,
  DEMO_MARKER,
  DEMO_PLACE_NOTICE,
  DEMO_PLACES,
  type DemoPlace,
} from '#database/support/demo/catalog/places'
import { demoReviewPlan } from '#database/support/demo/catalog/reviews'
import {
  DEMO_ATTRIBUTES,
  DEMO_CATEGORIES,
  DEMO_FAMILIES,
} from '#database/support/demo/catalog/taxonomy'
import { DEMO_MOTIF_ALT } from '#database/support/demo/illustration/alt_text'
import { seededRandom } from '#database/support/demo/illustration/palette'
import {
  demoIllustration,
  DEMO_IMAGE_HEIGHT,
  DEMO_IMAGE_WIDTH,
  type DemoImageRequest,
  type DemoMotif,
} from '#database/support/demo/illustration/scenes'
import BaseException from '#exceptions/base_exception'
import AuditLog from '#modules/audits/models/audit_log'
import BenefitEdition from '#modules/benefits/models/benefit_edition'
import BenefitOffer from '#modules/benefits/models/benefit_offer'
import BenefitEditionService from '#modules/benefits/services/benefit_edition_service'
import BenefitOfferService from '#modules/benefits/services/benefit_offer_service'
import type IEstablishment from '#modules/establishments/interfaces/establishment_interface'
import Establishment from '#modules/establishments/models/establishment'
import EstablishmentRevision from '#modules/establishments/models/establishment_revision'
import EstablishmentAddressService from '#modules/establishments/services/establishment_address_service'
import EstablishmentAttributesService from '#modules/establishments/services/establishment_attributes_service'
import EstablishmentCategoriesService from '#modules/establishments/services/establishment_categories_service'
import EstablishmentHoursService from '#modules/establishments/services/establishment_hours_service'
import EstablishmentModerationService from '#modules/establishments/services/establishment_moderation_service'
import EstablishmentService from '#modules/establishments/services/establishment_service'
import EstablishmentSubmissionService from '#modules/establishments/services/establishment_submission_service'
import StoredFile from '#modules/files/models/file'
import City from '#modules/geography/models/city'
import Region from '#modules/geography/models/region'
import EstablishmentRevisionMedia from '#modules/media/models/establishment_revision_media'
import MediaAsset from '#modules/media/models/media_asset'
import MediaEventService from '#modules/media/services/media_event_service'
import MediaModerationService from '#modules/media/services/media_moderation_service'
import Organization from '#modules/organizations/models/organization'
import OrganizationService from '#modules/organizations/services/organization_service'
import OrganizationWorkflowService from '#modules/organizations/services/organization_workflow_service'
import type IPartnerContent from '#modules/partner_content/interfaces/partner_content_interface'
import PartnerContentMedia from '#modules/partner_content/models/partner_content_media'
import PartnerContentPolicyRepository from '#modules/partner_content/repositories/partner_content_policy_repository'
import PartnerContentRepository from '#modules/partner_content/repositories/partner_content_repository'
import { cityDayWindow } from '#modules/partner_content/services/city_day_window'
import PartnerContentMediaService from '#modules/partner_content/services/partner_content_media_service'
import PartnerContentService from '#modules/partner_content/services/partner_content_service'
import ContentReport from '#modules/reviews/models/content_report'
import EstablishmentReview from '#modules/reviews/models/establishment_review'
import EstablishmentReviewPhoto from '#modules/reviews/models/establishment_review_photo'
import EstablishmentReviewReply from '#modules/reviews/models/establishment_review_reply'
import ReviewPolicyRepository from '#modules/reviews/repositories/review_policy_repository'
import EstablishmentReviewReplyService from '#modules/reviews/services/establishment_review_reply_service'
import EstablishmentReviewService from '#modules/reviews/services/establishment_review_service'
import IRole from '#modules/roles/interfaces/role_interface'
import Role from '#modules/roles/models/role'
import Category from '#modules/taxonomy/models/category'
import CategoryAttributeDefinition from '#modules/taxonomy/models/category_attribute_definition'
import CategoryAttributeOption from '#modules/taxonomy/models/category_attribute_option'
import CategoryFamily from '#modules/taxonomy/models/category_family'
import type Tenant from '#modules/tenants/models/tenant'
import User from '#modules/users/models/user'
import { normalizeSlug } from '#shared/utils/slug'

export interface DemoCatalogOptions {
  tenant: Tenant
  /** Platform administrator who approves, publishes and moderates, as a person would. */
  administrator: User
  /** Audit action under which every item is recorded, once. */
  markerAction: string
  /** Object-key prefix for the generated illustrations. */
  storagePrefix: string
  /** Domain of the demo accounts' and places' e-mail addresses. */
  emailDomain: string
  /**
   * Password of new demo accounts. When omitted each account gets a random one
   * that is never stored or shown: the account exists only as an author.
   */
  accountPassword?: string
  /** Where the content came from, written to event metadata. */
  source: string
  now?: DateTime
}

export interface DemoCatalogOutcome {
  created: string[]
  alreadyPresent: string[]
  notCreated: Array<{ key: string; reason: string }>
}

interface Marker {
  id: number | null
  adopted: boolean
}

interface StepResult {
  kind: string
  id: number | null
  adopted?: boolean
}

/** A named refusal that leaves the rest of the run going. */
export class DemoSkip extends Error {}

const HOLIDAYS: Array<{ month: number; day: number; name: string }> = [
  { month: 1, day: 1, name: 'Confraternização Universal' },
  { month: 4, day: 21, name: 'Tiradentes' },
  { month: 5, day: 1, name: 'Dia do Trabalho' },
  { month: 9, day: 7, name: 'Independência' },
  { month: 10, day: 12, name: 'Nossa Senhora Aparecida' },
  { month: 11, day: 2, name: 'Finados' },
  { month: 11, day: 15, name: 'Proclamação da República' },
  { month: 11, day: 20, name: 'Consciência Negra' },
  { month: 12, day: 25, name: 'Natal' },
]

const EVENING_CATEGORIES = new Set([
  'restaurantes',
  'bares',
  'hamburguerias',
  'pizzarias',
  'cozinha-japonesa',
])
const OUTSKIRTS_CATEGORIES = new Set(['parques-e-trilhas', 'turismo-rural', 'esportes-e-aventura'])

/**
 * The rich demo catalogue — cities, taxonomy, fictitious partners and
 * consumers, their organizations and places, partner content, city packages
 * and reviews — provisioned through the same domain services people use.
 *
 * One catalogue serves the development seed and the homologation
 * provisioning, and the rules are the same for both:
 *
 * - Create if missing, never overwrite. An item that already exists is
 *   adopted only when this catalogue could have created it (same owner, same
 *   slug); anything a person created is left alone, and a conflict is
 *   reported instead of resolved.
 * - Every item is recorded once under `markerAction`. A recorded item is never
 *   created again and never restored: what a moderator archived, suspended or
 *   sent back stays that way.
 * - Publication goes through submission and moderation: the partner submits
 *   the place, the administrator approves its images and its revision, and
 *   the catalogue projection follows through its own triggers.
 * - Domain refusals (a policy the operation changed, a slug taken, a daily
 *   limit) are reported per item and the run goes on; the next run retries
 *   what is missing.
 */
export default class DemoCatalogProvisioner {
  private outcome: DemoCatalogOutcome = { created: [], alreadyPresent: [], notCreated: [] }
  private markers = new Map<string, Marker>()
  private readonly now: DateTime
  private readonly users = new Map<string, User>()
  private readonly organizations = new Map<string, Organization>()
  private readonly cities = new Map<string, City>()
  private readonly categories = new Map<string, Category>()
  private readonly places = new Map<string, Establishment>()

  constructor(private options: DemoCatalogOptions) {
    this.now = options.now ?? DateTime.utc()
  }

  get tenantId() {
    return this.options.tenant.id
  }

  async provision(): Promise<DemoCatalogOutcome> {
    this.markers = await this.recordedMarkers()
    await this.provisionGeography()
    await this.provisionTaxonomy()
    await this.provisionAccounts()
    await this.provisionOrganizations()
    await this.provisionPlaces()
    await this.provisionBenefits()
    await this.provisionContent()
    await this.provisionReviews()
    return this.outcome
  }

  /** Organizations by catalogue key, for callers that attach extra members (development only). */
  organization(key: string): Organization | undefined {
    return this.organizations.get(key)
  }

  // -------------------------------------------------------------------------
  // Geography and taxonomy
  // -------------------------------------------------------------------------

  private async provisionGeography() {
    const regions = new Map<string, Region>()
    for (const definition of DEMO_REGIONS) {
      await this.once(`region:${definition.slug}`, async () => {
        const existing = await Region.query()
          .where('tenant_id', this.tenantId)
          .where('slug', definition.slug)
          .first()
        if (existing) return { kind: 'region', id: existing.id, adopted: true }
        const region = await Region.create({
          tenant_id: this.tenantId,
          name: definition.name,
          slug: definition.slug,
          description: definition.description,
          sort_order: definition.sort_order,
          is_active: true,
        })
        return { kind: 'region', id: region.id }
      })
      const region = await Region.query()
        .where('tenant_id', this.tenantId)
        .where('slug', definition.slug)
        .first()
      if (region) regions.set(definition.slug, region)
    }

    for (const definition of DEMO_CITIES) {
      await this.once(`city:${definition.slug}`, async () => {
        const existing = await City.query()
          .where('tenant_id', this.tenantId)
          .where('slug', definition.slug)
          .first()
        if (existing) return { kind: 'city', id: existing.id, adopted: true }
        const region = regions.get(definition.region_slug)
        if (!region) throw new DemoSkip(`região ${definition.region_slug} indisponível`)
        const city = await City.create({
          tenant_id: this.tenantId,
          region_id: region.id,
          name: definition.name,
          slug: definition.slug,
          state_code: 'PR',
          country_code: 'BR',
          ibge_code: definition.ibge_code,
          timezone: 'America/Sao_Paulo',
          latitude: definition.latitude,
          longitude: definition.longitude,
          sort_order: definition.sort_order,
          is_active: true,
        })
        return { kind: 'city', id: city.id }
      })
      const city = await City.query()
        .where('tenant_id', this.tenantId)
        .where('slug', definition.slug)
        .first()
      if (city) this.cities.set(definition.slug, city)
    }
  }

  private async provisionTaxonomy() {
    const families = new Map<string, CategoryFamily>()
    for (const definition of DEMO_FAMILIES) {
      await this.once(`family:${definition.slug}`, async () => {
        const existing = await CategoryFamily.query()
          .where('tenant_id', this.tenantId)
          .where('slug', definition.slug)
          .first()
        if (existing) return { kind: 'family', id: existing.id, adopted: true }
        const family = await CategoryFamily.create({
          tenant_id: this.tenantId,
          name: definition.name,
          slug: definition.slug,
          description: definition.description,
          icon: definition.icon,
          sort_order: definition.sort_order,
          is_active: true,
        })
        return { kind: 'family', id: family.id }
      })
      const family = await CategoryFamily.query()
        .where('tenant_id', this.tenantId)
        .where('slug', definition.slug)
        .first()
      if (family) families.set(definition.slug, family)
    }

    for (const definition of DEMO_CATEGORIES) {
      const categoryKey = `category:${definition.slug}`
      await this.once(categoryKey, async () => {
        const existing = await Category.query()
          .where('tenant_id', this.tenantId)
          .where('slug', definition.slug)
          .first()
        if (existing) return { kind: 'category', id: existing.id, adopted: true }
        const family = families.get(definition.family_slug)
        if (!family) throw new DemoSkip(`família ${definition.family_slug} indisponível`)
        const category = await Category.create({
          tenant_id: this.tenantId,
          family_id: family.id,
          parent_id: null,
          name: definition.name,
          slug: definition.slug,
          description: definition.description,
          icon: definition.icon,
          sort_order: definition.sort_order,
          is_active: true,
          allows_always_open: definition.allows_always_open ?? false,
        })
        return { kind: 'category', id: category.id }
      })
      const category = await Category.query()
        .where('tenant_id', this.tenantId)
        .where('slug', definition.slug)
        .first()
      if (!category) continue
      this.categories.set(definition.slug, category)

      // A form belongs to whoever created the category. Attributes are added
      // only to categories this catalogue created, so a required field never
      // appears on a form the operation designed.
      const ownCategory = this.markers.get(categoryKey)?.adopted === false
      for (const [index, attribute] of (DEMO_ATTRIBUTES[definition.slug] ?? []).entries()) {
        const existing = await CategoryAttributeDefinition.query()
          .where('tenant_id', this.tenantId)
          .where('category_id', category.id)
          .where('key', attribute.key)
          .first()
        if (existing || !ownCategory) continue
        await this.once(`attribute:${definition.slug}:${attribute.key}`, async () => {
          const created = await db.transaction(async (client) => {
            const row = await CategoryAttributeDefinition.create(
              {
                tenant_id: this.tenantId,
                category_id: category.id,
                key: attribute.key,
                name: attribute.name,
                description: attribute.description,
                data_type: attribute.data_type,
                unit: attribute.data_type === 'decimal' ? 'BRL' : null,
                is_required: attribute.is_required ?? false,
                is_filterable: attribute.is_filterable ?? false,
                is_public: true,
                applies_to_descendants: false,
                sort_order: index,
                is_active: true,
                validation_rules: attribute.validation_rules ?? {},
              },
              { client }
            )
            for (const [optionIndex, option] of (attribute.options ?? []).entries()) {
              await CategoryAttributeOption.create(
                {
                  tenant_id: this.tenantId,
                  attribute_definition_id: row.id,
                  label: option.label,
                  value: option.value,
                  sort_order: optionIndex,
                  is_active: true,
                },
                { client }
              )
            }
            return row
          })
          return { kind: 'attribute', id: created.id }
        })
      }
    }
  }

  // -------------------------------------------------------------------------
  // People and organizations
  // -------------------------------------------------------------------------

  private async provisionAccounts() {
    const userRole = await Role.findByOrFail('slug', IRole.Slugs.USER)
    for (const person of [...DEMO_PARTNERS, ...DEMO_CONSUMERS]) {
      const marker = await this.once(`account:${person.key}`, async () => {
        const email = this.emailFor(person)
        if (await User.findBy('email', email))
          throw new DemoSkip('já existe uma conta com este e-mail; contas nunca são adotadas')
        const user = await db.transaction(async (client) => {
          const created = await User.create(
            {
              full_name: person.full_name,
              email,
              password:
                this.options.accountPassword ?? randomBytes(24).toString('base64url') + 'aA1',
              username: null,
              is_deleted: false,
            },
            { client }
          )
          await created.related('roles').attach([userRole.id])
          await created.related('tenants').attach({ [this.tenantId]: { role: 'member' } })
          return created
        })
        return { kind: 'account', id: user.id }
      })
      if (marker?.id) {
        const user = await User.find(marker.id)
        if (user && !user.is_deleted) this.users.set(person.key, user)
      }
    }
  }

  private async provisionOrganizations() {
    const organizations = await app.container.make(OrganizationService)
    const workflow = await app.container.make(OrganizationWorkflowService)
    for (const definition of DEMO_ORGANIZATIONS) {
      const marker = await this.once(`organization:${definition.key}`, async () => {
        const owner = this.users.get(definition.owner)
        if (!owner) throw new DemoSkip('conta da pessoa responsável indisponível')
        let organization = await Organization.query()
          .where('tenant_id', this.tenantId)
          .where('slug', definition.slug)
          .first()
        const adopted = Boolean(organization)
        if (organization && organization.created_by !== owner.id)
          throw new DemoSkip('o endereço da organização já pertence a outra organização')
        if (!organization) {
          organization = await organizations.create(this.tenantId, owner, {
            legal_name: definition.legal_name,
            trade_name: definition.trade_name,
            slug: definition.slug,
            tax_id: demoCnpj(definition.cnpj_branch),
            email: `contato.${definition.key}@${this.options.emailDomain}`,
            phone: '4300000000',
            website: null,
          })
        }
        if (organization.status === 'draft')
          organization = await workflow.submit(this.tenantId, organization.id, owner)
        if (organization.status === 'pending_review')
          organization = await workflow.approve(
            this.tenantId,
            organization.id,
            this.options.administrator,
            'Organização fictícia aprovada para o catálogo de demonstração'
          )
        if (organization.status !== 'active')
          throw new DemoSkip(`organização em ${organization.status}; decisão de moderação mantida`)
        return { kind: 'organization', id: organization.id, adopted }
      })
      if (marker?.id) {
        const organization = await Organization.find(marker.id)
        if (organization) this.organizations.set(definition.key, organization)
      }
    }
  }

  // -------------------------------------------------------------------------
  // Places
  // -------------------------------------------------------------------------

  private async provisionPlaces() {
    for (const place of DEMO_PLACES) {
      const marker = await this.once(`place:${place.key}`, () => this.publishPlace(place))
      if (marker?.id) {
        const establishment = await Establishment.find(marker.id)
        if (establishment) this.places.set(place.key, establishment)
      }
    }
  }

  private async publishPlace(place: DemoPlace): Promise<StepResult> {
    const definition = DEMO_ORGANIZATIONS.find((item) => item.key === place.organization)!
    const organization = this.organizations.get(place.organization)
    const owner = this.users.get(definition.owner)
    const city = this.cities.get(place.city)
    const category = this.categories.get(place.category)
    if (!organization || !owner) throw new DemoSkip('organização ou responsável indisponível')
    if (!city || !category) throw new DemoSkip('cidade ou categoria indisponível')

    const establishmentService = await app.container.make(EstablishmentService)
    const publicName = place.name + DEMO_MARKER
    const slug = normalizeSlug(publicName)
    const existing = await EstablishmentRevision.query()
      .where('tenant_id', this.tenantId)
      .where('city_id', city.id)
      .where('slug', slug)
      .orderBy('version', 'desc')
      .first()

    let establishmentId: number
    if (existing) {
      const establishment = await Establishment.findOrFail(existing.establishment_id)
      if (establishment.organization_id !== organization.id)
        throw new DemoSkip('o endereço público já é usado por outra organização nesta cidade')
      establishmentId = establishment.id
    } else {
      await establishmentService.create(
        this.tenantId,
        organization.id,
        owner,
        this.identityFor(place, city.id)
      )
      // The slug was free, so the service kept it: it identifies the new unit.
      const created = await EstablishmentRevision.query()
        .where('tenant_id', this.tenantId)
        .where('city_id', city.id)
        .where('slug', slug)
        .firstOrFail()
      establishmentId = created.establishment_id
    }

    await this.completePlace(place, establishmentId, owner, category)
    return { kind: 'place', id: establishmentId, adopted: Boolean(existing) }
  }

  private identityFor(place: DemoPlace, cityId: number): IEstablishment.RevisionIdentityPayload {
    const handle = place.key
    const availability =
      place.availability === 'appointment'
        ? 'appointment_only'
        : place.availability === 'always'
          ? 'always_open'
          : 'regular_hours'
    return {
      public_name: place.name + DEMO_MARKER,
      city_id: cityId,
      short_description: place.short,
      description: `${place.description} ${DEMO_PLACE_NOTICE}`,
      public_email: `${handle}@${this.options.emailDomain}`,
      website: place.website === false ? null : `https://example.com/demo/${handle}`,
      booking_url:
        availability === 'appointment_only' ? `https://example.com/demo/${handle}/agendar` : null,
      availability_type: availability,
    }
  }

  /**
   * Walks one place through the partner's editing, the moderator's decisions
   * and publication. Each call starts from wherever the place stands, so a run
   * that stopped half-way continues instead of starting over.
   */
  private async completePlace(
    place: DemoPlace,
    establishmentId: number,
    owner: User,
    category: Category
  ) {
    const administrator = this.options.administrator
    const establishment = await Establishment.findOrFail(establishmentId)
    const open = await EstablishmentRevision.query()
      .where('tenant_id', this.tenantId)
      .where('establishment_id', establishmentId)
      .whereIn('status', ['draft', 'pending_review', 'changes_requested', 'rejected'])
      .orderBy('version', 'desc')
      .first()

    if (open && ['changes_requested', 'rejected'].includes(open.status))
      throw new DemoSkip('a moderação devolveu esta ficha; a decisão é mantida')

    if (open?.status === 'draft') {
      const address = await app.container.make(EstablishmentAddressService)
      const categories = await app.container.make(EstablishmentCategoriesService)
      const attributes = await app.container.make(EstablishmentAttributesService)
      const hours = await app.container.make(EstablishmentHoursService)

      const [latitude, longitude] = this.coordinatesFor(place)
      await address.replace(this.tenantId, establishmentId, owner, {
        postal_code: null,
        street: 'Endereço demonstrativo',
        number: String(seededRandom(`number|${place.key}`).int(12, 1980)),
        without_number: false,
        complement: null,
        district: place.district,
        reference: null,
        latitude,
        longitude,
        coordinate_source: 'manual',
      })
      const secondary = place.secondary ? this.categories.get(place.secondary) : undefined
      await categories.replace(this.tenantId, establishmentId, owner, [
        { category_id: category.id, is_primary: true, sort_order: 0 },
        ...(secondary ? [{ category_id: secondary.id, is_primary: false, sort_order: 1 }] : []),
      ])
      await attributes.replace(
        this.tenantId,
        establishmentId,
        owner,
        await this.attributeValues(place, category)
      )
      if (place.availability !== 'appointment' && place.availability !== 'always') {
        await hours.replaceWeekly(
          this.tenantId,
          establishmentId,
          owner,
          DEMO_HOURS[place.availability]
        )
        await hours.replaceSpecialDays(
          this.tenantId,
          establishmentId,
          owner,
          this.specialDays(place)
        )
      }

      const mediaCount = await EstablishmentRevisionMedia.query()
        .where('tenant_id', this.tenantId)
        .where('revision_id', open.id)
        .count('* as total')
      if (Number(mediaCount[0].$extras.total) === 0)
        await this.uploadPlaceImages(place, establishmentId, open.id, owner)
      if (place.publication !== 'pending_review') await this.approvePendingMedia(open.id)

      const submission = await app.container.make(EstablishmentSubmissionService)
      const submitted = await submission.submit(this.tenantId, establishmentId, owner)
      if (!submitted.submitted)
        throw new DemoSkip(
          'ficha incompleta: ' +
            submitted.gate.blocking_issues.map((issue) => issue.code).join(', ')
        )
    }

    const pending = await EstablishmentRevision.query()
      .where('tenant_id', this.tenantId)
      .where('establishment_id', establishmentId)
      .where('status', 'pending_review')
      .orderBy('version', 'desc')
      .first()
    if (pending && place.publication !== 'pending_review') {
      await this.approvePendingMedia(pending.id)
      const moderation = await app.container.make(EstablishmentModerationService)
      const decision = await moderation.approve(
        this.tenantId,
        pending.id,
        administrator,
        'Ficha fictícia aprovada para o catálogo de demonstração'
      )
      if (!decision.approved)
        throw new DemoSkip(
          'publicação recusada: ' +
            decision.publication_gate.blocking_issues.map((issue) => issue.code).join(', ')
        )
    }

    await establishment.refresh()
    if (
      place.business_status &&
      establishment.published_revision_id &&
      establishment.business_status === 'open'
    ) {
      const service = await app.container.make(EstablishmentService)
      await service.updateBusinessStatus(
        this.tenantId,
        establishmentId,
        owner,
        place.business_status
      )
    }
  }

  private coordinatesFor(place: DemoPlace): [number, number] {
    const city = demoCity(place.city)
    const rng = seededRandom(`coordinates|${place.key}`)
    const anchor = city.anchors?.[place.district]
    const [originLatitude, originLongitude] = anchor ?? [city.latitude, city.longitude]
    const reach = anchor
      ? 0.6
      : city.spread_km * (OUTSKIRTS_CATEGORIES.has(place.category) ? 1.7 : 1)
    const distance = reach * Math.sqrt(rng.between(0.04, 1))
    const angle = rng.between(0, Math.PI * 2)
    const latitude = originLatitude + (distance * Math.cos(angle)) / 111.32
    const longitude =
      originLongitude +
      (distance * Math.sin(angle)) / (111.32 * Math.cos((originLatitude * Math.PI) / 180))
    return [Number(latitude.toFixed(6)), Number(longitude.toFixed(6))]
  }

  private async attributeValues(
    place: DemoPlace,
    category: Category
  ): Promise<IEstablishment.AttributeValuePayload[]> {
    const definitions = await CategoryAttributeDefinition.query()
      .where('tenant_id', this.tenantId)
      .where('category_id', category.id)
      .where('is_active', true)
      .preload('options')
    const rng = seededRandom(`attributes|${place.key}`)
    const payload: IEstablishment.AttributeValuePayload[] = []
    for (const definition of definitions) {
      const explicit = place.attributes?.[definition.key]
      if (definition.data_type === 'single_select' || definition.data_type === 'multi_select') {
        const wanted =
          typeof explicit === 'string'
            ? explicit
            : definition.key === 'price_range'
              ? 'moderado'
              : definition.is_required
                ? definition.options[0]?.value
                : undefined
        const option = definition.options.find((item) => item.value === wanted && item.is_active)
        if (option)
          payload.push({ attribute_definition_id: definition.id, option_ids: [option.id] })
        continue
      }
      if (explicit !== undefined) {
        payload.push({ attribute_definition_id: definition.id, value: explicit })
        continue
      }
      if (definition.data_type === 'boolean') {
        if (definition.is_required || rng.chance(0.55))
          payload.push({ attribute_definition_id: definition.id, value: rng.chance(0.65) })
      } else if (definition.data_type === 'url' && definition.key === 'menu_url') {
        payload.push({
          attribute_definition_id: definition.id,
          value: `https://example.com/demo/${place.key}/cardapio`,
        })
      } else if (definition.data_type === 'integer' && definition.key === 'minimum_age') {
        payload.push({ attribute_definition_id: definition.id, value: 18 })
      } else if (definition.is_required && definition.data_type === 'integer') {
        payload.push({ attribute_definition_id: definition.id, value: 1 })
      }
    }
    return payload
  }

  /** The next holidays in the city calendar, as the partner would announce them. */
  private specialDays(place: DemoPlace): IEstablishment.SpecialDayPayload[] {
    const today = this.now.setZone('America/Sao_Paulo').startOf('day')
    const horizon = today.plus({ days: 100 })
    const upcoming: Array<{ date: DateTime; name: string }> = []
    for (const year of [today.year, today.year + 1])
      for (const holiday of HOLIDAYS) {
        const date = DateTime.fromObject(
          { year, month: holiday.month, day: holiday.day },
          { zone: 'America/Sao_Paulo' }
        )
        if (date > today && date <= horizon) upcoming.push({ date, name: holiday.name })
      }
    upcoming.sort((a, b) => a.date.toMillis() - b.date.toMillis())
    const days: IEstablishment.SpecialDayPayload[] = upcoming.slice(0, 2).map((holiday) => ({
      date: holiday.date.toISODate()!,
      status: 'closed' as const,
      note: `Fechado no feriado de ${holiday.name}`,
    }))
    if (EVENING_CATEGORIES.has(place.category)) {
      const eve = DateTime.fromObject(
        {
          year: today.month === 12 && today.day > 24 ? today.year + 1 : today.year,
          month: 12,
          day: 24,
        },
        { zone: 'America/Sao_Paulo' }
      )
      if (eve > today && eve <= horizon)
        days.push({
          date: eve.toISODate()!,
          status: 'custom_hours',
          note: 'Horário especial na véspera de Natal',
          intervals: [{ opens_at: '11:00', closes_at: '16:00' }],
        })
    }
    return days
  }

  private async uploadPlaceImages(
    place: DemoPlace,
    establishmentId: number,
    revisionId: number,
    owner: User
  ) {
    const images: Array<{ request: DemoImageRequest; caption: string | null }> = [
      { request: { motif: place.motif, seed: place.key, framing: 'cover' }, caption: place.short },
      ...(place.gallery ?? []).map((motif, index) => ({
        request: {
          motif,
          seed: `${place.key}|gallery|${index}`,
          framing: index % 2 === 0 ? ('detail' as const) : ('wide' as const),
        },
        caption: null,
      })),
    ]
    const events = await app.container.make(MediaEventService)
    for (const [index, image] of images.entries()) {
      const stored = await this.store(image.request, `places/${place.key}/${index}`)
      await db.transaction(async (client) => {
        const file = await StoredFile.create(
          {
            tenant_id: this.tenantId,
            owner_id: owner.id,
            client_name: `${place.key}-${index}.png`,
            file_name: stored.key,
            file_size: stored.buffer.length,
            file_type: 'image/png',
            file_category: 'image',
            url: stored.url,
          },
          { client }
        )
        const asset = await MediaAsset.create(
          {
            tenant_id: this.tenantId,
            establishment_id: establishmentId,
            file_id: file.id,
            media_type: 'image',
            file_extension: 'png',
            mime_type: 'image/png',
            checksum_sha256: stored.checksum,
            width: DEMO_IMAGE_WIDTH,
            height: DEMO_IMAGE_HEIGHT,
            created_by: owner.id,
          },
          { client }
        )
        const media = await EstablishmentRevisionMedia.create(
          {
            tenant_id: this.tenantId,
            establishment_id: establishmentId,
            revision_id: revisionId,
            media_asset_id: asset.id,
            purpose: 'gallery',
            is_cover: index === 0,
            sort_order: index,
            alt_text: this.altText(image.request.motif, place.name),
            caption: image.caption,
            moderation_status: 'pending',
            created_by: owner.id,
            reviewed_by: null,
            reviewed_at: null,
            review_notes: null,
          },
          { client }
        )
        await events.record(
          media,
          owner.id,
          null,
          'pending',
          null,
          { action: 'uploaded', source: this.options.source },
          client
        )
      })
    }
  }

  private async approvePendingMedia(revisionId: number) {
    const moderation = await app.container.make(MediaModerationService)
    const pending = await EstablishmentRevisionMedia.query()
      .where('tenant_id', this.tenantId)
      .where('revision_id', revisionId)
      .where('moderation_status', 'pending')
    for (const media of pending)
      await moderation.approve(
        media.id,
        this.options.administrator,
        'Ilustração original do catálogo de demonstração'
      )
  }

  // -------------------------------------------------------------------------
  // Benefits
  // -------------------------------------------------------------------------

  private async provisionBenefits() {
    const editions = await app.container.make(BenefitEditionService)
    const offers = await app.container.make(BenefitOfferService)
    const administrator = this.options.administrator
    const day = this.now.startOf('day')

    for (const definition of DEMO_EDITIONS) {
      const editionMarker = await this.once(`edition:${definition.slug}`, async () => {
        const city = this.cities.get(definition.city)
        if (!city) throw new DemoSkip('cidade indisponível')
        const existing = await BenefitEdition.query()
          .where('tenant_id', this.tenantId)
          .where('slug', definition.slug)
          .first()
        if (existing) {
          if (existing.created_by !== administrator.id)
            throw new DemoSkip('o endereço da edição já pertence a outra campanha')
          return { kind: 'edition', id: existing.id, adopted: true }
        }
        const edition = await editions.create(this.tenantId, administrator, {
          city_id: city.id,
          name: definition.name,
          slug: definition.slug,
          description: definition.description,
          price_cents: definition.price_cents,
          currency: 'BRL',
          sales_starts_at: day.minus({ days: 1 }).toISO()!,
          sales_ends_at: day.plus({ days: 120 }).toISO()!,
          usage_starts_at: day.minus({ days: 1 }).toISO()!,
          usage_ends_at: day.plus({ days: 300 }).toISO()!,
        })
        return { kind: 'edition', id: edition.id }
      })
      if (!editionMarker?.id) continue
      const editionId = editionMarker.id

      for (const offer of definition.offers) {
        await this.once(`offer:${definition.slug}:${offer.place}`, async () => {
          const establishment = this.places.get(offer.place)
          const place = DEMO_PLACES.find((item) => item.key === offer.place)!
          const owner = this.ownerOf(place)
          if (!establishment || !owner)
            throw new DemoSkip('estabelecimento ou responsável indisponível')
          const existing = await BenefitOffer.query()
            .where('tenant_id', this.tenantId)
            .where('edition_id', editionId)
            .where('establishment_id', establishment.id)
            .first()
          let offerId = existing?.id
          if (existing && existing.created_by !== owner.id)
            throw new DemoSkip('a unidade já tem outra oferta nesta edição')
          if (!existing) {
            const created = await offers.create(this.tenantId, establishment.id, owner, {
              edition_id: editionId,
              title: offer.title,
              description: offer.description,
              benefit_type: offer.benefit_type,
              discount_percentage: offer.discount_percentage ?? null,
              discount_amount_cents: offer.discount_amount_cents ?? null,
              terms: `${offer.terms} ${DEMO_OFFER_TERMS_NOTICE}`,
              available_weekdays_mask: offer.weekdays ?? 127,
              daily_start_time: offer.daily_window?.[0] ?? null,
              daily_end_time: offer.daily_window?.[1] ?? null,
              reservation_required: offer.reservation_required ?? false,
              on_premise_only: true,
              minimum_party_size: offer.minimum_party_size ?? 1,
              max_redemptions_per_access: offer.max_redemptions_per_access ?? 1,
              standalone_price_cents: offer.standalone_price_cents ?? null,
            })
            offerId = created.id
          }
          const current = await BenefitOffer.findOrFail(offerId)
          if (current.status === 'draft') await offers.activate(this.tenantId, current.id, owner)
          return { kind: 'offer', id: current.id, adopted: Boolean(existing) }
        })
      }

      await this.once(`edition-published:${definition.slug}`, async () => {
        const edition = await BenefitEdition.findOrFail(editionId)
        if (edition.status !== 'draft') return { kind: 'edition', id: edition.id, adopted: true }
        await editions.publish(this.tenantId, edition.id, administrator)
        return { kind: 'edition', id: edition.id }
      })
    }
  }

  // -------------------------------------------------------------------------
  // Partner content
  // -------------------------------------------------------------------------

  private async provisionContent() {
    const content = await app.container.make(PartnerContentService)
    const policies = new PartnerContentPolicyRepository()
    const policy = await policies.getForTenant(this.tenantId)
    const repository = new PartnerContentRepository()

    const publish = async (
      kind: IPartnerContent.ContentKind,
      owner: User,
      payload: IPartnerContent.CreatePayload
    ) => {
      const created = await content.create(kind, this.tenantId, owner, payload)
      const submitted = await content.submit(kind, this.tenantId, created.id, owner)
      if (submitted.status === 'pending_review' && policies.requiresApproval(policy, kind)) {
        // An item an automatic rule held stays where the rule put it (ADR-0031).
        const held = await ContentReport.query()
          .where('tenant_id', this.tenantId)
          .where('target_type', kind)
          .where('target_id', created.id)
          .where('origin', 'automatic')
          .where('holds_content', true)
          .whereIn('status', ['pending', 'under_review'])
          .first()
        if (!held)
          await content.approve(kind, this.tenantId, created.id, this.options.administrator)
      }
      return created.id
    }

    for (const item of DEMO_EXPERIENCES) {
      await this.once(`experience:${item.key}`, async () => {
        const { establishment, owner } = this.publishedPlace(item.place)
        const title = item.title
        const adopted = await repository
          .model('experience')
          .query()
          .where('tenant_id', this.tenantId)
          .where('establishment_id', establishment.id)
          .where('title', title)
          .first()
        const id =
          adopted?.id ??
          (await publish('experience', owner, {
            establishment_id: establishment.id,
            title,
            description: `${item.description} ${DEMO_CONTENT_NOTICE}`,
          }))
        await this.attachContentCover(
          'experience',
          id,
          establishment.id,
          owner,
          title,
          {
            motif: item.motif,
            seed: `experience|${item.key}`,
            framing: item.framing ?? 'cover',
          },
          `experiences/${item.key}`
        )
        return { kind: 'experience', id, adopted: Boolean(adopted) }
      })
    }

    for (const item of DEMO_SHOWCASE_ITEMS) {
      await this.once(`showcase:${item.key}`, async () => {
        const { establishment, owner } = this.publishedPlace(item.place)
        const adopted = await repository
          .model('showcase_item')
          .query()
          .where('tenant_id', this.tenantId)
          .where('establishment_id', establishment.id)
          .where('title', item.title)
          .first()
        const id =
          adopted?.id ??
          (await publish('showcase_item', owner, {
            establishment_id: establishment.id,
            title: item.title,
            description: `${item.description} ${DEMO_CONTENT_NOTICE}`,
            informational_price_cents: item.price_cents,
          }))
        if (item.motif)
          await this.attachContentCover(
            'showcase_item',
            id,
            establishment.id,
            owner,
            item.title,
            {
              motif: item.motif,
              seed: `showcase|${item.key}`,
              framing: 'detail',
            },
            `showcase/${item.key}`
          )
        return { kind: 'showcase_item', id, adopted: Boolean(adopted) }
      })
    }

    for (const event of DEMO_EVENTS) {
      const place = this.places.get(event.place)
      const city = this.cities.get(demoCityOf(event.place))
      if (!place || !city) continue
      for (const occurrence of this.occurrences(
        event,
        city.timezone,
        policy.min_event_notice_minutes
      )) {
        if (!occurrence.window) {
          this.outcome.notCreated.push({
            key: `event:${event.key}:today`,
            reason:
              'a antecedência mínima da operação empurra o início para depois da meia-noite local',
          })
          continue
        }
        const window = occurrence.window
        await this.once(`event:${event.key}:${window.localDate}`, async () => {
          const { establishment, owner } = this.publishedPlace(event.place)
          const adopted = await repository
            .model('event')
            .query()
            .where('tenant_id', this.tenantId)
            .where('establishment_id', establishment.id)
            .where('title', event.title)
            .where('starts_at', '>=', window.dayStart)
            .where('starts_at', '<', window.dayEnd)
            .first()
          const id =
            adopted?.id ??
            (await publish('event', owner, {
              establishment_id: establishment.id,
              title: event.title,
              description: `${event.description} ${DEMO_CONTENT_NOTICE}`,
              starts_at: window.startsAt,
              ends_at: window.endsAt,
            }))
          await this.attachContentCover(
            'event',
            id,
            establishment.id,
            owner,
            event.title,
            {
              motif: event.motif,
              seed: `event|${event.key}`,
              framing: 'wide',
            },
            `events/${event.key}/${window.localDate}`
          )
          return { kind: 'event', id, adopted: Boolean(adopted) }
        })
      }
    }
  }

  /** Occurrences of an event in the city calendar, relative to the run. */
  private occurrences(event: DemoEvent, timezone: string, noticeMinutes: number) {
    const day = cityDayWindow(this.now, timezone)
    const zone = day.timezone
    const localToday = this.now.setZone(zone).startOf('day')
    const windowOf = (start: DateTime) => {
      const local = start.setZone(zone)
      const dayStart = local.startOf('day')
      return {
        startsAt: start.toUTC().toISO()!,
        endsAt: start
          .plus({ minutes: Math.round(event.duration_hours * 60) })
          .toUTC()
          .toISO()!,
        localDate: local.toISODate()!,
        dayStart: dayStart.toUTC().toJSDate(),
        dayEnd: dayStart.plus({ days: 1 }).toUTC().toJSDate(),
      }
    }

    if (event.schedule.kind === 'today') {
      let start = localToday.set({ hour: event.schedule.hour })
      const earliest = this.now.plus({ minutes: noticeMinutes > 0 ? noticeMinutes + 15 : 0 })
      if (start < earliest)
        start =
          noticeMinutes > 0
            ? earliest.startOf('minute')
            : this.now.minus({ hours: 1 }).startOf('minute')
      if (start >= DateTime.fromISO(day.day_end)) return [{ window: null }]
      return [{ window: windowOf(start) }]
    }

    const schedule = event.schedule
    let first = localToday.plus({ days: 1 })
    while (first.weekday !== schedule.weekday) first = first.plus({ days: 1 })
    return schedule.weeks.map((week) => ({
      window: windowOf(
        first.plus({ weeks: week }).set({ hour: schedule.hour, minute: schedule.minute ?? 0 })
      ),
    }))
  }

  /**
   * An approved image for a content item: uploaded as pending by the partner,
   * approved by the administrator through content-media moderation. Each item
   * has its own object and asset — removing one item's media deletes its file,
   * so a shared object would let a moderator take down another item's image.
   */
  private async attachContentCover(
    kind: IPartnerContent.ContentKind,
    contentId: number,
    establishmentId: number,
    owner: User,
    title: string,
    request: DemoImageRequest,
    scope: string
  ) {
    const existing = await PartnerContentMedia.query()
      .where('tenant_id', this.tenantId)
      .where(
        kind === 'experience'
          ? 'experience_id'
          : kind === 'event'
            ? 'event_id'
            : 'showcase_item_id',
        contentId
      )
      .first()
    if (existing) return

    const stored = await this.store(request, scope)
    const row = await db.transaction(async (client) => {
      const file = await StoredFile.create(
        {
          tenant_id: this.tenantId,
          owner_id: owner.id,
          client_name: `${scope.replaceAll('/', '-')}.png`,
          file_name: stored.key,
          file_size: stored.buffer.length,
          file_type: 'image/png',
          file_category: 'image',
          url: stored.url,
        },
        { client }
      )
      const asset = await MediaAsset.create(
        {
          tenant_id: this.tenantId,
          establishment_id: establishmentId,
          file_id: file.id,
          media_type: 'image',
          file_extension: 'png',
          mime_type: 'image/png',
          checksum_sha256: stored.checksum,
          width: DEMO_IMAGE_WIDTH,
          height: DEMO_IMAGE_HEIGHT,
          created_by: owner.id,
        },
        { client }
      )
      return PartnerContentMedia.create(
        {
          tenant_id: this.tenantId,
          establishment_id: establishmentId,
          experience_id: kind === 'experience' ? contentId : null,
          event_id: kind === 'event' ? contentId : null,
          showcase_item_id: kind === 'showcase_item' ? contentId : null,
          media_asset_id: asset.id,
          is_cover: true,
          sort_order: 0,
          alt_text: this.altText(request.motif, title),
          caption: null,
          moderation_status: 'pending',
          created_by: owner.id,
          reviewed_by: null,
          reviewed_at: null,
          review_notes: null,
        },
        { client }
      )
    })
    const moderation = await app.container.make(PartnerContentMediaService)
    await moderation.approve(
      { kind, tenantId: this.tenantId, contentId, actor: this.options.administrator },
      row.id,
      'Ilustração original do catálogo de demonstração'
    )
  }

  // -------------------------------------------------------------------------
  // Reviews
  // -------------------------------------------------------------------------

  private async provisionReviews() {
    const reviews = await app.container.make(EstablishmentReviewService)
    const replies = await app.container.make(EstablishmentReviewReplyService)
    const policy = await new ReviewPolicyRepository().getForTenant(this.tenantId)

    for (const place of DEMO_PLACES) {
      for (const plan of demoReviewPlan(place)) {
        await this.once(plan.key, async () => {
          const { establishment, owner } = this.publishedPlace(place.key)
          const consumer = this.users.get(plan.consumer.key)
          if (!consumer) throw new DemoSkip('conta de quem avalia indisponível')

          const existing = await EstablishmentReview.query()
            .where('tenant_id', this.tenantId)
            .where('establishment_id', establishment.id)
            .where('user_id', consumer.id)
            .first()
          const review =
            existing ??
            (await reviews.create(this.tenantId, consumer, {
              establishment_id: establishment.id,
              rating: plan.rating,
              comment: plan.comment,
            }))
          const writtenAt = this.now.minus({ days: plan.days_ago, hours: plan.days_ago % 9 })

          if (!existing && plan.photo && policy.max_photos > 0)
            await this.attachReviewPhoto(review, consumer, plan.photo, place.name, plan.key)
          if (!existing)
            await EstablishmentReview.query()
              .where('id', review.id)
              .update({ created_at: writtenAt.toJSDate(), updated_at: writtenAt.toJSDate() })

          if (plan.reply && review.status === 'published') {
            const replied = await EstablishmentReviewReply.query()
              .where('tenant_id', this.tenantId)
              .where('review_id', review.id)
              .first()
            if (!replied) {
              const reply = await replies.reply(this.tenantId, review.id, owner, {
                comment: plan.reply,
              })
              const answeredAt = DateTime.min(
                writtenAt.plus({ days: 1 + (plan.days_ago % 3), hours: 3 }),
                this.now.minus({ hours: 1 })
              )
              await EstablishmentReviewReply.query()
                .where('id', reply.id)
                .update({ created_at: answeredAt.toJSDate(), updated_at: answeredAt.toJSDate() })
            }
          }
          return { kind: 'review', id: review.id, adopted: Boolean(existing) }
        })
      }
    }
  }

  /** A photo on a demo review, stored exactly as the review-photo pipeline stores one. */
  private async attachReviewPhoto(
    review: EstablishmentReview,
    author: User,
    motif: DemoMotif,
    placeName: string,
    key: string
  ) {
    const stored = await this.store(
      { motif, seed: `review|${key}`, framing: 'detail' },
      `reviews/${key.replaceAll(':', '-')}`
    )
    await db.transaction(async (client) => {
      const file = await StoredFile.create(
        {
          tenant_id: this.tenantId,
          owner_id: author.id,
          client_name: 'foto.png',
          file_name: stored.key,
          file_size: stored.buffer.length,
          file_type: 'image/png',
          file_category: 'image',
          url: stored.url,
        },
        { client }
      )
      const asset = await MediaAsset.create(
        {
          tenant_id: this.tenantId,
          establishment_id: review.establishment_id,
          file_id: file.id,
          media_type: 'image',
          file_extension: 'png',
          mime_type: 'image/png',
          checksum_sha256: stored.checksum,
          width: DEMO_IMAGE_WIDTH,
          height: DEMO_IMAGE_HEIGHT,
          created_by: author.id,
        },
        { client }
      )
      await EstablishmentReviewPhoto.create(
        {
          tenant_id: this.tenantId,
          establishment_id: review.establishment_id,
          review_id: review.id,
          media_asset_id: asset.id,
          sort_order: 0,
          alt_text: this.altText(motif, placeName),
        },
        { client }
      )
      await EstablishmentReview.query({ client }).where('id', review.id).update({ photos_count: 1 })
    })
  }

  // -------------------------------------------------------------------------
  // Helpers
  // -------------------------------------------------------------------------

  private publishedPlace(key: string) {
    const establishment = this.places.get(key)
    const place = DEMO_PLACES.find((item) => item.key === key)!
    const owner = this.ownerOf(place)
    if (!establishment || !owner) throw new DemoSkip('estabelecimento ou responsável indisponível')
    if (!establishment.published_revision_id || establishment.lifecycle_status !== 'active')
      throw new DemoSkip('o estabelecimento não está publicado')
    return { establishment, owner }
  }

  private ownerOf(place: DemoPlace): User | undefined {
    const organization = DEMO_ORGANIZATIONS.find((item) => item.key === place.organization)
    return organization ? this.users.get(organization.owner) : undefined
  }

  private emailFor(person: DemoPerson) {
    return `${person.email_local}.demo@${this.options.emailDomain}`.toLowerCase()
  }

  private altText(motif: DemoMotif, name: string) {
    return `Ilustração original: ${DEMO_MOTIF_ALT[motif]}. ${name} é fictício.`.slice(0, 180)
  }

  private async store(request: DemoImageRequest, scope: string) {
    const buffer = demoIllustration(request)
    const checksum = createHash('sha256').update(buffer).digest('hex')
    const key = `${this.options.storagePrefix}/${scope}/${checksum}.png`
    try {
      const disk = drive.use()
      await disk.put(key, buffer, { contentType: 'image/png' })
      return { buffer, checksum, key, url: await disk.getUrl(key) }
    } catch {
      // Cloud SDK errors may carry signed headers; never print credentials or raw responses.
      throw new Error('Demo illustration storage failed')
    }
  }

  private async recordedMarkers(): Promise<Map<string, Marker>> {
    const rows = await AuditLog.query()
      .where('resource', 'tenants')
      .where('resource_id', this.tenantId)
      .where('action', this.options.markerAction)
    const markers = new Map<string, Marker>()
    for (const row of rows) {
      const metadata = row.metadata as { key?: unknown; id?: unknown; adopted?: unknown } | null
      if (typeof metadata?.key !== 'string') continue
      markers.set(metadata.key, {
        id: typeof metadata.id === 'number' ? metadata.id : null,
        adopted: metadata.adopted === true,
      })
    }
    return markers
  }

  /**
   * Runs a step at most once per key and records it. A domain refusal is
   * reported and the run goes on; anything else is not a refusal and stops it.
   */
  private async once(key: string, step: () => Promise<StepResult>): Promise<Marker | null> {
    const recorded = this.markers.get(key)
    if (recorded) {
      this.outcome.alreadyPresent.push(key)
      return recorded
    }
    try {
      const result = await step()
      const marker = { id: result.id, adopted: result.adopted === true }
      await AuditLog.create({
        user_id: this.options.administrator.id,
        resource: 'tenants',
        resource_id: this.tenantId,
        action: this.options.markerAction,
        context: 'console',
        result: 'granted',
        reason: 'Conteúdo fictício do catálogo de demonstração',
        metadata: { key, kind: result.kind, id: result.id, adopted: marker.adopted },
      })
      this.markers.set(key, marker)
      if (marker.adopted) this.outcome.alreadyPresent.push(key)
      else this.outcome.created.push(key)
      return marker
    } catch (error) {
      if (error instanceof DemoSkip) {
        this.outcome.notCreated.push({ key, reason: error.message })
        return null
      }
      if (error instanceof BaseException && (error.status ?? 500) < 500) {
        this.outcome.notCreated.push({ key, reason: error.message })
        return null
      }
      throw error
    }
  }
}

function demoCityOf(placeKey: string): string {
  return DEMO_PLACES.find((place) => place.key === placeKey)!.city
}
