import { test } from '@japa/runner'

import type IOrganization from '#modules/organizations/interfaces/organization_interface'
import { organizationPolicyCapabilitiesFor } from '#modules/organizations/services/organization_policy_service'
import type { OrganizationActorAuthorizationContext } from '#modules/organizations/services/organization_resource_authorization_service'
import type User from '#modules/users/models/user'
import {
  projectCurrentUser,
  projectMobileCapabilities,
} from '#modules/users/services/current_user_context_service'

function actions(redemptions: { read: boolean; validate: boolean }): IOrganization.AllowedActions {
  return {
    organizations: { read: false, update: false, submit: false },
    establishments: {
      read: false,
      list: false,
      create: false,
      create_revision: false,
      update: false,
      submit: false,
      archive: false,
    },
    benefit_offers: {
      read: false,
      list: false,
      create: false,
      update: false,
      activate: false,
      pause: false,
      archive: false,
    },
    redemptions,
    analytics: { read: false },
    pilot_feedback: { create: false },
  }
}

function authorization(options: {
  redemptions: { read: boolean; validate: boolean }
  platformAccess: IOrganization.ActorAccessSnapshot['platform_access']
  hasActiveOrganizationMembership: boolean
  membershipRole?: IOrganization.Role
}): OrganizationActorAuthorizationContext {
  return {
    access_snapshot: {
      platform_access: options.platformAccess,
      has_active_organization_membership: options.hasActiveOrganizationMembership,
      organization_accesses: options.membershipRole
        ? [
            {
              organization_id: 17,
              capabilities: organizationPolicyCapabilitiesFor('membership', options.membershipRole),
            },
          ]
        : [],
    },
    permission_names: new Set(),
    allowed_actions: actions(options.redemptions),
  }
}

test.group('Current user mobile context projections', () => {
  test('keeps the user DTO allowlisted', ({ assert }) => {
    const user = {
      id: 41,
      full_name: 'Conta Segura',
      email: 'conta@example.com',
      username: 'conta-segura',
      email_verified: true,
      email_verified_at: '2026-09-04T08:00:00.000Z',
      password: 'never-serialize-this',
      metadata: { email_verification_token_hash: 'never-serialize-this' },
      is_deleted: false,
    } as unknown as User

    assert.deepEqual(projectCurrentUser(user), {
      id: 41,
      full_name: 'Conta Segura',
      email: 'conta@example.com',
      username: 'conta-segura',
      email_verified: true,
      email_verified_at: '2026-09-04T08:00:00.000Z',
    })
  })

  test('separates active partner identity from operational redemption authority', ({ assert }) => {
    assert.deepEqual(
      projectMobileCapabilities(
        authorization({
          redemptions: { read: false, validate: false },
          platformAccess: null,
          hasActiveOrganizationMembership: false,
        })
      ),
      {
        consumer: { wallet: { read: true } },
        partner: {
          enabled: false,
          redemptions: { read: false, validate: false },
        },
        platform_access: null,
      }
    )

    assert.deepEqual(
      projectMobileCapabilities(
        authorization({
          redemptions: { read: true, validate: false },
          platformAccess: 'platform_moderator',
          hasActiveOrganizationMembership: true,
          membershipRole: 'analyst',
        })
      ),
      {
        consumer: { wallet: { read: true } },
        partner: {
          enabled: true,
          redemptions: { read: true, validate: false },
        },
        platform_access: 'platform_moderator',
      }
    )

    assert.deepEqual(
      projectMobileCapabilities(
        authorization({
          redemptions: { read: true, validate: true },
          platformAccess: 'platform_admin',
          hasActiveOrganizationMembership: false,
        })
      ),
      {
        consumer: { wallet: { read: true } },
        partner: {
          enabled: false,
          redemptions: { read: true, validate: true },
        },
        platform_access: 'platform_admin',
      }
    )

    assert.deepEqual(
      projectMobileCapabilities(
        authorization({
          redemptions: { read: true, validate: true },
          platformAccess: 'platform_admin',
          hasActiveOrganizationMembership: true,
        })
      ),
      {
        consumer: { wallet: { read: true } },
        partner: {
          enabled: true,
          redemptions: { read: true, validate: true },
        },
        platform_access: 'platform_admin',
      }
    )
  })

  test('keeps suspended and removed memberships disabled', ({ assert }) => {
    for (const membershipStatus of ['suspended', 'removed'] as const) {
      const capabilities = projectMobileCapabilities(
        authorization({
          redemptions: { read: false, validate: false },
          platformAccess: null,
          hasActiveOrganizationMembership: false,
        })
      )

      assert.isFalse(capabilities.partner.enabled, membershipStatus)
      assert.isFalse(capabilities.partner.redemptions.read, membershipStatus)
      assert.isFalse(capabilities.partner.redemptions.validate, membershipStatus)
    }
  })
})
