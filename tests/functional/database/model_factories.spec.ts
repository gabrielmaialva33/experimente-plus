import { readdir } from 'node:fs/promises'

import { test } from '@japa/runner'
import app from '@adonisjs/core/services/app'
import testUtils from '@adonisjs/core/services/test_utils'
import { BaseModel } from '@adonisjs/lucid/orm'
import type { LucidModel } from '@adonisjs/lucid/types/model'
import { DateTime } from 'luxon'

import * as factories from '#database/factories/index'
import {
  AnalyticsDailyMetricFactory,
  AnalyticsDailySearchTermFactory,
  AnalyticsEventFactory,
  AuditLogFactory,
  AutomaticModerationPolicyFactory,
  CategoryAttributeDefinitionFactory,
  CategoryAttributeOptionFactory,
  CategoryFactory,
  CategoryFamilyFactory,
  CityFactory,
  ConciergePolicyFactory,
  ContentReportFactory,
  EstablishmentEventFactory,
  EstablishmentExperienceFactory,
  EstablishmentFactory,
  EstablishmentReviewFactory,
  EstablishmentReviewPhotoFactory,
  EstablishmentReviewReplyFactory,
  EstablishmentRevisionAttributeValueFactory,
  EstablishmentRevisionAttributeValueOptionFactory,
  EstablishmentRevisionEventFactory,
  EstablishmentRevisionFactory,
  EstablishmentRevisionMediaFactory,
  EstablishmentRevisionReviewIssueFactory,
  EstablishmentRevisionSpecialDayFactory,
  EstablishmentRevisionSpecialHourFactory,
  ExplorerFavoriteFactory,
  ExplorerFollowFactory,
  ExplorerInterestFactory,
  ExplorerItineraryFactory,
  ExplorerItineraryItemFactory,
  MediaAssetFactory,
  MediaModerationEventFactory,
  OrganizationClaimFactory,
  OrganizationFactory,
  OrganizationInvitationFactory,
  OrganizationMemberFactory,
  PartnerContentMediaFactory,
  PartnerContentPolicyFactory,
  PasswordResetTokenFactory,
  PermissionFactory,
  PilotFeedbackFactory,
  RefreshTokenFactory,
  RegionFactory,
  ReviewPolicyFactory,
  RoleFactory,
  StoredFileFactory,
  TenantFactory,
  UserFactory,
} from '#database/factories/index'
import IRole from '#modules/roles/interfaces/role_interface'

const HEX_DIGEST = /^[0-9a-f]{64}$/

/** Every class under `app/modules/<domain>/models/` that is a Lucid model. */
async function lucidModels() {
  const models: Array<{ file: string; model: LucidModel }> = []
  for (const domain of await readdir(app.makePath('app/modules'))) {
    const directory = app.makePath('app/modules', domain, 'models')
    const files = await readdir(directory).catch(() => [] as string[])
    for (const file of files.filter((name) => name.endsWith('.ts'))) {
      // The same specifier the factories use, so the class identity is shared.
      const module = await import(`#modules/${domain}/models/${file.replace(/\.ts$/, '')}`)
      const candidate = module.default
      if (typeof candidate === 'function' && candidate.prototype instanceof BaseModel) {
        models.push({ file: `app/modules/${domain}/models/${file}`, model: candidate })
      }
    }
  }
  return models
}

/**
 * The smallest coherent operation the factories hang from: a tenant with
 * three members, geography, taxonomy, an active organization owned by the
 * partner, and one establishment with a draft revision.
 */
async function operation() {
  const tenant = await TenantFactory.create()
  const [partner, consumer, moderator] = await UserFactory.createMany(3)
  for (const user of [partner, consumer, moderator]) {
    await user.related('tenants').attach({ [tenant.id]: { role: 'member' } })
  }
  const region = await RegionFactory.merge({ tenant_id: tenant.id }).create()
  const city = await CityFactory.apply('londrina')
    .merge({ tenant_id: tenant.id, region_id: region.id })
    .create()
  const family = await CategoryFamilyFactory.merge({ tenant_id: tenant.id }).create()
  const category = await CategoryFactory.merge({
    tenant_id: tenant.id,
    family_id: family.id,
  }).create()
  const organization = await OrganizationFactory.apply('active')
    .merge({ tenant_id: tenant.id, created_by: partner.id })
    .create()
  await OrganizationMemberFactory.apply('owner')
    .merge({ tenant_id: tenant.id, organization_id: organization.id, user_id: partner.id })
    .create()
  const establishment = await EstablishmentFactory.merge({
    tenant_id: tenant.id,
    organization_id: organization.id,
    created_by: partner.id,
  }).create()
  const revision = await EstablishmentRevisionFactory.merge({
    tenant_id: tenant.id,
    establishment_id: establishment.id,
    city_id: city.id,
    created_by: partner.id,
  }).create()

  const scope = { tenant_id: tenant.id }
  const unit = { ...scope, establishment_id: establishment.id }
  return {
    tenant,
    users: { partner, consumer, moderator },
    city,
    category,
    organization,
    establishment,
    revision,
    scope,
    unit,
  }
}

type Operation = Awaited<ReturnType<typeof operation>>

/** A stored image of the establishment, one file per asset as the table requires. */
async function asset({ unit, users }: Operation) {
  const file = await StoredFileFactory.merge({
    tenant_id: unit.tenant_id,
    owner_id: users.partner.id,
  }).create()
  return MediaAssetFactory.merge({
    ...unit,
    file_id: file.id,
    created_by: users.partner.id,
  }).create()
}

test.group('Model factories', (group) => {
  group.each.setup(() => testUtils.db().withGlobalTransaction())

  test('every Lucid model under app/modules has a factory', async ({ assert }) => {
    const models = await lucidModels()
    const covered = new Set<unknown>(Object.values(factories).map((built) => built.factory.model))
    const missing = models
      .filter(({ model }) => !covered.has(model))
      .map(({ model, file }) => `${model.name} (${file})`)

    assert.isAbove(models.length, 0)
    assert.deepEqual(
      missing,
      [],
      `Add a factory to database/factories and export it from index.ts for: ${missing.join(', ')}`
    )
  })

  test('roles, permissions, audit logs and stored credentials', async ({ assert }) => {
    const { users, tenant } = await operation()

    const roles = await RoleFactory.with('permissions', 2).createMany(2)
    for (const role of roles) {
      assert.isFalse(IRole.isCanonicalSlug(role.slug))
      assert.lengthOf(role.permissions, 2)
    }
    assert.notEqual(roles[0].slug, roles[1].slug)

    const permissions = await PermissionFactory.createMany(2)
    const own = await PermissionFactory.apply('own').create()
    const team = await PermissionFactory.apply('team').create()
    assert.equal(permissions[0].name, `${permissions[0].resource}.${permissions[0].action}`)
    assert.equal(own.name, `${own.resource}.${own.action}.own`)
    assert.equal(team.context, 'team')

    const granted = await AuditLogFactory.merge({ user_id: users.moderator.id }).create()
    const denied = await AuditLogFactory.apply('denied').create()
    const anonymous = await AuditLogFactory.apply('unauthenticated').create()
    assert.equal(granted.result, 'granted')
    assert.equal(denied.response_code, 403)
    assert.isNull(anonymous.user_id)

    const refresh = await RefreshTokenFactory.merge({ user_id: users.consumer.id }).createMany(2)
    const revoked = await RefreshTokenFactory.apply('revoked')
      .merge({ user_id: users.consumer.id, tenant_id: tenant.id })
      .create()
    const expired = await RefreshTokenFactory.apply('expired')
      .merge({ user_id: users.consumer.id })
      .create()
    const resets = await PasswordResetTokenFactory.merge({ user_id: users.consumer.id }).createMany(
      2
    )
    const consumed = await PasswordResetTokenFactory.apply('consumed')
      .merge({ user_id: users.consumer.id })
      .create()
    const lapsed = await PasswordResetTokenFactory.apply('expired')
      .merge({ user_id: users.consumer.id })
      .create()

    const hashes = [...refresh, revoked, expired, ...resets, consumed, lapsed].map(
      (token) => token.token_hash
    )
    for (const hash of hashes) assert.match(hash, HEX_DIGEST)
    assert.lengthOf(new Set(hashes), hashes.length)
    assert.isNotNull(revoked.revoked_at)
    assert.isBelow(expired.expires_at.toMillis(), Date.now())
    assert.isNotNull(consumed.consumed_at)
    assert.isBelow(lapsed.expires_at.toMillis(), Date.now())
  })

  test('organization claims and invitations stay inside their organization', async ({ assert }) => {
    const { users, organization, scope } = await operation()
    const inOrganization = { ...scope, organization_id: organization.id }

    const [outsiderA, outsiderB, outsiderC] = await UserFactory.createMany(3)
    const pending = await OrganizationClaimFactory.merge({
      ...inOrganization,
      claimant_id: users.consumer.id,
    }).create()
    const approved = await OrganizationClaimFactory.apply('approved')
      .merge({ ...inOrganization, claimant_id: outsiderA.id, reviewed_by: users.moderator.id })
      .create()
    await OrganizationClaimFactory.apply('rejected')
      .merge({ ...inOrganization, claimant_id: outsiderB.id, reviewed_by: users.moderator.id })
      .create()
    await OrganizationClaimFactory.apply('cancelled')
      .merge({ ...inOrganization, claimant_id: outsiderC.id })
      .create()
    assert.equal(pending.status, 'pending')
    assert.equal(approved.reviewed_by, users.moderator.id)

    const invited = { ...inOrganization, invited_by: users.partner.id }
    const invitations = await OrganizationInvitationFactory.merge(invited).createMany(2)
    const accepted = await OrganizationInvitationFactory.apply('accepted')
      .merge({ ...invited, accepted_by: users.consumer.id })
      .create()
    const revoked = await OrganizationInvitationFactory.apply('revoked', 'admin')
      .merge(invited)
      .create()
    const expired = await OrganizationInvitationFactory.apply('expired', 'analyst')
      .merge(invited)
      .create()
    const owner = await OrganizationInvitationFactory.apply('owner').merge(invited).create()

    for (const invitation of [...invitations, accepted, revoked, expired, owner]) {
      assert.equal(invitation.email, invitation.email.toLowerCase())
      assert.match(invitation.token_hash, HEX_DIGEST)
    }
    assert.notEqual(invitations[0].email, invitations[1].email)
    assert.equal(revoked.revoked_by, users.partner.id)
    assert.equal(revoked.role, 'admin')
    assert.isBelow(expired.expires_at.toMillis(), Date.now())
  })

  test('revision children, history and review issues follow their revision', async ({ assert }) => {
    const { users, category, revision, scope, unit } = await operation()
    const inRevision = { ...scope, revision_id: revision.id }

    const definitions = await CategoryAttributeDefinitionFactory.merge({
      ...scope,
      category_id: category.id,
    }).createMany(5)
    const selectDefinition = await CategoryAttributeDefinitionFactory.apply('singleSelect')
      .merge({ ...scope, category_id: category.id })
      .create()
    const option = await CategoryAttributeOptionFactory.merge({
      ...scope,
      attribute_definition_id: selectDefinition.id,
    }).create()

    const states = [undefined, 'text', 'integer', 'decimal', 'url'] as const
    for (const [index, state] of states.entries()) {
      const builder = EstablishmentRevisionAttributeValueFactory.merge({
        ...inRevision,
        attribute_definition_id: definitions[index].id,
      })
      await (state ? builder.apply(state) : builder).create()
    }
    const selection = await EstablishmentRevisionAttributeValueFactory.apply('selection')
      .merge({ ...inRevision, attribute_definition_id: selectDefinition.id })
      .with('selected_options', 1, (choice) => choice.merge({ attribute_option_id: option.id }))
      .create()
    assert.equal(selection.selected_options[0].tenant_id, scope.tenant_id)
    assert.equal(selection.selected_options[0].attribute_definition_id, selectDefinition.id)
    const secondOption = await CategoryAttributeOptionFactory.merge({
      ...scope,
      attribute_definition_id: selectDefinition.id,
    }).create()
    await EstablishmentRevisionAttributeValueOptionFactory.merge({
      ...scope,
      attribute_value_id: selection.id,
      attribute_definition_id: selectDefinition.id,
      attribute_option_id: secondOption.id,
    }).create()

    const specialDay = await EstablishmentRevisionSpecialDayFactory.apply('customHours')
      .merge(inRevision)
      .with('intervals', 2, (interval) =>
        interval.merge([{}, { opens_at: '18:00', closes_at: '23:00', sort_order: 1 }])
      )
      .create()
    for (const interval of specialDay.intervals) {
      assert.equal(interval.tenant_id, scope.tenant_id)
      assert.equal(interval.revision_id, revision.id)
    }
    const otherDay = await EstablishmentRevisionSpecialDayFactory.apply('customHours')
      .merge({ ...inRevision, date: DateTime.utc().plus({ days: 45 }).toISODate()! })
      .create()
    await EstablishmentRevisionSpecialHourFactory.apply('overnight')
      .merge({ ...inRevision, special_day_id: otherDay.id })
      .create()
    await EstablishmentRevisionSpecialHourFactory.apply('evening')
      .merge({ ...inRevision, special_day_id: otherDay.id })
      .create()

    const history = { ...unit, revision_id: revision.id, actor_id: users.partner.id }
    const eventStates = [
      'submitted',
      'changesRequested',
      'resubmitted',
      'rejected',
      'approved',
      'published',
    ] as const
    await EstablishmentRevisionEventFactory.merge(history).create()
    for (const state of eventStates) {
      await EstablishmentRevisionEventFactory.apply(state)
        .merge({ ...history, actor_id: users.moderator.id })
        .create()
    }

    const issueScope = { ...unit, revision_id: revision.id, created_by: users.moderator.id }
    const blocking = await EstablishmentRevisionReviewIssueFactory.merge(issueScope).create()
    const warning = await EstablishmentRevisionReviewIssueFactory.apply('warning')
      .merge(issueScope)
      .create()
    const resolved = await EstablishmentRevisionReviewIssueFactory.apply('resolved')
      .merge(issueScope)
      .create()
    assert.equal(blocking.severity, 'blocking')
    assert.equal(warning.severity, 'warning')
    assert.equal(resolved.resolved_by, users.moderator.id)
  })

  test('media moderation history follows the revision media', async ({ assert }) => {
    const chain = await operation()
    const { users, revision, unit } = chain
    const image = await asset(chain)
    const media = await EstablishmentRevisionMediaFactory.merge({
      ...unit,
      revision_id: revision.id,
      media_asset_id: image.id,
      created_by: users.partner.id,
    }).create()
    const trail = {
      ...unit,
      revision_id: revision.id,
      media_asset_id: media.media_asset_id,
      revision_media_id: media.id,
      actor_id: users.moderator.id,
    }

    const uploaded = await MediaModerationEventFactory.merge({
      ...trail,
      actor_id: users.partner.id,
    }).create()
    for (const state of ['approved', 'rejected', 'quarantined', 'removed'] as const) {
      await MediaModerationEventFactory.apply(state).merge(trail).create()
    }
    assert.isNull(uploaded.from_status)
    assert.equal(uploaded.to_status, 'pending')
  })

  test('explorer rows belong to a member and a place of the same operation', async ({ assert }) => {
    const { users, category, organization, establishment, scope } = await operation()
    const second = await EstablishmentFactory.merge({
      ...scope,
      organization_id: organization.id,
    }).create()
    const mine = { ...scope, user_id: users.consumer.id }

    await ExplorerFavoriteFactory.merge([
      { ...mine, establishment_id: establishment.id },
      { ...mine, establishment_id: second.id },
    ]).createMany(2)
    await ExplorerFollowFactory.merge({ ...mine, establishment_id: establishment.id }).create()
    await ExplorerInterestFactory.merge({ ...mine, category_id: category.id }).create()

    const itinerary = await ExplorerItineraryFactory.merge(mine)
      .with('items', 3, (stop) => stop.merge({ establishment_id: establishment.id }))
      .create()
    assert.deepEqual(
      itinerary.items.map((stop) => stop.position),
      [0, 1, 2]
    )
    for (const stop of itinerary.items) assert.equal(stop.tenant_id, scope.tenant_id)

    const appended = await ExplorerItineraryItemFactory.merge({
      ...scope,
      itinerary_id: itinerary.id,
      establishment_id: second.id,
    }).create()
    assert.equal(appended.position, 3)
  })

  test('partner content media and policies', async ({ assert }) => {
    const chain = await operation()
    const { users, unit } = chain
    const authored = { ...unit, created_by: users.partner.id }
    const experience = await EstablishmentExperienceFactory.merge(authored).create()
    const event = await EstablishmentEventFactory.merge(authored).create()

    const [first, second, third, fourth] = [
      await asset(chain),
      await asset(chain),
      await asset(chain),
      await asset(chain),
    ]
    const gallery = await PartnerContentMediaFactory.merge([
      { ...authored, experience_id: experience.id, media_asset_id: first.id },
      { ...authored, experience_id: experience.id, media_asset_id: second.id },
    ]).createMany(2)
    assert.deepEqual(
      gallery.map((media) => media.sort_order),
      [0, 1]
    )
    const onEvent = { ...authored, experience_id: null, event_id: event.id }
    const cover = await PartnerContentMediaFactory.apply('cover', 'approved')
      .merge({ ...onEvent, media_asset_id: third.id, reviewed_by: users.moderator.id })
      .create()
    await PartnerContentMediaFactory.apply('rejected')
      .merge({ ...onEvent, media_asset_id: fourth.id })
      .create()
    assert.equal(cover.sort_order, 0)
    assert.isTrue(cover.is_cover)

    const [open, strict, notice] = await TenantFactory.createMany(3)
    const defaults = await PartnerContentPolicyFactory.merge({ tenant_id: open.id }).create()
    const approval = await PartnerContentPolicyFactory.apply('approvalRequired')
      .merge({ tenant_id: strict.id })
      .create()
    const advance = await PartnerContentPolicyFactory.apply('eventNotice', 'noApproval')
      .merge({ tenant_id: notice.id })
      .create()
    assert.isTrue(defaults.require_event_approval)
    assert.equal(defaults.max_media_per_content, 6)
    assert.isTrue(approval.require_showcase_item_approval)
    assert.equal(advance.min_event_notice_minutes, 1440)
  })

  test('review photos, reports and review policies', async ({ assert }) => {
    const chain = await operation()
    const { users, establishment, unit } = chain
    const review = await EstablishmentReviewFactory.merge({
      ...unit,
      user_id: users.consumer.id,
    }).create()
    const reply = await EstablishmentReviewReplyFactory.merge({
      tenant_id: unit.tenant_id,
      review_id: review.id,
      organization_id: chain.organization.id,
      user_id: users.partner.id,
    }).create()

    const [front, dish] = [await asset(chain), await asset(chain)]
    const photos = await EstablishmentReviewPhotoFactory.merge([
      { ...unit, review_id: review.id, media_asset_id: front.id },
      { ...unit, review_id: review.id, media_asset_id: dish.id },
    ]).createMany(2)
    assert.deepEqual(
      photos.map((photo) => photo.sort_order),
      [0, 1]
    )
    await review.refresh()
    assert.equal(review.photos_count, 2)

    const reporters = await UserFactory.createMany(4)
    for (const reporter of reporters) {
      await reporter.related('tenants').attach({ [unit.tenant_id]: { role: 'member' } })
    }
    const onReview = {
      tenant_id: unit.tenant_id,
      target_type: 'review' as const,
      target_id: review.id,
    }
    const reports = await ContentReportFactory.merge([
      { ...onReview, reporter_id: reporters[0].id },
      { ...onReview, reporter_id: reporters[1].id },
    ]).createMany(2)
    await ContentReportFactory.apply('underReview')
      .merge({ ...onReview, reporter_id: reporters[2].id, assigned_to: users.moderator.id })
      .create()
    const resolved = await ContentReportFactory.apply('resolved')
      .merge({ ...onReview, reporter_id: reporters[3].id, resolved_by: users.moderator.id })
      .create()
    await ContentReportFactory.apply('dismissed', 'overdue')
      .merge({
        tenant_id: unit.tenant_id,
        target_type: 'establishment',
        target_id: establishment.id,
        reporter_id: users.consumer.id,
        resolved_by: users.moderator.id,
      })
      .create()
    const anonymous = await ContentReportFactory.apply('anonymous').merge(onReview).createMany(2)
    const automatic = await ContentReportFactory.apply('automatic').merge(onReview).create()
    const held = await ContentReportFactory.apply('held')
      .merge({ tenant_id: unit.tenant_id, target_type: 'reply', target_id: reply.id })
      .create()

    const protocols = [...reports, resolved, ...anonymous, automatic, held].map(
      (report) => report.protocol_number
    )
    assert.lengthOf(new Set(protocols), protocols.length)
    for (const report of anonymous) {
      assert.isNull(report.reporter_id)
      assert.match(report.reporter_token_hash!, HEX_DIGEST)
    }
    assert.isNull(automatic.reporter_id)
    assert.isTrue(held.holds_content)

    const tenants = await TenantFactory.createMany(4)
    const policy = await ReviewPolicyFactory.merge({ tenant_id: tenants[0].id }).create()
    const proof = await ReviewPolicyFactory.apply('visitProof')
      .merge({ tenant_id: tenants[1].id })
      .create()
    await ReviewPolicyFactory.apply('strict').merge({ tenant_id: tenants[2].id }).create()
    assert.equal(policy.report_moderation_days, 5)
    assert.isTrue(proof.require_visit_proof)

    const moderation = await AutomaticModerationPolicyFactory.merge({
      tenant_id: tenants[0].id,
    }).create()
    await AutomaticModerationPolicyFactory.apply('off').merge({ tenant_id: tenants[1].id }).create()
    await AutomaticModerationPolicyFactory.apply('holdAll')
      .merge({ tenant_id: tenants[2].id })
      .create()
    const vocabulary = await AutomaticModerationPolicyFactory.apply('blockedTerms')
      .merge({ tenant_id: tenants[3].id })
      .create()
    assert.equal(moderation.contact_mode, 'hold')
    assert.deepEqual(vocabulary.blocked_terms, ['golpe do pix', 'pirâmide financeira'])
  })

  test('analytics rows keep the shapes the constraints demand', async ({ assert }) => {
    const { city, establishment, revision, scope } = await operation()
    const viewed = {
      ...scope,
      city_id: city.id,
      establishment_id: establishment.id,
      published_revision_id: revision.id,
    }

    const views = await AnalyticsEventFactory.merge(viewed).createMany(2)
    await AnalyticsEventFactory.apply('impression').merge(viewed).create()
    await AnalyticsEventFactory.apply('redirect').merge(viewed).create()
    const search = await AnalyticsEventFactory.apply('searchWithoutResults').merge(viewed).create()
    const expired = await AnalyticsEventFactory.apply('expired').merge(viewed).create()
    const lastWeek = DateTime.fromISO('2026-09-21T15:00:00', { zone: 'America/Sao_Paulo' })
    const dated = await AnalyticsEventFactory.merge({
      ...viewed,
      occurred_at: lastWeek.toUTC(),
    }).create()

    assert.notEqual(views[0].dedupe_key, views[1].dedupe_key)
    assert.isNull(search.establishment_id)
    assert.match(search.search_term_hash!, HEX_DIGEST)
    assert.isBelow(expired.expires_at.toMillis(), Date.now())
    assert.equal(dated.metric_date, '2026-09-21')

    const inCity = { ...scope, city_id: city.id }
    const daily = { ...inCity, establishment_id: establishment.id }
    const series = await AnalyticsDailyMetricFactory.merge([
      { ...daily, metric_date: '2026-09-20' },
      { ...daily, metric_date: '2026-09-21' },
    ]).createMany(2)
    await AnalyticsDailyMetricFactory.apply('redirect').merge(daily).create()
    await AnalyticsDailyMetricFactory.apply('expired').merge(daily).create()
    for (const metric of series) {
      assert.isAtMost(metric.unique_sessions, metric.event_count)
      assert.equal(
        metric.first_event_at.setZone('America/Sao_Paulo').toISODate(),
        metric.metric_date
      )
    }

    await AnalyticsDailySearchTermFactory.merge([
      { ...inCity, metric_date: '2026-09-20' },
      { ...inCity, metric_date: '2026-09-21' },
    ]).createMany(2)
    const categorized = await AnalyticsDailySearchTermFactory.apply('inCategory')
      .merge(inCity)
      .create()
    await AnalyticsDailySearchTermFactory.apply('expired').merge(inCity).create()
    assert.equal(categorized.category_key, categorized.category_slug)
  })

  test('concierge policies and pilot feedback', async ({ assert }) => {
    const { users, organization, establishment, scope } = await operation()

    const [enabled, disabled, strict] = await TenantFactory.createMany(3)
    const policy = await ConciergePolicyFactory.merge({ tenant_id: enabled.id }).create()
    await ConciergePolicyFactory.apply('disabled').merge({ tenant_id: disabled.id }).create()
    const tight = await ConciergePolicyFactory.apply('strict')
      .merge({ tenant_id: strict.id })
      .create()
    assert.isTrue(policy.enabled)
    assert.equal(tight.max_catalog_items, 8)

    const authored = { ...scope, user_id: users.partner.id }
    const general = await PilotFeedbackFactory.merge(authored).createMany(2)
    const reviewed = { ...authored, reviewed_by: users.moderator.id }
    await PilotFeedbackFactory.apply('inReview').merge(reviewed).create()
    await PilotFeedbackFactory.apply('resolved').merge(reviewed).create()
    await PilotFeedbackFactory.apply('dismissed').merge(reviewed).create()
    const onUnit = await PilotFeedbackFactory.merge({
      ...authored,
      context: 'establishment',
      organization_id: organization.id,
      establishment_id: establishment.id,
    }).create()
    assert.equal(general[0].status, 'new')
    assert.equal(onUnit.establishment_id, establishment.id)
  })
})
