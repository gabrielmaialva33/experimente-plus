import { test } from '@japa/runner'
import testUtils from '@adonisjs/core/services/test_utils'
import db from '@adonisjs/lucid/services/db'

import RemoveGlobalEditor from '#database/migrations/1788556800300_remove_unused_global_editor_role'
import {
  addOrganizationMember,
  createOperation,
  createOrganization,
  createUser,
} from '#tests/functional/organizations/helpers'

const migrationName = 'global_editor_role_reconciliation_test'

async function reconcile() {
  await db.transaction(async (trx) => {
    await new RemoveGlobalEditor(trx, migrationName).execUp()
  })
}

async function legacyEditor() {
  // The current Role model intentionally excludes this legacy global slug.
  const [role] = await db
    .table('roles')
    .insert({ name: 'Legacy editor', slug: 'editor' })
    .returning('id')
  return Number(role.id)
}

async function globalRoles() {
  return {
    roles: await db.from('roles').orderBy('id'),
    assignments: await db.from('user_roles').orderBy('id'),
    grants: await db.from('role_permissions').orderBy('id'),
  }
}

test.group('Legacy global editor reconciliation', (group) => {
  group.each.setup(() => testUtils.db().withGlobalTransaction())

  test('accepts an already canonical role set repeatedly and does not resurrect editor on down', async ({
    assert,
  }) => {
    const before = await globalRoles()
    assert.isNull(await db.from('roles').where('slug', 'editor').first())
    await reconcile()
    await reconcile()
    await new RemoveGlobalEditor(db.connection(), migrationName).execDown()
    assert.deepEqual(await globalRoles(), before)
  })

  test('removes only an unused global editor and preserves organization editor membership', async ({
    assert,
  }) => {
    const tenant = await createOperation('editor-repair')
    const user = await createUser({ tenant, prefix: 'editor-repair' })
    const organization = await createOrganization({ tenant, prefix: 'Editor Repair' })
    const membership = await addOrganizationMember({ tenant, organization, user, role: 'editor' })
    const membershipBefore = await db
      .from('organization_members')
      .where('id', membership.id)
      .firstOrFail()
    const before = await globalRoles()
    await legacyEditor()

    await reconcile()
    await reconcile()
    await new RemoveGlobalEditor(db.connection(), migrationName).execDown()

    assert.deepEqual(await globalRoles(), before)
    assert.deepEqual(
      await db.from('organization_members').where('id', membership.id).firstOrFail(),
      membershipBefore
    )
  })

  for (const usage of ['assignment', 'permission'] as const) {
    test(`fails closed on an unexpected ${usage} without cascading or transferring it`, async ({
      assert,
    }) => {
      const roleId = await legacyEditor()
      if (usage === 'assignment') {
        const user = await createUser({ prefix: 'legacy-editor-assigned' })
        await db.table('user_roles').insert({ user_id: user.id, role_id: roleId })
      } else {
        const permission = await db.from('permissions').firstOrFail()
        await db.table('role_permissions').insert({ permission_id: permission.id, role_id: roleId })
      }
      const before = await globalRoles()

      await assert.rejects(
        reconcile,
        /Legacy editor removal refused: unexpected assignments or permissions/
      )

      assert.deepEqual(await globalRoles(), before)
    })
  }

  test('refuses an unrecognized foreign key consumer instead of cascading its data', async ({
    assert,
  }) => {
    const roleId = await legacyEditor()
    // A synthetic undocumented dependency; this table is rolled back with the test.
    await db.rawQuery(`
      CREATE TABLE legacy_role_reference_reconciliation_test (
        role_id integer REFERENCES roles(id) ON DELETE CASCADE
      )
    `)
    await db.table('legacy_role_reference_reconciliation_test').insert({ role_id: roleId })
    const before = await globalRoles()

    await assert.rejects(
      reconcile,
      /Legacy editor removal refused: unrecognized role references require review/
    )

    assert.deepEqual(await globalRoles(), before)
    assert.deepEqual(await db.from('legacy_role_reference_reconciliation_test'), [
      { role_id: roleId },
    ])
  })

  test('refuses a new role reference column even on an otherwise recognized pivot table', async ({
    assert,
  }) => {
    const roleId = await legacyEditor()
    const user = await createUser({ prefix: 'legacy-editor-other-column' })
    await db.rawQuery(`
      ALTER TABLE user_roles ADD COLUMN legacy_editor_id integer REFERENCES roles(id) ON DELETE CASCADE
    `)
    await db.from('user_roles').where('user_id', user.id).update({ legacy_editor_id: roleId })
    const before = await globalRoles()

    await assert.rejects(
      reconcile,
      /Legacy editor removal refused: unrecognized role references require review/
    )

    assert.deepEqual(await globalRoles(), before)
  })
})
