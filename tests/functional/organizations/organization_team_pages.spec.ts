import { test } from '@japa/runner'
import testUtils from '@adonisjs/core/services/test_utils'
import mail from '@adonisjs/mail/services/main'

import type { OrganizationTeamPageProps } from '#modules/organizations/interfaces/organization_team_pages'
import OrganizationInvitation from '#modules/organizations/models/organization_invitation'
import OrganizationMember from '#modules/organizations/models/organization_member'
import OrganizationInvitationNotification from '#modules/organizations/services/organization_invitation_notification'
import IRole from '#modules/roles/interfaces/role_interface'
import type Tenant from '#modules/tenants/models/tenant'
import type User from '#modules/users/models/user'
import {
  addOrganizationMember,
  createOperation,
  createOrganization,
  createUser,
} from './helpers.js'

interface TestInertiaPage {
  component: string
  props: Record<string, unknown>
}

function parseInertiaPage(response: { text(): string }): TestInertiaPage {
  const match = response
    .text()
    .match(/<script data-page="app" type="application\/json">([\s\S]*?)<\/script>/)

  if (!match?.[1]) {
    throw new Error('The response does not contain an Inertia page payload')
  }

  return JSON.parse(match[1]) as TestInertiaPage
}

function teamProps(response: { text(): string }): OrganizationTeamPageProps {
  const page = parseInertiaPage(response)
  if (page.component !== 'portal/organizations/team') {
    throw new Error(`Unexpected Inertia component: ${page.component}`)
  }
  return page.props as unknown as OrganizationTeamPageProps
}

async function teamScenario(prefix: string) {
  const tenant = await createOperation(prefix)
  const owner = await createUser({ prefix: `${prefix}-owner`, tenant })
  const admin = await createUser({ prefix: `${prefix}-admin`, tenant })
  const editor = await createUser({ prefix: `${prefix}-editor`, tenant })
  const analyst = await createUser({ prefix: `${prefix}-analyst`, tenant })
  const organization = await createOrganization({
    tenant,
    owner,
    status: 'active',
    prefix: 'Team',
  })
  const members = {
    owner: await OrganizationMember.query()
      .where('organization_id', organization.id)
      .where('user_id', owner.id)
      .firstOrFail(),
    admin: await addOrganizationMember({ tenant, organization, user: admin, role: 'admin' }),
    editor: await addOrganizationMember({ tenant, organization, user: editor, role: 'editor' }),
    analyst: await addOrganizationMember({ tenant, organization, user: analyst, role: 'analyst' }),
  }

  return {
    tenant,
    organization,
    users: { owner, admin, editor, analyst },
    members,
    teamPath: `/portal/organizations/${organization.id}/team`,
  }
}

function asUser(tenant: Tenant) {
  return { 'x-tenant-id': String(tenant.id) }
}

test.group('Organization team pages', (group) => {
  group.each.setup(() => {
    mail.restore()
    mail.fake()
    return testUtils.db().withGlobalTransaction()
  })
  group.each.teardown(() => mail.restore())

  test('renders the team with the actions each role may take', async ({ client, assert }) => {
    const scenario = await teamScenario('team-render')

    const asOwner = await client
      .get(scenario.teamPath)
      .headers(asUser(scenario.tenant))
      .loginAs(scenario.users.owner)
    asOwner.assertStatus(200)
    assert.equal(asOwner.header('cache-control'), 'private, no-store')
    assert.equal(asOwner.header('x-robots-tag'), 'noindex, nofollow')
    const ownerView = teamProps(asOwner)
    assert.equal(ownerView.organization.trade_name, scenario.organization.trade_name)
    assert.deepEqual(ownerView.viewer, { source: 'membership', role: 'owner' })
    assert.deepEqual(
      ownerView.members.map((member) => member.role),
      ['owner', 'admin', 'editor', 'analyst']
    )
    assert.deepEqual(ownerView.invite_roles, ['owner', 'admin', 'editor', 'analyst'])
    const adminRow = ownerView.members.find((member) => member.role === 'admin')!
    assert.deepEqual(adminRow.actions, {
      roles: ['owner', 'editor', 'analyst'],
      suspend: true,
      reactivate: false,
      remove: true,
    })
    // The owner is the only active owner and sees no action on their own row.
    const ownerRow = ownerView.members.find((member) => member.role === 'owner')!
    assert.isTrue(ownerRow.is_self)
    assert.isTrue(ownerRow.is_last_owner)

    const adminView = teamProps(
      await client
        .get(scenario.teamPath)
        .headers(asUser(scenario.tenant))
        .loginAs(scenario.users.admin)
    )
    assert.deepEqual(adminView.invite_roles, ['editor', 'analyst'])
    assert.deepEqual(
      adminView.members.map((member) => [member.role, member.actions.remove]),
      [
        ['owner', false],
        ['admin', false],
        ['editor', true],
        ['analyst', true],
      ]
    )

    for (const reader of [scenario.users.editor, scenario.users.analyst]) {
      const view = teamProps(
        await client.get(scenario.teamPath).headers(asUser(scenario.tenant)).loginAs(reader)
      )
      assert.deepEqual(view.invite_roles, [])
      assert.isTrue(
        view.members.every(
          (member) =>
            member.actions.roles.length === 0 &&
            !member.actions.suspend &&
            !member.actions.reactivate &&
            !member.actions.remove
        )
      )
    }
  })

  test('keeps other teams hidden, read-only for moderation and open to platform admins', async ({
    client,
    assert,
  }) => {
    const scenario = await teamScenario('team-outsiders')
    const outsider = await createUser({ prefix: 'team-outsider', tenant: scenario.tenant })
    const moderator = await createUser({
      prefix: 'team-moderator',
      tenant: scenario.tenant,
      globalRole: IRole.Slugs.MODERATOR,
    })
    const platformAdmin = await createUser({
      prefix: 'team-platform-admin',
      tenant: scenario.tenant,
      globalRole: IRole.Slugs.ADMIN,
    })

    const hidden = await client
      .get(scenario.teamPath)
      .headers(asUser(scenario.tenant))
      .loginAs(outsider)
    hidden.assertStatus(404)

    // Moderation reads the team, as `GET /api/v1/organizations/:id/members` lets
    // it, and changes nothing.
    const moderation = await client
      .get(scenario.teamPath)
      .headers(asUser(scenario.tenant))
      .loginAs(moderator)
    moderation.assertStatus(200)
    const moderationView = teamProps(moderation)
    assert.deepEqual(moderationView.viewer, { source: 'platform_moderator', role: null })
    assert.deepEqual(moderationView.invite_roles, [])
    assert.isTrue(moderationView.members.every((member) => !member.actions.remove))

    const administration = await client
      .get(scenario.teamPath)
      .headers(asUser(scenario.tenant))
      .loginAs(platformAdmin)
    administration.assertStatus(200)
    const view = teamProps(administration)
    assert.deepEqual(view.viewer, { source: 'platform_admin', role: null })
    assert.deepEqual(view.invite_roles, ['owner', 'admin', 'editor', 'analyst'])

    const invite = await client
      .post(`${scenario.teamPath}/invitations`)
      .headers(asUser(scenario.tenant))
      .withCsrfToken()
      .redirects(0)
      .loginAs(platformAdmin)
      .json({ email: 'novo-proprietario@example.com', role: 'owner' })
    invite.assertStatus(302)
    assert.equal(invite.header('location'), scenario.teamPath)
    assert.exists(
      await OrganizationInvitation.query()
        .where('organization_id', scenario.organization.id)
        .where('email', 'novo-proprietario@example.com')
        .where('role', 'owner')
        .first()
    )
  })

  test('sends the menu to the only team, a chooser or back to the overview', async ({
    client,
    assert,
  }) => {
    const scenario = await teamScenario('team-menu')
    const single = await client
      .get('/portal/team')
      .headers(asUser(scenario.tenant))
      .redirects(0)
      .loginAs(scenario.users.owner)
    single.assertStatus(302)
    assert.equal(single.header('location'), scenario.teamPath)

    const second = await createOrganization({
      tenant: scenario.tenant,
      owner: null,
      status: 'active',
      prefix: 'Second team',
    })
    await addOrganizationMember({
      tenant: scenario.tenant,
      organization: second,
      user: scenario.users.owner,
      role: 'analyst',
    })
    const chooser = await client
      .get('/portal/team')
      .headers(asUser(scenario.tenant))
      .loginAs(scenario.users.owner)
    chooser.assertStatus(200)
    const page = parseInertiaPage(chooser)
    assert.equal(page.component, 'portal/team/index')
    // Alphabetical, as the overview lists them; the role decides the action.
    assert.deepEqual(
      (page.props.organizations as Array<{ id: number; can_manage: boolean }>).map(
        (organization) => [organization.id, organization.can_manage]
      ),
      [
        [second.id, false],
        [scenario.organization.id, true],
      ]
    )

    const withoutTeam = await createUser({ prefix: 'team-menu-nobody', tenant: scenario.tenant })
    const none = await client
      .get('/portal/team')
      .headers(asUser(scenario.tenant))
      .redirects(0)
      .loginAs(withoutTeam)
    none.assertStatus(302)
    assert.equal(none.header('location'), '/portal')
    none.assertFlashMessage(
      'warning',
      'Você ainda não participa da equipe de uma organização. Cadastre a sua ou aceite um convite.'
    )
  })

  test('invites through the web only with roles the viewer may grant', async ({
    client,
    assert,
  }) => {
    const scenario = await teamScenario('team-invite')
    const { mails } = mail.fake()
    const post = (user: User, body: Record<string, unknown>) =>
      client
        .post(`${scenario.teamPath}/invitations`)
        .headers({ ...asUser(scenario.tenant), referer: scenario.teamPath })
        .withCsrfToken()
        .redirects(0)
        .loginAs(user)
        .json(body)

    const byOwner = await post(scenario.users.owner, {
      email: 'Nova.Editora@Example.com',
      role: 'editor',
    })
    byOwner.assertStatus(302)
    assert.equal(byOwner.header('location'), scenario.teamPath)
    const flash = byOwner.flashMessages() as { success?: string }
    assert.match(
      flash.success ?? '',
      /^Convite enviado para nova\.editora@example\.com como Editor\./
    )
    mails.assertSentCount(OrganizationInvitationNotification, 1)
    const invitation = await OrganizationInvitation.query()
      .where('organization_id', scenario.organization.id)
      .where('email', 'nova.editora@example.com')
      .firstOrFail()
    assert.equal(invitation.role, 'editor')

    // An organization admin may not hand out owner or admin.
    const escalation = await post(scenario.users.admin, {
      email: 'quer-ser-dono@example.com',
      role: 'owner',
    })
    escalation.assertStatus(403)
    assert.isNull(
      await OrganizationInvitation.query().where('email', 'quer-ser-dono@example.com').first()
    )

    const byAdmin = await post(scenario.users.admin, {
      email: 'analista@example.com',
      role: 'analyst',
    })
    byAdmin.assertStatus(302)

    const readOnly = await post(scenario.users.editor, {
      email: 'outro@example.com',
      role: 'analyst',
    })
    readOnly.assertStatus(403)

    const alreadyMember = await post(scenario.users.owner, {
      email: scenario.users.editor.email,
      role: 'analyst',
    })
    alreadyMember.assertStatus(302)
    alreadyMember.assertFlashMessage(
      'error',
      'Esta pessoa já faz parte da equipe. Para mudar o acesso dela, altere o papel na lista.'
    )

    const invalid = await post(scenario.users.owner, { email: 'não-é-email', role: 'chefe' })
    invalid.assertStatus(302)
    const errors = invalid.flashMessages().inputErrorsBag as Record<string, string[]>
    assert.deepEqual(errors.email, ['E-mail precisa ser um e-mail válido.'])
    assert.deepEqual(errors.role, ['Escolha uma opção válida para Papel.'])
  })

  test('resends and cancels pending invitations', async ({ client, assert }) => {
    const scenario = await teamScenario('team-invitation-actions')
    const { mails } = mail.fake()
    const headers = { ...asUser(scenario.tenant), referer: scenario.teamPath }

    await client
      .post(`${scenario.teamPath}/invitations`)
      .headers(headers)
      .withCsrfToken()
      .redirects(0)
      .loginAs(scenario.users.owner)
      .json({ email: 'pendente@example.com', role: 'analyst' })
    const invitation = await OrganizationInvitation.findByOrFail('email', 'pendente@example.com')
    const firstHash = invitation.token_hash

    const resend = await client
      .post(`${scenario.teamPath}/invitations/${invitation.id}/resend`)
      .headers(headers)
      .withCsrfToken()
      .redirects(0)
      .loginAs(scenario.users.admin)
    resend.assertStatus(302)
    resend.assertFlashMessage(
      'success',
      'Convite reenviado para pendente@example.com. O link anterior deixou de valer.'
    )
    await invitation.refresh()
    assert.notEqual(invitation.token_hash, firstHash)
    mails.assertSentCount(OrganizationInvitationNotification, 2)

    const listed = teamProps(
      await client.get(scenario.teamPath).headers(headers).loginAs(scenario.users.owner)
    )
    assert.deepEqual(
      listed.invitations.map((row) => [row.email, row.state, row.actions]),
      [['pendente@example.com', 'pending', { resend: true, cancel: true }]]
    )

    const cancel = await client
      .delete(`${scenario.teamPath}/invitations/${invitation.id}`)
      .headers(headers)
      .withCsrfToken()
      .redirects(0)
      .loginAs(scenario.users.owner)
    cancel.assertStatus(302)
    cancel.assertFlashMessage('success', 'Convite cancelado. O link enviado deixou de funcionar.')
    await invitation.refresh()
    assert.isNotNull(invitation.revoked_at)

    const afterCancel = await client
      .post(`${scenario.teamPath}/invitations/${invitation.id}/resend`)
      .headers(headers)
      .withCsrfToken()
      .redirects(0)
      .loginAs(scenario.users.owner)
    afterCancel.assertStatus(302)
    afterCancel.assertFlashMessage('error', 'Este convite foi cancelado.')

    const stale = await client
      .delete(`${scenario.teamPath}/invitations/999999`)
      .headers(headers)
      .withCsrfToken()
      .redirects(0)
      .loginAs(scenario.users.owner)
    stale.assertStatus(302)
    stale.assertFlashMessage(
      'error',
      'Não encontramos este convite. Ele pode ter sido substituído por um mais recente.'
    )
  })

  test('changes roles, suspends, reactivates and removes within the membership rules', async ({
    client,
    assert,
  }) => {
    const scenario = await teamScenario('team-members')
    const headers = { ...asUser(scenario.tenant), referer: scenario.teamPath }
    const patch = (user: User, memberId: number, body: Record<string, unknown>) =>
      client
        .patch(`${scenario.teamPath}/members/${memberId}`)
        .headers(headers)
        .withCsrfToken()
        .redirects(0)
        .loginAs(user)
        .json(body)

    const promote = await patch(scenario.users.owner, scenario.members.editor.id, {
      role: 'analyst',
    })
    promote.assertStatus(302)
    assert.equal(promote.header('location'), scenario.teamPath)
    promote.assertFlashMessage(
      'success',
      `${scenario.users.editor.full_name} agora é Analista nesta organização.`
    )
    await scenario.members.editor.refresh()
    assert.equal(scenario.members.editor.role, 'analyst')

    const suspend = await patch(scenario.users.admin, scenario.members.analyst.id, {
      status: 'suspended',
    })
    suspend.assertStatus(302)
    await scenario.members.analyst.refresh()
    assert.equal(scenario.members.analyst.status, 'suspended')

    const reactivate = await patch(scenario.users.admin, scenario.members.analyst.id, {
      status: 'active',
    })
    reactivate.assertFlashMessage(
      'success',
      `Acesso de ${scenario.users.analyst.full_name} reativado.`
    )
    await scenario.members.analyst.refresh()
    assert.equal(scenario.members.analyst.status, 'active')

    // An organization admin manages neither admins nor promotions to admin.
    const demoteAdmin = await patch(scenario.users.admin, scenario.members.admin.id, {
      role: 'editor',
    })
    demoteAdmin.assertStatus(403)
    const promoteToAdmin = await patch(scenario.users.admin, scenario.members.analyst.id, {
      role: 'admin',
    })
    promoteToAdmin.assertStatus(403)

    const lastOwner = await patch(scenario.users.owner, scenario.members.owner.id, {
      role: 'admin',
    })
    lastOwner.assertStatus(302)
    lastOwner.assertFlashMessage(
      'error',
      'A organização precisa de pelo menos um proprietário ativo. Promova outra pessoa a proprietário antes de fazer esta alteração.'
    )
    await scenario.members.owner.refresh()
    assert.equal(scenario.members.owner.role, 'owner')

    const remove = await client
      .delete(`${scenario.teamPath}/members/${scenario.members.analyst.id}`)
      .headers(headers)
      .withCsrfToken()
      .redirects(0)
      .loginAs(scenario.users.admin)
    remove.assertStatus(302)
    await scenario.members.analyst.refresh()
    assert.equal(scenario.members.analyst.status, 'removed')

    const listed = teamProps(
      await client.get(scenario.teamPath).headers(headers).loginAs(scenario.users.owner)
    )
    assert.notInclude(
      listed.members.map((member) => member.id),
      scenario.members.analyst.id
    )

    const removedAgain = await patch(scenario.users.owner, scenario.members.analyst.id, {
      status: 'active',
    })
    removedAgain.assertFlashMessage(
      'error',
      'Quem foi removido da equipe só volta com um novo convite.'
    )
  })
})
