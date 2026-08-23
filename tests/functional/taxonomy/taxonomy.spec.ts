import { test } from '@japa/runner'
import testUtils from '@adonisjs/core/services/test_utils'
import db from '@adonisjs/lucid/services/db'

import Category from '#modules/taxonomy/models/category'
import CategoryFamily from '#modules/taxonomy/models/category_family'
import Role from '#modules/roles/models/role'
import Tenant from '#modules/tenants/models/tenant'
import User from '#modules/users/models/user'

async function createTaxonomyAdmin() {
  const tenant = await Tenant.create({
    name: 'Public Test Operation',
    slug: 'public-test',
    is_active: true,
  })
  const user = await User.create({
    full_name: 'Taxonomy Admin',
    username: 'taxonomy-admin',
    email: 'taxonomy-admin@example.com',
    password: 'password123',
    is_deleted: false,
  })
  const role = await Role.findByOrFail('slug', 'admin')

  await user.related('roles').sync([role.id])
  await user.related('tenants').sync({ [tenant.id]: { role: 'owner' } })

  return { tenant, user }
}

test.group('Taxonomy', (group) => {
  group.each.setup(() => testUtils.db().withGlobalTransaction())

  test('admin builds a typed taxonomy exposed by the public tree', async ({ client, assert }) => {
    const { tenant } = await createTaxonomyAdmin()
    const signInResponse = await client.post('/api/v1/sessions/sign-in').json({
      uid: 'taxonomy-admin@example.com',
      password: 'password123',
    })
    signInResponse.assertStatus(200)
    const accessToken = signInResponse.body().auth.access_token as string
    const headers = {
      'Authorization': `Bearer ${accessToken}`,
      'x-tenant-id': String(tenant.id),
    }

    const familyResponse = await client
      .post('/api/v1/admin/taxonomy/families')
      .headers(headers)
      .json({ name: 'Comer & Beber', icon: 'utensils' })
    familyResponse.assertStatus(201)
    assert.equal(familyResponse.body().slug, 'comer-e-beber')

    const categoryResponse = await client
      .post('/api/v1/admin/taxonomy/categories')
      .headers(headers)
      .json({ family_id: familyResponse.body().id, name: 'Restaurantes' })
    categoryResponse.assertStatus(201)

    const subcategoryResponse = await client
      .post('/api/v1/admin/taxonomy/categories')
      .headers(headers)
      .json({
        family_id: familyResponse.body().id,
        parent_id: categoryResponse.body().id,
        name: 'Pizzarias',
      })
    subcategoryResponse.assertStatus(201)

    const attributeResponse = await client
      .post('/api/v1/admin/taxonomy/attributes')
      .headers(headers)
      .json({
        category_id: categoryResponse.body().id,
        key: 'faixa de preço',
        name: 'Faixa de preço',
        data_type: 'single_select',
        is_filterable: true,
      })
    attributeResponse.assertStatus(201)
    assert.equal(attributeResponse.body().key, 'faixa_de_preco')

    const optionResponse = await client
      .post('/api/v1/admin/taxonomy/attribute-options')
      .headers(headers)
      .json({
        attribute_definition_id: attributeResponse.body().id,
        label: 'Moderado',
      })
    optionResponse.assertStatus(201)
    assert.equal(optionResponse.body().value, 'moderado')

    const publicResponse = await client.get('/api/v1/catalog/categories')
    publicResponse.assertStatus(200)
    assert.lengthOf(publicResponse.body(), 1)
    assert.equal(publicResponse.body()[0].slug, 'comer-e-beber')
    assert.equal(publicResponse.body()[0].categories[0].slug, 'restaurantes')
    assert.equal(publicResponse.body()[0].categories[0].children[0].slug, 'pizzarias')
    assert.equal(
      publicResponse.body()[0].categories[0].attribute_definitions[0].options[0].value,
      'moderado'
    )
  })

  test('rejects a third category level', async ({ client }) => {
    const { tenant } = await createTaxonomyAdmin()
    const family = await CategoryFamily.create({
      tenant_id: tenant.id,
      name: 'Family',
      slug: 'family',
      description: null,
      icon: null,
      sort_order: 0,
      is_active: true,
    })
    const parent = await Category.create({
      tenant_id: tenant.id,
      family_id: family.id,
      parent_id: null,
      name: 'Parent',
      slug: 'parent',
      description: null,
      icon: null,
      sort_order: 0,
      is_active: true,
    })
    const child = await Category.create({
      tenant_id: tenant.id,
      family_id: family.id,
      parent_id: parent.id,
      name: 'Child',
      slug: 'child',
      description: null,
      icon: null,
      sort_order: 0,
      is_active: true,
    })
    const signInResponse = await client.post('/api/v1/sessions/sign-in').json({
      uid: 'taxonomy-admin@example.com',
      password: 'password123',
    })
    const accessToken = signInResponse.body().auth.access_token as string

    const response = await client
      .post('/api/v1/admin/taxonomy/categories')
      .header('Authorization', `Bearer ${accessToken}`)
      .header('x-tenant-id', String(tenant.id))
      .json({ family_id: family.id, parent_id: child.id, name: 'Third Level' })

    response.assertStatus(400)
  })

  test('rejects options for non-select attributes', async ({ client }) => {
    const { tenant } = await createTaxonomyAdmin()
    const family = await CategoryFamily.create({
      tenant_id: tenant.id,
      name: 'Family',
      slug: 'family',
      description: null,
      icon: null,
      sort_order: 0,
      is_active: true,
    })
    const category = await Category.create({
      tenant_id: tenant.id,
      family_id: family.id,
      parent_id: null,
      name: 'Category',
      slug: 'category',
      description: null,
      icon: null,
      sort_order: 0,
      is_active: true,
    })
    const [definition] = await db
      .table('category_attribute_definitions')
      .insert({
        tenant_id: tenant.id,
        category_id: category.id,
        key: 'website',
        name: 'Website',
        data_type: 'url',
        is_required: false,
        is_filterable: false,
        is_public: true,
        applies_to_descendants: true,
        sort_order: 0,
        is_active: true,
        validation_rules: {},
      })
      .returning('id')
    const signInResponse = await client.post('/api/v1/sessions/sign-in').json({
      uid: 'taxonomy-admin@example.com',
      password: 'password123',
    })
    const accessToken = signInResponse.body().auth.access_token as string

    const response = await client
      .post('/api/v1/admin/taxonomy/attribute-options')
      .header('Authorization', `Bearer ${accessToken}`)
      .header('x-tenant-id', String(tenant.id))
      .json({ attribute_definition_id: definition.id, label: 'Invalid' })

    response.assertStatus(400)
  })

  test('database rejects cross-operation family and parent references', async ({ assert }) => {
    const firstTenant = await Tenant.create({ name: 'First', slug: 'first', is_active: true })
    const secondTenant = await Tenant.create({ name: 'Second', slug: 'second', is_active: true })
    const family = await CategoryFamily.create({
      tenant_id: firstTenant.id,
      name: 'First Family',
      slug: 'first-family',
      description: null,
      icon: null,
      sort_order: 0,
      is_active: true,
    })

    await assert.rejects(() =>
      db.table('categories').insert({
        tenant_id: secondTenant.id,
        family_id: family.id,
        parent_id: null,
        name: 'Invalid Category',
        slug: 'invalid-category',
        sort_order: 0,
        is_active: true,
      })
    )
  })

  test('public tree excludes inactive families, categories and options', async ({
    client,
    assert,
  }) => {
    const { tenant } = await createTaxonomyAdmin()
    const activeFamily = await CategoryFamily.create({
      tenant_id: tenant.id,
      name: 'Active Family',
      slug: 'active-family',
      description: null,
      icon: null,
      sort_order: 0,
      is_active: true,
    })
    const inactiveFamily = await CategoryFamily.create({
      tenant_id: tenant.id,
      name: 'Inactive Family',
      slug: 'inactive-family',
      description: null,
      icon: null,
      sort_order: 10,
      is_active: false,
    })

    await Category.create({
      tenant_id: tenant.id,
      family_id: activeFamily.id,
      parent_id: null,
      name: 'Active Category',
      slug: 'active-category',
      description: null,
      icon: null,
      sort_order: 0,
      is_active: true,
    })
    await Category.create({
      tenant_id: tenant.id,
      family_id: activeFamily.id,
      parent_id: null,
      name: 'Inactive Category',
      slug: 'inactive-category',
      description: null,
      icon: null,
      sort_order: 10,
      is_active: false,
    })
    await Category.create({
      tenant_id: tenant.id,
      family_id: inactiveFamily.id,
      parent_id: null,
      name: 'Hidden by Family',
      slug: 'hidden-by-family',
      description: null,
      icon: null,
      sort_order: 0,
      is_active: true,
    })

    const response = await client.get('/api/v1/catalog/categories')
    response.assertStatus(200)
    assert.lengthOf(response.body(), 1)
    assert.equal(response.body()[0].slug, 'active-family')
    assert.deepEqual(
      response.body()[0].categories.map((category: { slug: string }) => category.slug),
      ['active-category']
    )
  })
})
