import { test } from '@japa/runner'

import type IOrganization from '#modules/organizations/interfaces/organization_interface'
import type OrganizationMember from '#modules/organizations/models/organization_member'
import type OrganizationMemberRepository from '#modules/organizations/repositories/organization_member_repository'
import OrganizationPolicyService, {
  canManageOrganizationMember,
  grantableOrganizationRoles,
  organizationActorAccessSnapshot,
  organizationPolicyCapabilitiesFor,
  type PlatformAccess,
} from '#modules/organizations/services/organization_policy_service'
import type User from '#modules/users/models/user'

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
  manage_team: false,
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
      manage_team: true,
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
      manage_team: true,
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
      manage_team: true,
    },
  },
  {
    label: 'platform moderator',
    source: 'platform_moderator',
    role: null,
    expected: readOnly,
  },
]

class PolicyWithPlatformAccess extends OrganizationPolicyService {
  constructor(
    repository: OrganizationMemberRepository,
    private platformAccess: PlatformAccess | null
  ) {
    super(repository)
  }

  override async resolvePlatformAccess(_actor: User): Promise<PlatformAccess | null> {
    return this.platformAccess
  }
}

async function resolveSnapshot(
  platformAccess: PlatformAccess | null,
  memberships: OrganizationMember[]
) {
  const calls: Array<{ tenantId: number; userId: number }> = []
  const repository = {
    async listActiveByUser(tenantId: number, userId: number) {
      calls.push({ tenantId, userId })
      return memberships
    },
  } as unknown as OrganizationMemberRepository
  const service = new PolicyWithPlatformAccess(repository, platformAccess)

  const snapshot = await service.resolveActorAccess({ id: 41 } as User, 7)

  return { calls, snapshot }
}

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

test.group('Organization actor access snapshot', () => {
  test('preserves active membership identity without scoping platform admins', async ({
    assert,
  }) => {
    const membership = { organization_id: 23, role: 'analyst' } as OrganizationMember
    const { calls, snapshot } = await resolveSnapshot('platform_admin', [membership])

    assert.deepEqual(calls, [{ tenantId: 7, userId: 41 }])
    assert.deepEqual(snapshot, {
      platform_access: 'platform_admin',
      has_active_organization_membership: true,
      organization_accesses: [],
    })
  })

  test('keeps platform administration separate from absent partner identity', async ({
    assert,
  }) => {
    const { calls, snapshot } = await resolveSnapshot('platform_admin', [])

    assert.deepEqual(calls, [{ tenantId: 7, userId: 41 }])
    assert.deepEqual(snapshot, {
      platform_access: 'platform_admin',
      has_active_organization_membership: false,
      organization_accesses: [],
    })
  })

  test('uses the same active membership list for a moderator hybrid snapshot', async ({
    assert,
  }) => {
    const membership = { organization_id: 23, role: 'editor' } as OrganizationMember
    const { calls, snapshot } = await resolveSnapshot('platform_moderator', [membership])

    assert.deepEqual(calls, [{ tenantId: 7, userId: 41 }])
    assert.isTrue(snapshot.has_active_organization_membership)
    assert.deepEqual(snapshot.organization_accesses, [
      {
        organization_id: 23,
        capabilities: organizationPolicyCapabilitiesFor('membership', 'editor'),
      },
    ])
  })
})

test.group('Organization team policy', () => {
  const owner = organizationPolicyCapabilitiesFor('membership', 'owner')
  const admin = organizationPolicyCapabilitiesFor('membership', 'admin')
  const editor = organizationPolicyCapabilitiesFor('membership', 'editor')
  const analyst = organizationPolicyCapabilitiesFor('membership', 'analyst')
  const platformAdmin = organizationPolicyCapabilitiesFor('platform_admin', null)
  const moderator = organizationPolicyCapabilitiesFor('platform_moderator', null)

  test('grants every role to owners and platform admins and only limited roles to admins', ({
    assert,
  }) => {
    assert.deepEqual(grantableOrganizationRoles(owner), ['owner', 'admin', 'editor', 'analyst'])
    assert.deepEqual(grantableOrganizationRoles(platformAdmin), [
      'owner',
      'admin',
      'editor',
      'analyst',
    ])
    assert.deepEqual(grantableOrganizationRoles(admin), ['editor', 'analyst'])
    assert.deepEqual(grantableOrganizationRoles(editor), [])
    assert.deepEqual(grantableOrganizationRoles(analyst), [])
    assert.deepEqual(grantableOrganizationRoles(moderator), [])
  })

  test('lets admins manage only editors and analysts, and only into those roles', ({ assert }) => {
    assert.isTrue(canManageOrganizationMember(owner, 'owner', 'analyst'))
    assert.isTrue(canManageOrganizationMember(platformAdmin, 'admin'))
    assert.isTrue(canManageOrganizationMember(admin, 'editor', 'analyst'))
    assert.isTrue(canManageOrganizationMember(admin, 'analyst'))
    assert.isFalse(canManageOrganizationMember(admin, 'editor', 'admin'))
    assert.isFalse(canManageOrganizationMember(admin, 'admin'))
    assert.isFalse(canManageOrganizationMember(admin, 'owner'))
    assert.isFalse(canManageOrganizationMember(editor, 'analyst'))
    assert.isFalse(canManageOrganizationMember(analyst, 'editor'))
    assert.isFalse(canManageOrganizationMember(moderator, 'analyst'))
  })

  test('builds the shared snapshot from the memberships already loaded', ({ assert }) => {
    const memberships = [{ organization_id: 3, role: 'editor' as const }]

    assert.deepEqual(organizationActorAccessSnapshot(null, memberships), {
      platform_access: null,
      has_active_organization_membership: true,
      organization_accesses: [{ organization_id: 3, capabilities: editor }],
    })
    assert.deepEqual(organizationActorAccessSnapshot('platform_admin', memberships), {
      platform_access: 'platform_admin',
      has_active_organization_membership: true,
      organization_accesses: [],
    })
    assert.isFalse(organizationActorAccessSnapshot(null, []).has_active_organization_membership)
  })
})
