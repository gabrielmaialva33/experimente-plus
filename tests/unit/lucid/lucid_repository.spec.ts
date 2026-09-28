import { test } from '@japa/runner'
import app from '@adonisjs/core/services/app'
import testUtils from '@adonisjs/core/services/test_utils'
import db from '@adonisjs/lucid/services/db'

import Tenant from '#modules/tenants/models/tenant'
import TenantRepository from '#modules/tenants/repositories/tenant_repository'

test.group('LucidRepository', (group) => {
  group.each.setup(() => testUtils.db().withGlobalTransaction())

  test('should preserve false as a legitimate lookup value', async ({ assert }) => {
    await Tenant.create({ name: 'Active', slug: 'repository-active', is_active: true })
    const inactive = await Tenant.create({
      name: 'Inactive',
      slug: 'repository-inactive',
      is_active: false,
    })
    const repository = await app.container.make(TenantRepository)

    const result = await repository.findBy('is_active', false)

    assert.equal(result?.id, inactive.id)
  })

  test('should bind the rows it returns to the caller transaction', async ({ assert }) => {
    const tenant = await Tenant.create({ name: 'Bound', slug: 'repository-bound', is_active: true })
    const repository = await app.container.make(TenantRepository)

    // A row read inside a transaction and then saved must be written by that
    // transaction: otherwise the write survives its rollback, and a row the
    // transaction locked would wait on the transaction's own lock.
    const trx = await db.transaction()
    const found = await repository.findBy('id', tenant.id, { client: trx })
    assert.strictEqual(found?.$trx, trx)

    found!.name = 'Renamed inside the transaction'
    await found!.save()
    await trx.rollback()

    await tenant.refresh()
    assert.equal(tenant.name, 'Bound')
  })

  test('should reject unknown sort keys before building the query', async ({ assert }) => {
    const repository = await app.container.make(TenantRepository)

    await assert.rejects(
      () => repository.paginate({ sortBy: 'not_a_column' }),
      /Invalid sort key: not_a_column/
    )
  })
})
