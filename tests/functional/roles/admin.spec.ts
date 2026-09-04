import { test } from '@japa/runner'
import app from '@adonisjs/core/services/app'
import testUtils from '@adonisjs/core/services/test_utils'

import db from '@adonisjs/lucid/services/db'

import Permission from '#modules/permissions/models/permission'
import PermissionCacheService from '#modules/permissions/services/permission_cache_service'
import Role from '#modules/roles/models/role'
import User from '#modules/users/models/user'

import IPermission from '#modules/permissions/interfaces/permission_interface'
import IRole from '#modules/roles/interfaces/role_interface'

test.group('Roles admin', (group) => {
  group.each.setup(() => testUtils.db().withGlobalTransaction())

  test('should list roles with an exact paginated contract', async ({ client, assert }) => {
    const adminRole = await Role.firstOrCreate(
      { slug: IRole.Slugs.ADMIN },
      {
        name: 'Admin',
        slug: IRole.Slugs.ADMIN,
        description: 'Administrator role',
      }
    )

    const userRole = await Role.firstOrCreate(
      { slug: IRole.Slugs.USER },
      {
        name: 'User',
        slug: IRole.Slugs.USER,
        description: 'Regular user role',
      }
    )

    const adminUser = await User.create({
      full_name: 'Admin User',
      email: 'admin@example.com',
      username: 'adminuser',
      password: 'password123',
    })

    await adminUser.related('roles').sync([adminRole.id])

    const response = await client.get('/api/v1/admin/roles').loginAs(adminUser)

    response.assertStatus(200)
    response.assertBodyContains({
      data: [
        {
          id: adminRole.id,
          name: adminRole.name,
          slug: adminRole.slug,
        },
        {
          id: userRole.id,
          name: userRole.name,
          slug: userRole.slug,
        },
      ],
    })
    assert.sameMembers(Object.keys(response.body()), ['meta', 'data'])
    assert.sameMembers(Object.keys(response.body().meta), [
      'total',
      'per_page',
      'current_page',
      'last_page',
      'first_page',
      'first_page_url',
      'last_page_url',
      'next_page_url',
      'previous_page_url',
    ])
  })

  test('should use canonical list defaults and ignore pagination fields from the body', async ({
    client,
    assert,
  }) => {
    const adminRole = await Role.findByOrFail('slug', IRole.Slugs.ADMIN)
    const admin = await User.create({
      full_name: 'Role List Contract Admin',
      email: 'role-list-contract-admin@example.com',
      username: 'role-list-contract-admin',
      password: 'password123',
    })
    await admin.related('roles').attach([adminRole.id])

    const response = await client
      .get('/api/v1/admin/roles')
      .unsafeJson({
        page: 2,
        per_page: 1,
        sort_by: 'name',
        order: 'desc',
      })
      .loginAs(admin)

    response.assertStatus(200)
    response.assertBodyContains({
      meta: {
        per_page: 10,
        current_page: 1,
      },
    })

    const ids = response.body().data.map((role: { id: number }) => role.id)
    assert.deepEqual(
      ids,
      [...ids].sort((left, right) => left - right)
    )
  })

  test('should enforce the canonical role-list pagination cap', async ({ client }) => {
    const adminRole = await Role.findByOrFail('slug', IRole.Slugs.ADMIN)
    const admin = await User.create({
      full_name: 'Role List Cap Admin',
      email: 'role-list-cap-admin@example.com',
      username: 'role-list-cap-admin',
      password: 'password123',
    })
    await admin.related('roles').attach([adminRole.id])

    const capped = await client
      .get('/api/v1/admin/roles')
      .qs({ page: 1, per_page: 100 })
      .loginAs(admin)
    capped.assertStatus(200)
    capped.assertBodyContains({ meta: { current_page: 1, per_page: 100 } })

    const aboveCap = await client
      .get('/api/v1/admin/roles')
      .qs({ page: 1, per_page: 101 })
      .loginAs(admin)
    aboveCap.assertStatus(422)
  })

  test('should reject malformed, overflowing, aliased, and unsafe role-list queries', async ({
    client,
  }) => {
    const adminRole = await Role.findByOrFail('slug', IRole.Slugs.ADMIN)
    const admin = await User.create({
      full_name: 'Role List Validation Admin',
      email: 'role-list-validation-admin@example.com',
      username: 'role-list-validation-admin',
      password: 'password123',
    })
    await admin.related('roles').attach([adminRole.id])

    const invalidQueries = [
      { page: '1.0' },
      { page: '1e2' },
      { page: '2147483648' },
      { sort_by: 'users_count' },
      { order: 'sideways' },
      { perPage: '25' },
    ]

    for (const query of invalidQueries) {
      const response = await client.get('/api/v1/admin/roles').qs(query).loginAs(admin)
      response.assertStatus(422)
    }
  })

  test('should list roles with root permission', async ({ client, assert }) => {
    const rootRole = await Role.firstOrCreate(
      { slug: IRole.Slugs.ROOT },
      {
        name: 'Root',
        slug: IRole.Slugs.ROOT,
        description: 'Root administrator role',
      }
    )

    const rootUser = await User.create({
      full_name: 'Root User',
      email: 'root@example.com',
      username: 'rootuser',
      password: 'password123',
    })

    await rootUser.related('roles').sync([rootRole.id])

    const response = await client.get('/api/v1/admin/roles').loginAs(rootUser)

    response.assertStatus(200)
    assert.properties(response.body(), ['data', 'meta'])
  })

  test('should list non-canonical compatibility roles without granting them authority', async ({
    client,
    assert,
  }) => {
    const rootRole = await Role.findByOrFail('slug', IRole.Slugs.ROOT)
    const root = await User.create({
      full_name: 'Compatibility Role Auditor',
      email: 'compatibility-role-auditor@example.com',
      username: 'compatibility-role-auditor',
      password: 'password123',
    })
    await root.related('roles').attach([rootRole.id])

    const compatibilityRole = await Role.create({
      name: 'Legacy Operator',
      slug: 'legacy-operator' as IRole.Slugs,
      description: 'Visible for migration and audit only',
    })

    const response = await client
      .get('/api/v1/admin/roles')
      .qs({ sort_by: 'slug', order: 'asc' })
      .loginAs(root)

    response.assertStatus(200)
    const serializedRole = response
      .body()
      .data.find((role: { id: number }) => role.id === compatibilityRole.id)
    assert.exists(serializedRole)
    assert.sameMembers(Object.keys(serializedRole), [
      'id',
      'name',
      'description',
      'slug',
      'created_at',
      'updated_at',
    ])
    assert.equal(serializedRole.slug, 'legacy-operator')
    assert.isFalse(IRole.isCanonicalSlug(serializedRole.slug))
  })

  test('should deny access for regular users', async ({ client }) => {
    const userRole = await Role.firstOrCreate(
      { slug: IRole.Slugs.USER },
      {
        name: 'User',
        slug: IRole.Slugs.USER,
        description: 'Regular user role',
      }
    )

    const regularUser = await User.create({
      full_name: 'Regular User',
      email: 'regular@example.com',
      username: 'regularuser',
      password: 'password123',
    })

    await regularUser.related('roles').sync([userRole.id])

    const response = await client.get('/api/v1/admin/roles').loginAs(regularUser)

    response.assertStatus(403)
    response.assertBodyContains({
      message: 'Permission denied',
    })
  })

  test('should require roles.list and roles.assign in addition to the admin ACL', async ({
    client,
    assert,
  }) => {
    const adminRole = await Role.findByOrFail('slug', IRole.Slugs.ADMIN)
    const listPermission = await Permission.findByOrFail(
      'name',
      `${IPermission.Resources.ROLES}.${IPermission.Actions.LIST}`
    )
    const assignPermission = await Permission.findByOrFail(
      'name',
      `${IPermission.Resources.ROLES}.${IPermission.Actions.ASSIGN}`
    )
    const admin = await User.create({
      full_name: 'Revoked Role Permission Admin',
      email: 'revoked-role-permission-admin@example.com',
      username: 'revoked-role-permission-admin',
      password: 'password123',
    })
    const target = await User.create({
      full_name: 'Revoked Role Permission Target',
      email: 'revoked-role-permission-target@example.com',
      username: 'revoked-role-permission-target',
      password: 'password123',
    })
    const userRole = await Role.findByOrFail('slug', IRole.Slugs.USER)
    await admin.related('roles').attach([adminRole.id])

    const permissionCache = await app.container.make(PermissionCacheService)

    await adminRole.related('permissions').detach([listPermission.id])
    await permissionCache.invalidateUserCache(admin.id)
    const deniedList = await client.get('/api/v1/admin/roles').loginAs(admin)
    deniedList.assertStatus(403)

    await adminRole.related('permissions').attach([listPermission.id])
    await adminRole.related('permissions').detach([assignPermission.id])
    await permissionCache.invalidateUserCache(admin.id)
    const deniedAssignment = await client
      .put('/api/v1/admin/roles/attach')
      .json({ user_id: target.id, role_ids: [userRole.id] })
      .loginAs(admin)
    deniedAssignment.assertStatus(403)

    const rows = await db.from('user_roles').where('user_id', target.id)
    assert.lengthOf(rows, 0)
  })

  test('should let admin attach lower canonical roles', async ({ client, assert }) => {
    const adminRole = await Role.firstOrCreate(
      { slug: IRole.Slugs.ADMIN },
      {
        name: 'Admin',
        slug: IRole.Slugs.ADMIN,
        description: 'Administrator role',
      }
    )

    const userRole = await Role.firstOrCreate(
      { slug: IRole.Slugs.USER },
      {
        name: 'User',
        slug: IRole.Slugs.USER,
        description: 'User role',
      }
    )
    const moderatorRole = await Role.firstOrCreate(
      { slug: IRole.Slugs.MODERATOR },
      {
        name: 'Moderator',
        slug: IRole.Slugs.MODERATOR,
        description: 'Moderator role',
      }
    )

    const adminUser = await User.create({
      full_name: 'Admin User',
      email: 'admin@example.com',
      username: 'adminuser',
      password: 'password123',
    })

    await adminUser.related('roles').sync([adminRole.id])

    const targetUser = await User.create({
      full_name: 'Target User',
      email: 'target@example.com',
      username: 'targetuser',
      password: 'password123',
    })

    const response = await client
      .put('/api/v1/admin/roles/attach')
      .json({
        user_id: targetUser.id,
        role_ids: [moderatorRole.id, userRole.id],
      })
      .loginAs(adminUser)

    response.assertStatus(200)
    response.assertBodyContains({
      message: 'Role attached successfully',
    })

    const userRoles = await db
      .from('user_roles')
      .where('user_id', targetUser.id)
      .whereIn('role_id', [moderatorRole.id, userRole.id])

    assert.lengthOf(userRoles, 2)
  })

  test('should reserve equal and higher role assignments for root actors', async ({
    client,
    assert,
  }) => {
    const rootRole = await Role.firstOrCreate(
      { slug: IRole.Slugs.ROOT },
      { name: 'Root', slug: IRole.Slugs.ROOT, description: 'Root administrator role' }
    )
    const adminRole = await Role.firstOrCreate(
      { slug: IRole.Slugs.ADMIN },
      { name: 'Admin', slug: IRole.Slugs.ADMIN, description: 'Administrator role' }
    )
    const admin = await User.create({
      full_name: 'Role Boundary Admin',
      email: 'role-boundary-admin@example.com',
      username: 'role-boundary-admin',
      password: 'password123',
    })
    const root = await User.create({
      full_name: 'Role Boundary Root',
      email: 'role-boundary-root@example.com',
      username: 'role-boundary-root',
      password: 'password123',
    })
    const target = await User.create({
      full_name: 'Role Boundary Target',
      email: 'role-boundary-target@example.com',
      username: 'role-boundary-target',
      password: 'password123',
    })
    await admin.related('roles').attach([adminRole.id])
    await root.related('roles').attach([rootRole.id])

    for (const protectedRole of [adminRole, rootRole]) {
      const forbidden = await client
        .put('/api/v1/admin/roles/attach')
        .json({ user_id: target.id, role_ids: [protectedRole.id] })
        .loginAs(admin)
      forbidden.assertStatus(403)
      forbidden.assertBodyContains({
        message: 'You cannot assign an equal or higher platform role to this user',
      })
      forbidden.assertHeader('cache-control', 'private, no-store')
    }

    const protectedRows = await db
      .from('user_roles')
      .where('user_id', target.id)
      .whereIn('role_id', [adminRole.id, rootRole.id])
    assert.lengthOf(protectedRows, 0)

    const allowed = await client
      .put('/api/v1/admin/roles/attach')
      .json({ user_id: target.id, role_ids: [rootRole.id] })
      .loginAs(root)
    allowed.assertStatus(200)

    const rootAssignment = await db
      .from('user_roles')
      .where('user_id', target.id)
      .where('role_id', rootRole.id)
    assert.lengthOf(rootAssignment, 1)
  })

  test('should reject self-assignment and fail closed for a custom platform role', async ({
    client,
    assert,
  }) => {
    const rootRole = await Role.findByOrFail('slug', IRole.Slugs.ROOT)
    const userRole = await Role.findByOrFail('slug', IRole.Slugs.USER)
    const root = await User.create({
      full_name: 'Self Assignment Root',
      email: 'self-assignment-root@example.com',
      username: 'self-assignment-root',
      password: 'password123',
    })
    await root.related('roles').attach([rootRole.id])

    const selfAssignment = await client
      .put('/api/v1/admin/roles/attach')
      .json({ user_id: root.id, role_ids: [userRole.id] })
      .loginAs(root)
    selfAssignment.assertStatus(403)
    selfAssignment.assertBodyContains({ message: 'You cannot assign platform roles to yourself' })

    const customRole = await Role.create({
      name: 'Custom Operator',
      slug: 'custom-operator' as IRole.Slugs,
      description: 'Non-canonical compatibility role',
    })
    const customTarget = await User.create({
      full_name: 'Custom Role Target',
      email: 'custom-role-target@example.com',
      username: 'custom-role-target',
      password: 'password123',
    })
    await customTarget.related('roles').attach([customRole.id])

    const customRoleBoundary = await client
      .put('/api/v1/admin/roles/attach')
      .json({ user_id: customTarget.id, role_ids: [userRole.id] })
      .loginAs(root)
    customRoleBoundary.assertStatus(403)
    customRoleBoundary.assertBodyContains({
      message: 'A non-canonical platform role blocks this operation',
    })

    const canonicalTarget = await User.create({
      full_name: 'Canonical Role Target',
      email: 'canonical-role-target@example.com',
      username: 'canonical-role-target',
      password: 'password123',
    })
    const customAssignment = await client
      .put('/api/v1/admin/roles/attach')
      .json({ user_id: canonicalTarget.id, role_ids: [customRole.id] })
      .loginAs(root)
    customAssignment.assertStatus(403)
    customAssignment.assertBodyContains({
      message: 'A non-canonical platform role blocks this operation',
    })

    const selfRows = await db
      .from('user_roles')
      .where('user_id', root.id)
      .where('role_id', userRole.id)
    assert.lengthOf(selfRows, 0)
  })

  test('should read role assignment fields only from the request body', async ({ client }) => {
    const adminRole = await Role.firstOrCreate(
      { slug: IRole.Slugs.ADMIN },
      { name: 'Admin', slug: IRole.Slugs.ADMIN, description: 'Administrator role' }
    )
    const userRole = await Role.firstOrCreate(
      { slug: IRole.Slugs.USER },
      { name: 'User', slug: IRole.Slugs.USER, description: 'Regular user role' }
    )
    const admin = await User.create({
      full_name: 'Role Body Admin',
      email: 'role-body-admin@example.com',
      username: 'role-body-admin',
      password: 'password123',
    })
    const target = await User.create({
      full_name: 'Role Body Target',
      email: 'role-body-target@example.com',
      username: 'role-body-target',
      password: 'password123',
    })
    await admin.related('roles').attach([adminRole.id])

    const queryOnly = await client
      .put('/api/v1/admin/roles/attach')
      .qs({ user_id: target.id, role_ids: [userRole.id] })
      .json({})
      .loginAs(admin)
    queryOnly.assertStatus(422)
    queryOnly.assertBodyContains({
      errors: [
        { field: 'user_id', rule: 'required' },
        { field: 'role_ids', rule: 'required' },
      ],
    })
  })

  test('should validate attach role payload', async ({ client }) => {
    const adminRole = await Role.firstOrCreate(
      { slug: IRole.Slugs.ADMIN },
      {
        name: 'Admin',
        slug: IRole.Slugs.ADMIN,
        description: 'Administrator role',
      }
    )

    const adminUser = await User.create({
      full_name: 'Admin User',
      email: 'admin@example.com',
      username: 'adminuser',
      password: 'password123',
    })

    await adminUser.related('roles').sync([adminRole.id])

    const response = await client
      .put('/api/v1/admin/roles/attach')
      .header('Accept', 'application/json')
      .json({})
      .loginAs(adminUser)

    response.assertStatus(422)
    response.assertBodyContains({
      errors: [
        {
          field: 'user_id',
          rule: 'required',
        },
        {
          field: 'role_ids',
          rule: 'required',
        },
      ],
    })

    const stringIds = await client
      .put('/api/v1/admin/roles/attach')
      .json({ user_id: String(adminUser.id), role_ids: [String(adminRole.id)] })
      .loginAs(adminUser)
    stringIds.assertStatus(422)

    const outOfRangeIds = await client
      .put('/api/v1/admin/roles/attach')
      .json({ user_id: 2_147_483_648, role_ids: [2_147_483_648] })
      .loginAs(adminUser)
    outOfRangeIds.assertStatus(422)

    const duplicateRoles = await client
      .put('/api/v1/admin/roles/attach')
      .json({ user_id: adminUser.id, role_ids: [adminRole.id, adminRole.id] })
      .loginAs(adminUser)
    duplicateRoles.assertStatus(422)

    const excessiveRoles = await client
      .put('/api/v1/admin/roles/attach')
      .json({
        user_id: adminUser.id,
        role_ids: Array.from({ length: IRole.CANONICAL_SLUGS.length + 1 }, (_, index) => index + 1),
      })
      .loginAs(adminUser)
    excessiveRoles.assertStatus(422)
  })

  test('should handle non-existent user when attaching role', async ({ client }) => {
    const adminRole = await Role.firstOrCreate(
      { slug: IRole.Slugs.ADMIN },
      {
        name: 'Admin',
        slug: IRole.Slugs.ADMIN,
        description: 'Administrator role',
      }
    )

    const userRole = await Role.firstOrCreate(
      { slug: IRole.Slugs.USER },
      {
        name: 'User',
        slug: IRole.Slugs.USER,
        description: 'Regular user role',
      }
    )

    const adminUser = await User.create({
      full_name: 'Admin User',
      email: 'admin@example.com',
      username: 'adminuser',
      password: 'password123',
    })

    await adminUser.related('roles').sync([adminRole.id])

    const response = await client
      .put('/api/v1/admin/roles/attach')
      .json({
        user_id: 999999,
        role_ids: [userRole.id],
      })
      .loginAs(adminUser)

    response.assertStatus(404)
    response.assertBodyContains({
      message: 'User not found',
    })
  })

  test('should handle non-existent role when attaching', async ({ client }) => {
    const adminRole = await Role.firstOrCreate(
      { slug: IRole.Slugs.ADMIN },
      {
        name: 'Admin',
        slug: IRole.Slugs.ADMIN,
        description: 'Administrator role',
      }
    )

    const adminUser = await User.create({
      full_name: 'Admin User',
      email: 'admin@example.com',
      username: 'adminuser',
      password: 'password123',
    })

    await adminUser.related('roles').sync([adminRole.id])

    const targetUser = await User.create({
      full_name: 'Target User',
      email: 'target@example.com',
      username: 'targetuser',
      password: 'password123',
    })

    const response = await client
      .put('/api/v1/admin/roles/attach')
      .json({
        user_id: targetUser.id,
        role_ids: [999999],
      })
      .loginAs(adminUser)

    response.assertStatus(404)
    response.assertBodyContains({
      message: 'Role not found',
    })
  })

  test('should make duplicate role attachment idempotent', async ({ client, assert }) => {
    const adminRole = await Role.firstOrCreate(
      { slug: IRole.Slugs.ADMIN },
      {
        name: 'Admin',
        slug: IRole.Slugs.ADMIN,
        description: 'Administrator role',
      }
    )

    const userRole = await Role.firstOrCreate(
      { slug: IRole.Slugs.USER },
      {
        name: 'User',
        slug: IRole.Slugs.USER,
        description: 'Regular user role',
      }
    )

    const adminUser = await User.create({
      full_name: 'Admin User',
      email: 'admin@example.com',
      username: 'adminuser',
      password: 'password123',
    })

    await adminUser.related('roles').sync([adminRole.id])

    const targetUser = await User.create({
      full_name: 'Target User',
      email: 'target@example.com',
      username: 'targetuser',
      password: 'password123',
    })

    // First attachment
    await targetUser.related('roles').sync([userRole.id])

    // Try to attach same role again
    const response = await client
      .put('/api/v1/admin/roles/attach')
      .json({
        user_id: targetUser.id,
        role_ids: [userRole.id],
      })
      .loginAs(adminUser)

    response.assertStatus(200)
    response.assertBodyContains({
      message: 'Role attached successfully',
    })

    const rows = await db
      .from('user_roles')
      .where('user_id', targetUser.id)
      .where('role_id', userRole.id)
    assert.lengthOf(rows, 1)
  })

  test('should require authentication for admin endpoints', async ({ client }) => {
    const responses = await Promise.all([
      client.get('/api/v1/admin/roles'),
      client.put('/api/v1/admin/roles/attach').json({}),
    ])

    responses.forEach((response) => {
      response.assertStatus(401)
    })
  })
})
