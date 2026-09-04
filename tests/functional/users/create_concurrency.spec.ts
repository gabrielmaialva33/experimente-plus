import { randomUUID } from 'node:crypto'

import { test } from '@japa/runner'
import app from '@adonisjs/core/services/app'
import db from '@adonisjs/lucid/services/db'
import { errors } from '@vinejs/vine'

import RolesRepository from '#modules/roles/repositories/roles_repository'
import CreateTenantService from '#modules/tenants/services/create_tenant_service'
import CreateUserService from '#modules/users/services/create_user_service'
import UsersRepository from '#modules/users/repositories/users_repository'

type Barrier = {
  wait: () => Promise<void>
  release: () => void
}

function createBarrier(participants: number): Barrier {
  let arrivals = 0
  let release!: () => void
  const gate = new Promise<void>((resolve) => {
    release = resolve
  })

  return {
    wait: async () => {
      arrivals += 1
      if (arrivals === participants) {
        release()
      }
      await gate
    },
    release,
  }
}

class BarrierUsersRepository extends UsersRepository {
  constructor(private readonly barrier: Barrier) {
    super()
  }

  override async create(...args: Parameters<UsersRepository['create']>) {
    await this.barrier.wait()
    return super.create(...args)
  }
}

async function createServiceAtInsertBarrier(barrier: Barrier): Promise<CreateUserService> {
  return new CreateUserService(
    new BarrierUsersRepository(barrier),
    await app.container.make(RolesRepository),
    await app.container.make(CreateTenantService)
  )
}

test.group('Create user concurrency', () => {
  test('allows exactly one concurrent user creation for an email', async ({ assert, cleanup }) => {
    assert.equal(db.connectionGlobalTransactions.size, 0)
    const suffix = randomUUID().replaceAll('-', '')
    const email = `create-email-race-${suffix}@example.com`
    const payloads = [
      {
        full_name: 'Email Race One',
        email,
        username: `email-race-one-${suffix}`,
        password: 'password123',
      },
      {
        full_name: 'Email Race Two',
        email,
        username: `email-race-two-${suffix}`,
        password: 'password123',
      },
    ]
    cleanup(async () => {
      await db.from('users').where('email', email).delete()
    })

    const insertBarrier = createBarrier(payloads.length)
    cleanup(() => insertBarrier.release())
    const service = await createServiceAtInsertBarrier(insertBarrier)
    const outcomes = await Promise.allSettled(payloads.map((payload) => service.run(payload)))
    const successes = outcomes.filter((outcome) => outcome.status === 'fulfilled')
    const failures = outcomes.filter((outcome) => outcome.status === 'rejected')

    assert.lengthOf(successes, 1)
    assert.lengthOf(failures, 1)
    assert.instanceOf(failures[0].reason, errors.E_VALIDATION_ERROR)
    assert.deepEqual((failures[0].reason as { messages: unknown }).messages, [
      {
        field: 'email',
        rule: 'database.unique',
        message: 'The email has already been taken',
      },
    ])
    assert.equal(
      (failures[0].reason as Error & { cause: { constraint?: string } }).cause.constraint,
      'users_email_unique'
    )

    const count = await db.from('users').where('email', email).count('* as total').first()
    assert.equal(Number(count?.total), 1)
  })

  test('allows exactly one concurrent user creation for a username', async ({
    assert,
    cleanup,
  }) => {
    assert.equal(db.connectionGlobalTransactions.size, 0)
    const suffix = randomUUID().replaceAll('-', '')
    const username = `create-username-race-${suffix}`
    const emails = [
      `create-username-race-one-${suffix}@example.com`,
      `create-username-race-two-${suffix}@example.com`,
    ]
    const payloads = emails.map((email, index) => ({
      full_name: `Username Race ${index + 1}`,
      email,
      username,
      password: 'password123',
    }))
    cleanup(async () => {
      await db.from('users').whereIn('email', emails).delete()
    })

    const insertBarrier = createBarrier(payloads.length)
    cleanup(() => insertBarrier.release())
    const service = await createServiceAtInsertBarrier(insertBarrier)
    const outcomes = await Promise.allSettled(payloads.map((payload) => service.run(payload)))
    const successes = outcomes.filter((outcome) => outcome.status === 'fulfilled')
    const failures = outcomes.filter((outcome) => outcome.status === 'rejected')

    assert.lengthOf(successes, 1)
    assert.lengthOf(failures, 1)
    assert.instanceOf(failures[0].reason, errors.E_VALIDATION_ERROR)
    assert.deepEqual((failures[0].reason as { messages: unknown }).messages, [
      {
        field: 'username',
        rule: 'database.unique',
        message: 'The username has already been taken',
      },
    ])
    assert.equal(
      (failures[0].reason as Error & { cause: { constraint?: string } }).cause.constraint,
      'users_username_unique'
    )

    const count = await db.from('users').where('username', username).count('* as total').first()
    assert.equal(Number(count?.total), 1)
  })
})
