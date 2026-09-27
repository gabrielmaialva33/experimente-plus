import { test } from '@japa/runner'
import type { ApiClient } from '@japa/api-client'
import testUtils from '@adonisjs/core/services/test_utils'
import limiter from '@adonisjs/limiter/services/main'
import mail from '@adonisjs/mail/services/main'
import jwt from 'jsonwebtoken'
import { DateTime } from 'luxon'

import type { OrganizationInvitationAcceptPageProps } from '#modules/organizations/interfaces/organization_team_pages'
import type Organization from '#modules/organizations/models/organization'
import OrganizationInvitation from '#modules/organizations/models/organization_invitation'
import OrganizationMember from '#modules/organizations/models/organization_member'
import type OrganizationInvitationNotification from '#modules/organizations/services/organization_invitation_notification'
import type Tenant from '#modules/tenants/models/tenant'
import User from '#modules/users/models/user'
import { JWT_COOKIE_NAME } from '#shared/jwt/constants'
import {
  addOrganizationMember,
  createOperation,
  createOrganization,
  createUser,
} from './helpers.js'

const ACCEPT_PATH = '/organization-invitations/accept'
const SESSION_KEY = 'organization_invitation_token'

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

function acceptProps(response: { text(): string }): OrganizationInvitationAcceptPageProps {
  const page = parseInertiaPage(response)
  if (page.component !== 'organization_invitations/accept') {
    throw new Error(`Unexpected Inertia component: ${page.component}`)
  }
  return page.props as unknown as OrganizationInvitationAcceptPageProps
}

/** Invites through the web team page and returns the raw token the e-mail carries. */
async function invite(
  client: ApiClient,
  options: { tenant: Tenant; organization: Organization; inviter: User; email: string }
) {
  const { mails } = mail.fake()
  const response = await client
    .post(`/portal/organizations/${options.organization.id}/team/invitations`)
    .headers({ 'x-tenant-id': String(options.tenant.id) })
    .withCsrfToken()
    .redirects(0)
    .loginAs(options.inviter)
    .json({ email: options.email, role: 'editor' })
  response.assertStatus(302)

  const notification = mails.sent().at(-1) as OrganizationInvitationNotification
  return {
    token: notification.getInvitationToken(),
    invitation: await OrganizationInvitation.query()
      .where('organization_id', options.organization.id)
      .where('email', options.email)
      .whereNull('revoked_at')
      .firstOrFail(),
  }
}

async function invitationScenario(prefix: string) {
  const tenant = await createOperation(prefix)
  const owner = await createUser({ prefix: `${prefix}-owner`, tenant })
  const organization = await createOrganization({
    tenant,
    owner,
    status: 'active',
    prefix: 'Invited',
  })
  // The invited person has an account but no link to this operation yet.
  const invitee = await createUser({ prefix: `${prefix}-invitee` })
  return { tenant, owner, organization, invitee }
}

test.group('Organization invitation acceptance page', (group) => {
  group.each.setup(() => {
    mail.restore()
    mail.fake()
    return testUtils.db().withGlobalTransaction()
  })
  group.each.setup(async () => {
    await limiter.clear()
    return () => limiter.clear()
  })
  group.each.teardown(() => mail.restore())

  test('keeps the e-mailed token in the session and out of the address bar', async ({
    client,
    assert,
  }) => {
    const response = await client.get(`${ACCEPT_PATH}?token=abc123-token_value`).redirects(0)

    response.assertStatus(302)
    assert.equal(response.header('location'), ACCEPT_PATH)
    assert.equal(response.header('cache-control'), 'private, no-store')
    assert.equal(response.header('referrer-policy'), 'no-referrer')
    response.assertSession(SESSION_KEY, 'abc123-token_value')

    const oversized = await client.get(`${ACCEPT_PATH}?token=${'x'.repeat(300)}`).redirects(0)
    oversized.assertStatus(302)
    oversized.assertSessionMissing(SESSION_KEY)
  })

  test('explains an open invitation to a signed-out visitor without the token', async ({
    client,
    assert,
  }) => {
    const scenario = await invitationScenario('accept-guest')
    const { token } = await invite(client, {
      tenant: scenario.tenant,
      organization: scenario.organization,
      inviter: scenario.owner,
      email: 'convidada.nova@example.com',
    })

    const page = await client.get(ACCEPT_PATH).withSession({ [SESSION_KEY]: token })
    page.assertStatus(200)
    const props = acceptProps(page)
    assert.equal(props.state, 'open')
    assert.deepInclude(props.invitation!, {
      organization_name: scenario.organization.trade_name,
      role: 'editor',
      inviter_name: scenario.owner.full_name,
      email_hint: 'co•••@example.com',
    })
    assert.deepEqual(props.viewer, {
      signed_in: false,
      email: null,
      matches: false,
      membership: null,
      accepted: false,
    })
    // Neither the token nor the full invited address reaches the document.
    assert.notInclude(page.text(), token)
    assert.notInclude(page.text(), 'convidada.nova@example.com')

    const missing = acceptProps(await client.get(ACCEPT_PATH))
    assert.equal(missing.state, 'missing')
    assert.isNull(missing.invitation)

    const invalid = acceptProps(
      await client.get(ACCEPT_PATH).withSession({ [SESSION_KEY]: 'not-a-real-token-value' })
    )
    assert.equal(invalid.state, 'invalid')
    assert.isNull(invalid.invitation)
  })

  test('accepts with the invited account and continues in that operation', async ({
    client,
    assert,
  }) => {
    const scenario = await invitationScenario('accept-match')
    const { token, invitation } = await invite(client, {
      tenant: scenario.tenant,
      organization: scenario.organization,
      inviter: scenario.owner,
      email: scenario.invitee.email,
    })

    const preview = acceptProps(
      await client
        .get(ACCEPT_PATH)
        .withSession({ [SESSION_KEY]: token })
        .loginAs(scenario.invitee)
    )
    assert.equal(preview.state, 'open')
    assert.isTrue(preview.viewer.matches)
    assert.isNull(preview.viewer.membership)

    const accept = await client
      .post(ACCEPT_PATH)
      .withSession({ [SESSION_KEY]: token })
      .withCsrfToken()
      .redirects(0)
      .loginAs(scenario.invitee)
    accept.assertStatus(302)
    assert.equal(accept.header('location'), `/portal/organizations/${scenario.organization.id}`)
    accept.assertFlashMessage(
      'success',
      `Convite aceito. Você agora faz parte de ${scenario.organization.trade_name} como Editor.`
    )
    accept.assertSessionMissing(SESSION_KEY)

    const membership = await OrganizationMember.query()
      .where('organization_id', scenario.organization.id)
      .where('user_id', scenario.invitee.id)
      .firstOrFail()
    assert.equal(membership.role, 'editor')
    assert.equal(membership.status, 'active')
    await invitation.refresh()
    assert.equal(invitation.accepted_by, scenario.invitee.id)

    // The browser now works in the invitation's operation.
    const cookie = accept.cookie(JWT_COOKIE_NAME)
    assert.exists(cookie)
    const claims = jwt.decode(cookie!.value) as { tenantId?: number }
    assert.equal(claims.tenantId, scenario.tenant.id)

    const portal = await client
      .get(`/portal/organizations/${scenario.organization.id}`)
      .cookie(JWT_COOKIE_NAME, cookie!.value)
    portal.assertStatus(200)

    const used = acceptProps(
      await client
        .get(ACCEPT_PATH)
        .withSession({ [SESSION_KEY]: token })
        .loginAs(scenario.invitee)
    )
    assert.equal(used.state, 'accepted')
    assert.isTrue(used.viewer.accepted)
    assert.equal(used.portal_path, `/portal/organizations/${scenario.organization.id}`)
  })

  test('refuses another account and offers to switch', async ({ client, assert }) => {
    const scenario = await invitationScenario('accept-mismatch')
    const other = await createUser({ prefix: 'accept-mismatch-other' })
    const { token } = await invite(client, {
      tenant: scenario.tenant,
      organization: scenario.organization,
      inviter: scenario.owner,
      email: scenario.invitee.email,
    })

    const preview = acceptProps(
      await client
        .get(ACCEPT_PATH)
        .withSession({ [SESSION_KEY]: token })
        .loginAs(other)
    )
    assert.equal(preview.state, 'open')
    assert.isFalse(preview.viewer.matches)
    assert.equal(preview.viewer.email, other.email)

    const accept = await client
      .post(ACCEPT_PATH)
      .withSession({ [SESSION_KEY]: token })
      .withCsrfToken()
      .redirects(0)
      .loginAs(other)
    accept.assertStatus(302)
    assert.equal(accept.header('location'), ACCEPT_PATH)
    accept.assertFlashMessage(
      'error',
      'Você entrou com uma conta de outro e-mail. Entre com o e-mail que recebeu o convite para aceitá-lo.'
    )
    assert.isNull(
      await OrganizationMember.query()
        .where('organization_id', scenario.organization.id)
        .where('user_id', other.id)
        .first()
    )

    // "Sair e entrar com outra conta" returns to sign-in, then to the invitation.
    const logout = await client
      .post('/logout')
      .withCsrfToken()
      .redirects(0)
      .loginAs(other)
      .json({ next: ACCEPT_PATH })
    logout.assertStatus(302)
    assert.equal(logout.header('location'), `/login?next=${encodeURIComponent(ACCEPT_PATH)}`)
  })

  test('shows expired, cancelled and unavailable invitations as friendly states', async ({
    client,
    assert,
  }) => {
    const scenario = await invitationScenario('accept-terminal')
    const { token, invitation } = await invite(client, {
      tenant: scenario.tenant,
      organization: scenario.organization,
      inviter: scenario.owner,
      email: scenario.invitee.email,
    })
    const stateOf = async () =>
      acceptProps(
        await client
          .get(ACCEPT_PATH)
          .withSession({ [SESSION_KEY]: token })
          .loginAs(scenario.invitee)
      ).state

    invitation.expires_at = DateTime.now().minus({ minutes: 1 })
    await invitation.save()
    assert.equal(await stateOf(), 'expired')

    const expiredAccept = await client
      .post(ACCEPT_PATH)
      .withSession({ [SESSION_KEY]: token })
      .withCsrfToken()
      .redirects(0)
      .loginAs(scenario.invitee)
    expiredAccept.assertFlashMessage(
      'error',
      'Este convite expirou. Peça a quem convidou você para reenviá-lo.'
    )

    invitation.revoked_by = scenario.owner.id
    invitation.revoked_at = DateTime.now()
    await invitation.save()
    assert.equal(await stateOf(), 'revoked')

    invitation.revoked_by = null
    invitation.revoked_at = null
    invitation.expires_at = DateTime.now().plus({ hours: 1 })
    await invitation.save()
    scenario.organization.status = 'archived'
    await scenario.organization.save()
    assert.equal(await stateOf(), 'unavailable')
  })

  test('does not reactivate a suspended member through an invitation', async ({
    client,
    assert,
  }) => {
    const scenario = await invitationScenario('accept-suspended')
    await addOrganizationMember({
      tenant: scenario.tenant,
      organization: scenario.organization,
      user: scenario.invitee,
      role: 'analyst',
      status: 'suspended',
    })
    const { token } = await invite(client, {
      tenant: scenario.tenant,
      organization: scenario.organization,
      inviter: scenario.owner,
      email: scenario.invitee.email,
    })

    const preview = acceptProps(
      await client
        .get(ACCEPT_PATH)
        .withSession({ [SESSION_KEY]: token })
        .loginAs(scenario.invitee)
    )
    assert.equal(preview.viewer.membership, 'suspended')

    const accept = await client
      .post(ACCEPT_PATH)
      .withSession({ [SESSION_KEY]: token })
      .withCsrfToken()
      .redirects(0)
      .loginAs(scenario.invitee)
    accept.assertFlashMessage(
      'error',
      'Seu acesso a esta organização está suspenso. Peça a um proprietário ou administrador para reativá-lo.'
    )
    const membership = await OrganizationMember.query()
      .where('organization_id', scenario.organization.id)
      .where('user_id', scenario.invitee.id)
      .firstOrFail()
    assert.equal(membership.status, 'suspended')
  })

  test('returns to the invitation after signing in or signing up', async ({ client, assert }) => {
    const scenario = await invitationScenario('accept-return')
    const { token } = await invite(client, {
      tenant: scenario.tenant,
      organization: scenario.organization,
      inviter: scenario.owner,
      email: 'nova-conta@example.com',
    })

    const loginPage = parseInertiaPage(await client.get(`/login?next=${ACCEPT_PATH}`))
    assert.equal(loginPage.props.next, ACCEPT_PATH)
    const unsafeLoginPage = parseInertiaPage(await client.get('/login?next=https://example.com'))
    assert.isNull(unsafeLoginPage.props.next)

    const login = await client
      .post('/login')
      .withCsrfToken()
      .redirects(0)
      .json({ uid: scenario.invitee.email, password: 'password123', next: ACCEPT_PATH })
    login.assertStatus(302)
    assert.equal(login.header('location'), ACCEPT_PATH)

    const openRedirect = await client
      .post('/login')
      .withCsrfToken()
      .redirects(0)
      .json({ uid: scenario.invitee.email, password: 'password123', next: '//example.com' })
    openRedirect.assertStatus(302)
    assert.notInclude(openRedirect.header('location'), 'example.com')

    // Sign-up pre-fills the invited address only for the browser holding the link.
    const registerWithInvitation = parseInertiaPage(
      await client.get(`/register?next=${ACCEPT_PATH}`).withSession({ [SESSION_KEY]: token })
    )
    assert.deepEqual(registerWithInvitation.props.invitation, {
      email: 'nova-conta@example.com',
      organization_name: scenario.organization.trade_name,
    })
    const registerWithoutLink = parseInertiaPage(await client.get(`/register?next=${ACCEPT_PATH}`))
    assert.isNull(registerWithoutLink.props.invitation)
    const registerWithoutNext = parseInertiaPage(
      await client.get('/register').withSession({ [SESSION_KEY]: token })
    )
    assert.isNull(registerWithoutNext.props.invitation)

    const register = await client.post('/register').withCsrfToken().redirects(0).json({
      full_name: 'Nova Conta',
      email: 'nova-conta@example.com',
      password: 'password123',
      password_confirmation: 'password123',
      terms_accepted: true,
      next: ACCEPT_PATH,
    })
    register.assertStatus(302)
    assert.equal(register.header('location'), ACCEPT_PATH)
    assert.exists(await User.findBy('email', 'nova-conta@example.com'))
  })
})
