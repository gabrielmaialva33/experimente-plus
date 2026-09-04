import { test } from '@japa/runner'

import type IOrganization from '#modules/organizations/interfaces/organization_interface'
import { organizationPolicyCapabilitiesFor } from '#modules/organizations/services/organization_policy_service'

type MatrixCase = {
  label: string
  source: IOrganization.AccessSource
  role: IOrganization.Role | null
  expected: Omit<IOrganization.PolicyCapabilities, 'source' | 'role'>
}

const readOnly = {
  read: true,
  update_organization: false,
  submit_organization: false,
  manage_establishments: false,
  manage_establishment_lifecycle: false,
  read_analytics: false,
  read_redemptions: false,
  validate_redemptions: false,
}

const matrix: MatrixCase[] = [
  {
    label: 'owner',
    source: 'membership',
    role: 'owner',
    expected: {
      read: true,
      update_organization: true,
      submit_organization: true,
      manage_establishments: true,
      manage_establishment_lifecycle: true,
      read_analytics: true,
      read_redemptions: true,
      validate_redemptions: true,
    },
  },
  {
    label: 'organization admin',
    source: 'membership',
    role: 'admin',
    expected: {
      read: true,
      update_organization: true,
      submit_organization: true,
      manage_establishments: true,
      manage_establishment_lifecycle: true,
      read_analytics: true,
      read_redemptions: true,
      validate_redemptions: true,
    },
  },
  {
    label: 'editor',
    source: 'membership',
    role: 'editor',
    expected: {
      ...readOnly,
      manage_establishments: true,
      read_redemptions: true,
      validate_redemptions: true,
    },
  },
  {
    label: 'analyst',
    source: 'membership',
    role: 'analyst',
    expected: {
      ...readOnly,
      read_analytics: true,
      read_redemptions: true,
    },
  },
  {
    label: 'platform root/admin',
    source: 'platform_admin',
    role: null,
    expected: {
      read: true,
      update_organization: true,
      submit_organization: true,
      manage_establishments: true,
      manage_establishment_lifecycle: true,
      read_analytics: true,
      read_redemptions: true,
      validate_redemptions: true,
    },
  },
  {
    label: 'platform moderator',
    source: 'platform_moderator',
    role: null,
    expected: readOnly,
  },
]

test.group('Organization policy matrix', () => {
  for (const entry of matrix) {
    test(`projects ${entry.label} capabilities from the applicable domain ADRs`, ({ assert }) => {
      const actual = organizationPolicyCapabilitiesFor(entry.source, entry.role)

      assert.deepEqual(actual, {
        source: entry.source,
        role: entry.role,
        ...entry.expected,
      })
    })
  }

  test('fails closed for an invalid membership without an organization role', ({ assert }) => {
    const actual = organizationPolicyCapabilitiesFor('membership', null)

    assert.isFalse(actual.read)
    assert.isFalse(actual.update_organization)
    assert.isFalse(actual.manage_establishments)
    assert.isFalse(actual.read_analytics)
    assert.isFalse(actual.read_redemptions)
    assert.isFalse(actual.validate_redemptions)
  })
})
