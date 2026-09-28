import { test } from '@japa/runner'
import testUtils from '@adonisjs/core/services/test_utils'

import Organization from '#modules/organizations/models/organization'
import {
  createOperation,
  createOrganization,
  createUser,
  organizationPayload,
} from '#tests/functional/organizations/helpers'

/**
 * The Portal organization form against the service's own rules. A partner
 * testing the beta typed a CNPJ whose check digit did not match; the service
 * refused it with an English 400 and the Inertia visit showed that response
 * raw. These rules now come back under their fields, in Portuguese.
 */
test.group('Portal organization form | service rules', (group) => {
  group.each.setup(() => testUtils.db().withGlobalTransaction())

  async function partner(prefix: string) {
    const tenant = await createOperation(prefix)
    const user = await createUser({ prefix: `${prefix}-partner`, tenant })
    return { tenant, user, headers: { 'x-tenant-id': String(tenant.id), 'x-inertia': 'true' } }
  }

  test('puts a CNPJ with a wrong check digit under its field', async ({ client, assert }) => {
    const { tenant, user, headers } = await partner('form-cnpj')

    const response = await client
      .post('/portal/organizations')
      .headers({ ...headers, referer: '/portal/organizations/new' })
      .withCsrfToken()
      .redirects(0)
      .loginAs(user)
      .json({ ...organizationPayload(), tax_id: '12.345.678/0001-00' })

    response.assertStatus(302)
    response.assertHeader('location', '/portal/organizations/new')
    response.assertFlashMessage('errors', { tax_id: 'CNPJ inválido. Confira os 14 números.' })
    assert.isNull(await Organization.query().where('tenant_id', tenant.id).first())
  })

  test('says a CNPJ already registered in the operation is taken', async ({ client }) => {
    const { tenant, user, headers } = await partner('form-taken')
    const existing = await createOrganization({ tenant, prefix: 'Casa Tomada' })

    const response = await client
      .post('/portal/organizations')
      .headers(headers)
      .withCsrfToken()
      .redirects(0)
      .loginAs(user)
      .json({ ...organizationPayload(), tax_id: existing.tax_id })

    response.assertStatus(302)
    response.assertFlashMessage('errors', {
      tax_id:
        'Este CNPJ já tem cadastro no Experimente+. Se o negócio é seu, peça acesso a quem administra a organização.',
    })
  })

  test('asks for the area code when the phone is too short', async ({ client }) => {
    const { user, headers } = await partner('form-phone')

    const response = await client
      .post('/portal/organizations')
      .headers(headers)
      .withCsrfToken()
      .redirects(0)
      .loginAs(user)
      .json({ ...organizationPayload('223456780001'), phone: '9999-00000' })

    response.assertStatus(302)
    response.assertFlashMessage('errors', {
      phone: 'Informe o telefone com DDD, de 10 a 15 números.',
    })
  })

  test('still creates the organization when the data is right', async ({ client }) => {
    const { tenant, user, headers } = await partner('form-valid')

    const response = await client
      .post('/portal/organizations')
      .headers(headers)
      .withCsrfToken()
      .redirects(0)
      .loginAs(user)
      .json(organizationPayload('323456780001'))

    response.assertStatus(302)
    const organization = await Organization.query().where('tenant_id', tenant.id).firstOrFail()
    response.assertHeader('location', `/portal/organizations/${organization.id}`)
  })

  test('brings an unexplained Portal refusal back as a notice, not a raw 400', async ({
    client,
  }) => {
    const { tenant, user, headers } = await partner('form-empty')
    const organization = await createOrganization({ tenant, owner: user, prefix: 'Casa Vazia' })
    const page = `/portal/organizations/${organization.id}`

    // No field at all is a rule the form cannot point at a field for.
    const response = await client
      .put(page)
      .headers({ ...headers, referer: page })
      .withCsrfToken()
      .redirects(0)
      .loginAs(user)
      .json({})

    // Inertia answers a PUT with 303, so the browser follows it with a GET.
    response.assertStatus(303)
    response.assertHeader('location', page)
    response.assertFlashMessage(
      'error',
      'Não foi possível concluir. Confira os dados e tente novamente.'
    )
  })

  test('keeps the API answer to the same rule as it was', async ({ client }) => {
    const { user, headers } = await partner('form-api')

    const response = await client
      .post('/api/v1/organizations')
      .header('x-tenant-id', headers['x-tenant-id'])
      .loginAs(user)
      .json({ ...organizationPayload(), tax_id: '12.345.678/0001-00' })

    response.assertStatus(400)
    response.assertBodyContains({ message: 'CNPJ is invalid' })
  })
})
