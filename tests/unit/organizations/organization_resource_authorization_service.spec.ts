import { test } from '@japa/runner'

import { projectOrganizationAllowedActions } from '#modules/organizations/services/organization_resource_authorization_service'
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
  test('keeps editors scoped to establishment content and analytics', ({ assert }) => {
    const actions = projectOrganizationAllowedActions(
      [organizationPolicyCapabilitiesFor('membership', 'editor')],
      portalPermissions
    )

    assert.deepEqual(actions.organizations, { read: true, update: false, submit: false })
    assert.deepInclude(actions.establishments, {
      create: true,
      update: true,
      submit: true,
      archive: false,
    })
    assert.deepInclude(actions.benefit_offers, {
      read: true,
      create: true,
      update: true,
      archive: true,
    })
    assert.deepEqual(actions.redemptions, { read: true, validate: true })
    assert.isTrue(actions.analytics.read)
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
})
