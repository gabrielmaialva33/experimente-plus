import { test } from '@japa/runner'
import testUtils from '@adonisjs/core/services/test_utils'
import db from '@adonisjs/lucid/services/db'

import Role from '#modules/roles/models/role'
import Permission from '#modules/permissions/models/permission'
import User from '#modules/users/models/user'

import IPermission from '#modules/permissions/interfaces/permission_interface'
import IRole from '#modules/roles/interfaces/role_interface'

test.group('Users list', (group) => {
  group.each.setup(() => testUtils.db().withGlobalTransaction())

  // Helper function to create and assign permissions to a role
  async function assignPermissions(role: Role, actions: string[]) {
    const permissions = await Promise.all(
      actions.map((action) =>
        Permission.firstOrCreate(
          {
            resource: IPermission.Resources.USERS,
            action: action,
          },
          {
            name: `users.${action}`,
            resource: IPermission.Resources.USERS,
            action: action,
          }
        )
      )
    )
    await role.related('permissions').sync(permissions.map((p) => p.id))
  }

  async function createListUser() {
    const role = await Role.firstOrCreate(
      { slug: IRole.Slugs.USER },
      {
        name: 'User',
        slug: IRole.Slugs.USER,
        description: 'Regular user role',
      }
    )
    const user = await User.create({
      full_name: 'List Contract User',
      email: 'list-contract@example.com',
      username: 'list-contract',
      password: 'password123',
    })

    await user.related('roles').attach([role.id])
    await assignPermissions(role, [IPermission.Actions.LIST])

    return user
  }

  test('should list users with an exact serialized contract', async ({ client, assert }) => {
    const userRole = await Role.firstOrCreate(
      { slug: IRole.Slugs.USER },
      {
        name: 'User',
        slug: IRole.Slugs.USER,
        description: 'Regular user role',
      }
    )

    const user = await User.create({
      full_name: 'John Doe',
      email: 'john@example.com',
      username: 'johndoe',
      password: 'password123',
    })

    await db.table('user_roles').insert({
      user_id: user.id,
      role_id: userRole.id,
    })

    // Assign list permission to user role
    await assignPermissions(userRole, [IPermission.Actions.LIST])

    const response = await client.get('/api/v1/users').loginAs(user)

    response.assertStatus(200)
    response.assertBodyContains({
      meta: {
        per_page: 10,
        current_page: 1,
      },
    })
    // Check that the response contains users
    const body = response.body()
    response.assert!.isArray(body.data)
    response.assert!.isAtLeast(body.data.length, 1)
    assert.sameMembers(Object.keys(body), ['meta', 'data'])
    assert.sameMembers(Object.keys(body.meta), [
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

    const serializedUser = body.data.find((item: { id: number }) => item.id === user.id)
    assert.exists(serializedUser)
    assert.sameMembers(Object.keys(serializedUser), [
      'id',
      'full_name',
      'email',
      'username',
      'email_verified',
      'email_verified_at',
      'created_at',
      'updated_at',
      'roles',
    ])
    assert.lengthOf(serializedUser.roles, 1)
    assert.sameMembers(Object.keys(serializedUser.roles[0]), [
      'id',
      'name',
      'description',
      'slug',
      'created_at',
      'updated_at',
    ])
  })

  test('should fail without authentication', async ({ client }) => {
    const response = await client.get('/api/v1/users')

    response.assertStatus(401)
  })

  test('should paginate results', async ({ client, assert }) => {
    const userRole = await Role.firstOrCreate(
      { slug: IRole.Slugs.USER },
      {
        name: 'User',
        slug: IRole.Slugs.USER,
        description: 'Regular user role',
      }
    )

    const authUser = await User.create({
      full_name: 'Auth User',
      email: 'auth@example.com',
      username: 'authuser',
      password: 'password123',
    })

    await db.table('user_roles').insert({
      user_id: authUser.id,
      role_id: userRole.id,
    })

    // Assign list permission to user role
    await assignPermissions(userRole, [IPermission.Actions.LIST])

    // Create 15 additional users
    for (let i = 1; i <= 15; i++) {
      await User.create({
        full_name: `User${i} Test`,
        email: `user${i}@example.com`,
        username: `user${i}`,
        password: 'password123',
      })
    }

    const response = await client
      .get('/api/v1/users')
      .qs({ page: 2, per_page: 10 })
      .loginAs(authUser)

    response.assertStatus(200)
    response.assertBodyContains({
      meta: {
        per_page: 10,
        current_page: 2,
      },
    })

    const data = response.body().data
    // Check that pagination is working - should have some data on page 2
    assert.isArray(data)
    assert.isAtLeast(data.length, 1)
  })

  test('should use canonical defaults and ignore pagination fields from the request body', async ({
    client,
    assert,
  }) => {
    const user = await createListUser()

    const response = await client
      .get('/api/v1/users')
      .unsafeJson({
        page: 2,
        per_page: 1,
        sort_by: 'email',
        order: 'desc',
      })
      .loginAs(user)

    response.assertStatus(200)
    response.assertBodyContains({
      meta: {
        per_page: 10,
        current_page: 1,
      },
    })

    const ids = response.body().data.map((item: { id: number }) => item.id)
    assert.deepEqual(
      ids,
      [...ids].sort((left, right) => left - right)
    )
  })

  test('should enforce the canonical pagination cap', async ({ client }) => {
    const user = await createListUser()

    const capped = await client.get('/api/v1/users').qs({ page: 1, per_page: 100 }).loginAs(user)
    capped.assertStatus(200)
    capped.assertBodyContains({ meta: { current_page: 1, per_page: 100 } })

    const aboveCap = await client.get('/api/v1/users').qs({ page: 1, per_page: 101 }).loginAs(user)
    aboveCap.assertStatus(422)
  })

  test('should reject malformed, overflowing, unknown, and unsafe list query values', async ({
    client,
  }) => {
    const user = await createListUser()
    const invalidQueries = [
      { page: '1.0' },
      { page: '1e2' },
      { page: '2147483648' },
      { sort_by: 'password' },
      { order: 'sideways' },
      { perPage: '25' },
    ]

    for (const query of invalidQueries) {
      const response = await client.get('/api/v1/users').qs(query).loginAs(user)
      response.assertStatus(422)
    }
  })

  test('should filter users by search query', async ({ client, assert }) => {
    const userRole = await Role.firstOrCreate(
      { slug: IRole.Slugs.USER },
      {
        name: 'User',
        slug: IRole.Slugs.USER,
        description: 'Regular user role',
      }
    )

    const authUser = await User.create({
      full_name: 'John Doe',
      email: 'john@example.com',
      username: 'johndoe',
      password: 'password123',
    })

    await db.table('user_roles').insert({
      user_id: authUser.id,
      role_id: userRole.id,
    })

    // Assign list permission to user role
    await assignPermissions(userRole, [IPermission.Actions.LIST])

    await User.create({
      full_name: 'Jane Smith',
      email: 'jane@example.com',
      username: 'janesmith',
      password: 'password123',
    })

    await User.create({
      full_name: 'Bob Johnson',
      email: 'bob@example.com',
      username: 'bobjohnson',
      password: 'password123',
    })

    const response = await client.get('/api/v1/users').qs({ search: 'jane' }).loginAs(authUser)

    response.assertStatus(200)
    const data = response.body().data
    assert.lengthOf(data, 1)
    response.assertBodyContains({
      data: [
        {
          email: 'jane@example.com',
          username: 'janesmith',
        },
      ],
    })
  })

  test('should treat PostgreSQL ILIKE metacharacters as literal search text', async ({
    client,
    assert,
  }) => {
    const authUser = await createListUser()
    const cases = [
      {
        search: '100%',
        targetName: 'Literal 100% Match',
        decoyName: 'Literal 100X Match',
        suffix: 'percent',
      },
      {
        search: 'Code_A',
        targetName: 'Literal Code_A Match',
        decoyName: 'Literal CodeXA Match',
        suffix: 'underscore',
      },
      {
        search: 'Path\\Segment',
        targetName: 'Literal Path\\Segment Match',
        decoyName: 'Literal PathXSegment Match',
        suffix: 'backslash',
      },
    ]

    for (const testCase of cases) {
      const target = await User.create({
        full_name: testCase.targetName,
        email: `literal-${testCase.suffix}@example.com`,
        username: `literal-${testCase.suffix}`,
        password: 'password123',
      })
      await User.create({
        full_name: testCase.decoyName,
        email: `decoy-${testCase.suffix}@example.com`,
        username: `decoy-${testCase.suffix}`,
        password: 'password123',
      })

      const response = await client
        .get('/api/v1/users')
        .qs({ search: testCase.search })
        .loginAs(authUser)

      response.assertStatus(200)
      assert.deepEqual(
        response.body().data.map((item: { id: number }) => item.id),
        [target.id]
      )
    }
  })

  test('should sort users by different fields', async ({ client }) => {
    const userRole = await Role.firstOrCreate(
      { slug: IRole.Slugs.USER },
      {
        name: 'User',
        slug: IRole.Slugs.USER,
        description: 'Regular user role',
      }
    )

    const authUser = await User.create({
      full_name: 'Auth User',
      email: 'auth@example.com',
      username: 'authuser',
      password: 'password123',
    })

    await db.table('user_roles').insert({
      user_id: authUser.id,
      role_id: userRole.id,
    })

    // Assign list permission to user role
    await assignPermissions(userRole, [IPermission.Actions.LIST])

    await User.create({
      full_name: 'Charlie Brown',
      email: 'charlie@example.com',
      username: 'charliebrown',
      password: 'password123',
    })

    await User.create({
      full_name: 'Alice Wonder',
      email: 'alice@example.com',
      username: 'alicewonder',
      password: 'password123',
    })

    const response = await client
      .get('/api/v1/users')
      .qs({ sort_by: 'full_name', order: 'asc' })
      .loginAs(authUser)

    response.assertStatus(200)
    const data = response.body().data

    // Find the specific users we created in the results
    const userNames = data.map((u: any) => u.full_name)
    const aliceIndex = userNames.indexOf('Alice Wonder')
    const authIndex = userNames.indexOf('Auth User')
    const charlieIndex = userNames.indexOf('Charlie Brown')

    // Check they exist and are in ascending order
    response.assert!.isAtLeast(aliceIndex, 0)
    response.assert!.isAtLeast(authIndex, 0)
    response.assert!.isAtLeast(charlieIndex, 0)
    response.assert!.isBelow(aliceIndex, authIndex)
    response.assert!.isBelow(authIndex, charlieIndex)
  })

  test('should include user roles in response', async ({ client }) => {
    const userRole = await Role.firstOrCreate(
      { slug: IRole.Slugs.USER },
      {
        name: 'User',
        slug: IRole.Slugs.USER,
        description: 'Regular user role',
      }
    )

    const adminRole = await Role.firstOrCreate(
      { slug: IRole.Slugs.ADMIN },
      {
        name: 'Admin',
        slug: IRole.Slugs.ADMIN,
        description: 'Administrator role',
      }
    )

    const user = await User.create({
      full_name: 'John Doe',
      email: 'john@example.com',
      username: 'johndoe',
      password: 'password123',
    })

    await db.table('user_roles').insert([
      {
        user_id: user.id,
        role_id: userRole.id,
      },
      {
        user_id: user.id,
        role_id: adminRole.id,
      },
    ])

    // Assign list permission to user role (admin inherits this too)
    await assignPermissions(userRole, [IPermission.Actions.LIST])

    const response = await client.get('/api/v1/users').loginAs(user)

    response.assertStatus(200)
    response.assertBodyContains({
      data: [
        {
          id: user.id,
          roles: [
            {
              slug: IRole.Slugs.USER,
            },
            {
              slug: IRole.Slugs.ADMIN,
            },
          ],
        },
      ],
    })
  })
})
