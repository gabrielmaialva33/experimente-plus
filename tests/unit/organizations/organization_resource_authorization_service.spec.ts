import { test } from '@japa/runner'

import {
  projectEstablishmentBenefitAllowedActions,
  projectEstablishmentRevisionAllowedActions,
  projectOrganizationAllowedActions,
  projectOrganizationStateAllowedActions,
  type EstablishmentRevisionActionState,
} from '#modules/organizations/services/organization_resource_authorization_service'
import { organizationPolicyCapabilitiesFor } from '#modules/organizations/services/organization_policy_service'

const portalPermissions = new Set([
  'organizations.read',
  'organizations.update',
  'organizations.submit',
  'establishments.read',
  'establishments.list',
  'establishments.create',
  'establishments.update',
  'establishments.submit',
  'establishments.archive',
  'benefit_offers.read',
  'benefit_offers.list',
  'benefit_offers.create',
  'benefit_offers.update',
  'benefit_offers.archive',
  'analytics.read',
  'pilot_feedback.create',
])

test.group('Organization resource action projection', () => {
  test('keeps editors scoped to establishment content and benefit validation', ({ assert }) => {
    const actions = projectOrganizationAllowedActions(
      [organizationPolicyCapabilitiesFor('membership', 'editor')],
      portalPermissions
    )

    assert.deepEqual(actions.organizations, { read: true, update: false, submit: false })
    assert.deepInclude(actions.establishments, {
      create: true,
      create_revision: false,
      update: true,
      submit: true,
      archive: false,
    })
    assert.deepInclude(actions.benefit_offers, {
      read: true,
      create: true,
      update: true,
      activate: true,
      pause: true,
      archive: true,
    })
    assert.deepEqual(actions.redemptions, { read: true, validate: true })
    assert.isFalse(actions.analytics.read)
  })

  test('keeps analysts read-only while preserving organization analytics', ({ assert }) => {
    const actions = projectOrganizationAllowedActions(
      [organizationPolicyCapabilitiesFor('membership', 'analyst')],
      portalPermissions
    )

    assert.isTrue(actions.organizations.read)
    assert.isFalse(actions.organizations.update)
    assert.isFalse(actions.establishments.update)
    assert.isTrue(actions.benefit_offers.read)
    assert.isFalse(actions.benefit_offers.update)
    assert.deepEqual(actions.redemptions, { read: true, validate: false })
    assert.isTrue(actions.analytics.read)
  })

  test('requires the global permission even when domain policy grants the action', ({ assert }) => {
    const withoutOfferUpdate = new Set(portalPermissions)
    withoutOfferUpdate.delete('benefit_offers.update')

    const actions = projectOrganizationAllowedActions(
      [organizationPolicyCapabilitiesFor('platform_admin', null)],
      withoutOfferUpdate
    )

    assert.isFalse(actions.benefit_offers.update)
    assert.isFalse(actions.benefit_offers.activate)
    assert.isFalse(actions.benefit_offers.pause)
    assert.isFalse(actions.redemptions.validate)
    assert.isTrue(actions.organizations.update)
    assert.isTrue(actions.establishments.update)
  })

  test('aggregates actions across memberships without widening each policy', ({ assert }) => {
    const actions = projectOrganizationAllowedActions(
      [
        organizationPolicyCapabilitiesFor('membership', 'analyst'),
        organizationPolicyCapabilitiesFor('membership', 'editor'),
      ],
      portalPermissions
    )

    assert.isFalse(actions.organizations.update)
    assert.isTrue(actions.establishments.update)
    assert.isTrue(actions.redemptions.validate)
    assert.isTrue(actions.analytics.read)
  })

  test('does not project redemption or analytics actions for platform moderation alone', ({
    assert,
  }) => {
    const actions = projectOrganizationAllowedActions(
      [organizationPolicyCapabilitiesFor('platform_moderator', null)],
      portalPermissions
    )

    assert.deepEqual(actions.redemptions, { read: false, validate: false })
    assert.isFalse(actions.analytics.read)
  })

  test('narrows new-unit creation to organization states that accept management', ({ assert }) => {
    const base = projectOrganizationAllowedActions(
      [organizationPolicyCapabilitiesFor('membership', 'owner')],
      portalPermissions
    )

    for (const status of ['draft', 'changes_requested', 'active'] as const) {
      assert.isTrue(projectOrganizationStateAllowedActions(base, status).establishments.create)
    }
    for (const status of ['pending_review', 'rejected', 'suspended', 'archived'] as const) {
      assert.isFalse(projectOrganizationStateAllowedActions(base, status).establishments.create)
    }

    assert.isTrue(base.establishments.create)
    assert.isFalse(base.establishments.create_revision)
    assert.isTrue(projectOrganizationStateAllowedActions(base, 'draft').organizations.submit)
    assert.isFalse(projectOrganizationStateAllowedActions(base, 'active').organizations.submit)
    assert.isTrue(projectOrganizationStateAllowedActions(base, 'active').organizations.update)
    assert.isFalse(
      projectOrganizationStateAllowedActions(base, 'pending_review').organizations.update
    )
  })

  test('projects revision actions from editable, lifecycle and business state', ({ assert }) => {
    const base = projectOrganizationStateAllowedActions(
      projectOrganizationAllowedActions(
        [organizationPolicyCapabilitiesFor('membership', 'editor')],
        portalPermissions
      ),
      'active'
    )
    const project = (overrides: Partial<EstablishmentRevisionActionState> = {}) =>
      projectEstablishmentRevisionAllowedActions(base, {
        organization_status: 'active',
        lifecycle_status: 'active',
        business_status: 'open',
        revision_status: 'draft',
        published_revision_id: null,
        ...overrides,
      }).establishments

    assert.deepInclude(project(), { update: true, submit: true, create_revision: false })
    assert.deepInclude(project({ revision_status: 'changes_requested' }), {
      update: true,
      submit: true,
      create_revision: false,
    })
    assert.deepInclude(project({ revision_status: 'pending_review' }), {
      update: false,
      submit: false,
      create_revision: false,
    })
    assert.deepInclude(project({ revision_status: 'approved', published_revision_id: 81 }), {
      update: false,
      submit: false,
      create_revision: true,
    })
    assert.deepInclude(project({ revision_status: 'rejected' }), {
      update: false,
      submit: false,
      create_revision: true,
    })
    assert.isFalse(
      project({ revision_status: 'rejected', published_revision_id: 81 }).create_revision
    )
    assert.deepInclude(project({ lifecycle_status: 'suspended' }), {
      update: true,
      submit: false,
      create_revision: false,
    })
    assert.deepInclude(
      project({
        lifecycle_status: 'suspended',
        revision_status: 'approved',
        published_revision_id: 81,
      }),
      {
        update: false,
        submit: false,
        create_revision: true,
      }
    )
    assert.deepInclude(project({ business_status: 'permanently_closed' }), {
      update: true,
      submit: false,
      create_revision: false,
    })
    assert.isTrue(
      project({
        business_status: 'permanently_closed',
        revision_status: 'approved',
        published_revision_id: 81,
      }).create_revision
    )
    assert.deepInclude(project({ organization_status: 'pending_review' }), {
      update: false,
      submit: false,
      create_revision: false,
    })

    const archivedActions = projectEstablishmentRevisionAllowedActions(base, {
      organization_status: 'active',
      lifecycle_status: 'archived',
      business_status: 'open',
      revision_status: 'draft',
      published_revision_id: null,
    })
    assert.isFalse(archivedActions.establishments.update)
    assert.isFalse(archivedActions.establishments.submit)
    assert.isFalse(archivedActions.establishments.archive)

    const analyst = projectOrganizationAllowedActions(
      [organizationPolicyCapabilitiesFor('membership', 'analyst')],
      portalPermissions
    )
    assert.isFalse(
      projectEstablishmentRevisionAllowedActions(analyst, {
        organization_status: 'active',
        lifecycle_status: 'active',
        business_status: 'open',
        revision_status: 'approved',
        published_revision_id: 81,
      }).establishments.create_revision
    )
  })

  test('narrows new benefit terms without hiding pause and archive escape hatches', ({
    assert,
  }) => {
    const base = projectOrganizationAllowedActions(
      [organizationPolicyCapabilitiesFor('membership', 'editor')],
      portalPermissions
    )
    const project = (
      lifecycleStatus: 'active' | 'suspended' | 'archived',
      businessStatus: 'open' | 'temporarily_closed' | 'permanently_closed',
      publishedRevisionId: number | null
    ) =>
      projectEstablishmentBenefitAllowedActions(base, {
        lifecycle_status: lifecycleStatus,
        business_status: businessStatus,
        published_revision_id: publishedRevisionId,
      }).benefit_offers

    assert.deepInclude(project('active', 'open', 31), {
      create: true,
      update: true,
      activate: true,
      pause: true,
      archive: true,
    })

    for (const actions of [
      project('active', 'open', null),
      project('suspended', 'open', 31),
      project('active', 'permanently_closed', 31),
    ]) {
      assert.deepInclude(actions, {
        create: false,
        update: false,
        activate: false,
        pause: true,
        archive: true,
      })
    }
  })
})
