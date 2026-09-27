import { test } from '@japa/runner'
import { DateTime } from 'luxon'

import type IOrganization from '#modules/organizations/interfaces/organization_interface'
import type OrganizationInvitation from '#modules/organizations/models/organization_invitation'
import type OrganizationMember from '#modules/organizations/models/organization_member'
import { organizationPolicyCapabilitiesFor } from '#modules/organizations/services/organization_policy_service'
import { projectOrganizationTeamPage } from '#modules/organizations/services/organization_team_page_service'
import {
  maskEmail,
  organizationTeamErrorMessage,
} from '#modules/organizations/utils/organization_team_messages'

const NOW = DateTime.fromISO('2026-09-27T12:00:00.000Z')

const TEAM_PERMISSIONS = new Set([
  'organization_members.list',
  'organization_members.update',
  'organization_members.delete',
  'organization_invitations.list',
  'organization_invitations.create',
  'organization_invitations.resend',
  'organization_invitations.revoke',
])

function member(
  id: number,
  role: IOrganization.Role,
  status: IOrganization.MemberStatus = 'active'
): OrganizationMember {
  return {
    id,
    user_id: id * 10,
    role,
    status,
    joined_at: NOW.minus({ days: id }),
    suspended_at: status === 'suspended' ? NOW.minus({ hours: 1 }) : null,
    user: { full_name: `Pessoa ${id}`, email: `pessoa-${id}@example.com` },
  } as unknown as OrganizationMember
}

function invitation(
  id: number,
  role: IOrganization.Role,
  overrides: Partial<Record<'accepted_at' | 'revoked_at' | 'expires_at', DateTime | null>> = {}
): OrganizationInvitation {
  return {
    id,
    email: `convite-${id}@example.com`,
    role,
    accepted_at: null,
    revoked_at: null,
    expires_at: NOW.plus({ hours: 24 }),
    created_at: NOW.minus({ hours: 2 }),
    inviter: { full_name: 'Quem convidou' },
    ...overrides,
  } as unknown as OrganizationInvitation
}

const team = [
  member(1, 'owner'),
  member(2, 'admin'),
  member(3, 'editor'),
  member(4, 'analyst', 'suspended'),
  member(5, 'editor', 'removed'),
]

function project(
  source: IOrganization.AccessSource,
  role: IOrganization.Role | null,
  options: {
    actorId?: number
    members?: OrganizationMember[]
    invitations?: OrganizationInvitation[]
    status?: IOrganization.Status
    permissions?: ReadonlySet<string>
  } = {}
) {
  return projectOrganizationTeamPage({
    organization: { id: 7, trade_name: 'Casa Teste', status: options.status ?? 'active' },
    capabilities: organizationPolicyCapabilitiesFor(source, role),
    actorId: options.actorId ?? 999,
    permissionNames: options.permissions ?? TEAM_PERMISSIONS,
    members: options.members ?? team,
    invitations: options.invitations ?? [invitation(1, 'owner'), invitation(2, 'analyst')],
    now: NOW,
  })
}

const actionsById = (page: ReturnType<typeof project>) =>
  Object.fromEntries(page.members.map((row) => [row.id, row.actions]))

test.group('Organization team page projection', () => {
  test('lists active and suspended members, never removed ones', ({ assert }) => {
    const page = project('membership', 'owner', { actorId: 10 })

    assert.deepEqual(
      page.members.map((row) => [row.id, row.status]),
      [
        [1, 'active'],
        [2, 'active'],
        [3, 'active'],
        [4, 'suspended'],
      ]
    )
    assert.equal(page.members[0].user.email, 'pessoa-1@example.com')
    assert.equal(page.members[3].suspended_at, NOW.minus({ hours: 1 }).toISO())
  })

  test('lets an owner manage everyone else but keeps the last active owner in place', ({
    assert,
  }) => {
    const page = project('membership', 'owner', { actorId: 20 })
    const actions = actionsById(page)

    // The only active owner can be neither demoted, suspended nor removed.
    assert.isTrue(page.members[0].is_last_owner)
    assert.deepEqual(actions[1], { roles: [], suspend: false, reactivate: false, remove: false })
    // The viewer's own membership offers nothing.
    assert.isTrue(page.members[1].is_self)
    assert.deepEqual(actions[2], { roles: [], suspend: false, reactivate: false, remove: false })
    assert.deepEqual(actions[3], {
      roles: ['owner', 'admin', 'analyst'],
      suspend: true,
      reactivate: false,
      remove: true,
    })
    assert.deepEqual(actions[4], {
      roles: ['owner', 'admin', 'editor'],
      suspend: false,
      reactivate: true,
      remove: true,
    })
    assert.deepEqual(page.invite_roles, ['owner', 'admin', 'editor', 'analyst'])
    assert.deepEqual(
      page.invitations.map((row) => row.actions),
      [
        { resend: true, cancel: true },
        { resend: true, cancel: true },
      ]
    )
  })

  test('frees an owner for changes once another owner is active', ({ assert }) => {
    const page = project('membership', 'owner', {
      actorId: 999,
      members: [member(1, 'owner'), member(2, 'owner')],
    })

    assert.isFalse(page.members[0].is_last_owner)
    assert.deepEqual(page.members[0].actions, {
      roles: ['admin', 'editor', 'analyst'],
      suspend: true,
      reactivate: false,
      remove: true,
    })
  })

  test('limits an organization admin to editors and analysts', ({ assert }) => {
    const page = project('membership', 'admin', { actorId: 20 })
    const actions = actionsById(page)

    assert.deepEqual(actions[1], { roles: [], suspend: false, reactivate: false, remove: false })
    assert.deepEqual(actions[3], {
      roles: ['analyst'],
      suspend: true,
      reactivate: false,
      remove: true,
    })
    assert.deepEqual(actions[4], {
      roles: ['editor'],
      suspend: false,
      reactivate: true,
      remove: true,
    })
    assert.deepEqual(page.invite_roles, ['editor', 'analyst'])
    // The owner invitation is out of an admin's reach; the analyst one is not.
    assert.deepEqual(
      page.invitations.map((row) => [row.role, row.actions]),
      [
        ['owner', { resend: false, cancel: false }],
        ['analyst', { resend: true, cancel: true }],
      ]
    )
  })

  test('keeps the team read-only for editors, analysts and platform moderators', ({ assert }) => {
    for (const [source, role] of [
      ['membership', 'editor'],
      ['membership', 'analyst'],
      ['platform_moderator', null],
    ] as const) {
      const page = project(source, role)

      assert.deepEqual(page.invite_roles, [], `${source}/${role} invites`)
      assert.isTrue(
        page.members.every(
          (row) =>
            row.actions.roles.length === 0 &&
            !row.actions.suspend &&
            !row.actions.reactivate &&
            !row.actions.remove
        ),
        `${source}/${role} manages`
      )
      assert.isTrue(
        page.invitations.every((row) => !row.actions.resend && !row.actions.cancel),
        `${source}/${role} invitations`
      )
    }
  })

  test('gives platform administrators the owner view of any organization', ({ assert }) => {
    const page = project('platform_admin', null)

    assert.equal(page.viewer.source, 'platform_admin')
    assert.deepEqual(page.invite_roles, ['owner', 'admin', 'editor', 'analyst'])
    assert.deepEqual(actionsById(page)[2], {
      roles: ['owner', 'editor', 'analyst'],
      suspend: true,
      reactivate: false,
      remove: true,
    })
  })

  test('shows only open invitations and tells pending from expired', ({ assert }) => {
    const page = project('membership', 'owner', {
      invitations: [
        invitation(1, 'editor'),
        invitation(2, 'editor', { expires_at: NOW.minus({ minutes: 1 }) }),
        invitation(3, 'editor', { accepted_at: NOW }),
        invitation(4, 'editor', { revoked_at: NOW }),
      ],
    })

    assert.deepEqual(
      page.invitations.map((row) => [row.id, row.state, row.invited_by]),
      [
        [1, 'pending', 'Quem convidou'],
        [2, 'expired', 'Quem convidou'],
      ]
    )
  })

  test('closes invitations of rejected and archived organizations but keeps cancelling', ({
    assert,
  }) => {
    for (const status of ['rejected', 'archived'] as const) {
      const page = project('membership', 'owner', { status })

      assert.isFalse(page.organization.accepts_invitations)
      assert.deepEqual(page.invite_roles, [])
      assert.deepEqual(page.invitations[0].actions, { resend: false, cancel: true })
    }
  })

  test('follows the global permission each team route carries', ({ assert }) => {
    const page = project('membership', 'owner', {
      permissions: new Set(['organization_members.list', 'organization_invitations.list']),
    })

    assert.deepEqual(page.invite_roles, [])
    assert.deepEqual(actionsById(page)[3], {
      roles: [],
      suspend: false,
      reactivate: false,
      remove: false,
    })
    assert.deepEqual(page.invitations[0].actions, { resend: false, cancel: false })
  })
})

test.group('Organization team copy', () => {
  test('masks the invited address down to a hint', ({ assert }) => {
    assert.equal(maskEmail('maria.silva@exemplo.com'), 'ma•••@exemplo.com')
    assert.equal(maskEmail('ab@exemplo.com'), 'a•••@exemplo.com')
    assert.equal(maskEmail('sem-arroba'), '•••')
  })

  test('translates the rules a person can trip and hides unknown messages', ({ assert }) => {
    assert.match(
      organizationTeamErrorMessage('The last active organization owner cannot be changed'),
      /pelo menos um proprietário ativo/
    )
    assert.match(
      organizationTeamErrorMessage('Organization cannot manage invitations while archived'),
      /rejeitadas ou arquivadas/
    )
    assert.match(
      organizationTeamErrorMessage('The authenticated account does not match the invitation email'),
      /e-mail que recebeu o convite/
    )
    assert.equal(
      organizationTeamErrorMessage('select * from secrets'),
      'Não foi possível concluir a alteração na equipe. Atualize a página e tente novamente.'
    )
  })
})
