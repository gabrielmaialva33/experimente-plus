import { randomUUID } from 'node:crypto'

import { test } from '@japa/runner'
import testUtils from '@adonisjs/core/services/test_utils'
import limiter from '@adonisjs/limiter/services/main'
import db from '@adonisjs/lucid/services/db'

import User from '#modules/users/models/user'

function createBarrier(participants: number): () => Promise<void> {
  let arrivals = 0
  let release: () => void
  const gate = new Promise<void>((resolve) => {
    release = resolve
  })

  return async () => {
    arrivals += 1
    if (arrivals === participants) {
      release()
    }
    await gate
  }
}

test.group('Update own profile', (group) => {
  group.each.setup(() => testUtils.db().withGlobalTransaction())

  test('supports partial profile updates and returns only allowlisted user fields', async ({
    client,
    assert,
  }) => {
    const verifiedAt = '2026-09-04T08:00:00.000Z'
    const user = await User.create({
      full_name: 'Nome Original',
      email: 'profile-owner@example.com',
      username: 'profile-owner',
      password: 'password123',
      metadata: {
        email_verified: true,
        email_verification_token_hash: null,
        email_verification_sent_at: null,
        email_verified_at: verifiedAt,
      },
    })
    const passwordHash = user.password

    const nameResponse = await client
      .patch('/api/v1/me')
      .loginAs(user)
      .json({
        full_name: '  Nome Atualizado  ',
        email: 'attacker@example.com',
        password: 'attacker-password',
        is_deleted: true,
        metadata: { email_verified: false },
      })

    nameResponse.assertStatus(200)
    nameResponse.assertHeader('cache-control', 'private, no-store')
    nameResponse.assertHeader('x-robots-tag', 'noindex, nofollow')
    nameResponse.assertHeader('referrer-policy', 'no-referrer')
    nameResponse.assertHeader('x-ratelimit-limit', '100')
    assert.deepEqual(nameResponse.body(), {
      user: {
        id: user.id,
        full_name: 'Nome Atualizado',
        email: 'profile-owner@example.com',
        username: 'profile-owner',
        email_verified: true,
        email_verified_at: verifiedAt,
      },
    })

    const usernameResponse = await client
      .patch('/api/v1/me')
      .loginAs(user)
      .json({ username: 'profile-renamed' })

    usernameResponse.assertStatus(200)
    assert.equal(usernameResponse.body().user.full_name, 'Nome Atualizado')
    assert.equal(usernameResponse.body().user.username, 'profile-renamed')

    await user.refresh()
    assert.equal(user.full_name, 'Nome Atualizado')
    assert.equal(user.username, 'profile-renamed')
    assert.equal(user.email, 'profile-owner@example.com')
    assert.equal(user.password, passwordHash)
    assert.isFalse(user.is_deleted)
    assert.isTrue(user.metadata.email_verified)
    assert.equal(user.metadata.email_verified_at, verifiedAt)
  })

  test('validates editable fields and preserves another user unique username', async ({
    client,
    assert,
  }) => {
    const actor = await User.create({
      full_name: 'Profile Actor',
      email: 'profile-actor@example.com',
      username: 'profile-actor',
      password: 'password123',
    })
    await User.create({
      full_name: 'Existing Profile',
      email: 'existing-profile@example.com',
      username: 'existing-profile',
      password: 'password123',
    })

    const invalid = await client
      .patch('/api/v1/me')
      .header('Accept', 'application/json')
      .loginAs(actor)
      .json({ full_name: '', username: 'ab' })
    invalid.assertStatus(422)
    invalid.assertBodyContains({
      errors: [
        { field: 'full_name', rule: 'required' },
        { field: 'username', rule: 'minLength' },
      ],
    })

    const duplicate = await client
      .patch('/api/v1/me')
      .header('Accept', 'application/json')
      .loginAs(actor)
      .json({ username: 'existing-profile' })
    duplicate.assertStatus(422)
    duplicate.assertBodyContains({
      errors: [{ field: 'username', rule: 'database.unique' }],
    })

    await actor.refresh()
    assert.equal(actor.full_name, 'Profile Actor')
    assert.equal(actor.username, 'profile-actor')
  })

  test('reads profile changes only from the request body', async ({ client, assert }) => {
    const actor = await User.create({
      full_name: 'Profile Body Source',
      email: 'profile-body-source@example.com',
      username: 'profile-body-source',
      password: 'password123',
    })

    const queryOnly = await client
      .patch('/api/v1/me')
      .loginAs(actor)
      .qs({ full_name: 'Query Only Name', username: 'query-only-name' })
      .json({})
    queryOnly.assertStatus(200)
    queryOnly.assertBodyContains({
      user: { full_name: 'Profile Body Source', username: 'profile-body-source' },
    })

    const bodyWins = await client
      .patch('/api/v1/me')
      .loginAs(actor)
      .qs({ full_name: 'Conflicting Query Name', username: 'conflicting-query-name' })
      .json({ full_name: 'Body Name' })
    bodyWins.assertStatus(200)
    bodyWins.assertBodyContains({
      user: { full_name: 'Body Name', username: 'profile-body-source' },
    })

    await actor.refresh()
    assert.equal(actor.full_name, 'Body Name')
    assert.equal(actor.username, 'profile-body-source')
  })

  test('accepts database field limits and rejects values one character over them', async ({
    client,
    assert,
  }) => {
    const actor = await User.create({
      full_name: 'Boundary Profile',
      email: 'boundary-profile@example.com',
      username: 'boundary-profile',
      password: 'password123',
    })
    const maximumFullName = 'N'.repeat(255)
    const maximumUsername = 'u'.repeat(80)

    const accepted = await client.patch('/api/v1/me').loginAs(actor).json({
      full_name: maximumFullName,
      username: maximumUsername,
    })
    accepted.assertStatus(200)
    assert.equal(accepted.body().user.full_name, maximumFullName)
    assert.equal(accepted.body().user.username, maximumUsername)

    const rejected = await client
      .patch('/api/v1/me')
      .header('Accept', 'application/json')
      .loginAs(actor)
      .json({
        full_name: 'N'.repeat(256),
        username: 'v'.repeat(81),
      })
    rejected.assertStatus(422)
    rejected.assertBodyContains({
      errors: [
        { field: 'full_name', rule: 'maxLength' },
        { field: 'username', rule: 'maxLength' },
      ],
    })

    await actor.refresh()
    assert.equal(actor.full_name, maximumFullName)
    assert.equal(actor.username, maximumUsername)
  })

  test('flashes username validation through the official Inertia input error bag', async ({
    client,
  }) => {
    const actor = await User.create({
      full_name: 'Web Profile Actor',
      email: 'web-profile-actor@example.com',
      username: 'web-profile-actor',
      password: 'password123',
    })
    await User.create({
      full_name: 'Web Existing Profile',
      email: 'web-existing-profile@example.com',
      username: 'web-existing-profile',
      password: 'password123',
    })

    const response = await client
      .post('/settings/profile')
      .withCsrfToken()
      .header('x-inertia', 'true')
      .header('referer', '/settings')
      .accept('html')
      .redirects(0)
      .loginAs(actor)
      .form({
        full_name: actor.full_name,
        username: 'web-existing-profile',
      })

    response.assertStatus(302)
    response.assertHeader('location', '/settings')
    response.assertFlashMessage('inputErrorsBag', {
      username: ['The username has already been taken'],
    })
    response.assertFlashMissing('errors')
  })

  test('requires authentication', async ({ client }) => {
    const response = await client.patch('/api/v1/me').json({ full_name: 'Anonymous' })
    response.assertStatus(401)
  })
})

test.group('Update own profile concurrency', (group) => {
  group.each.setup(async () => {
    await limiter.clear()
    return () => limiter.clear()
  })

  test('allows exactly one user to claim a concurrently requested username', async ({
    client,
    assert,
    cleanup,
  }) => {
    assert.equal(db.connectionGlobalTransactions.size, 0)
    const suffix = randomUUID().replaceAll('-', '')
    const actors = await Promise.all([
      User.create({
        full_name: 'Concurrent Profile One',
        email: `profile-race-one-${suffix}@example.com`,
        username: `profile-race-one-${suffix}`,
        password: 'password123',
      }),
      User.create({
        full_name: 'Concurrent Profile Two',
        email: `profile-race-two-${suffix}@example.com`,
        username: `profile-race-two-${suffix}`,
        password: 'password123',
      }),
    ])
    const originalUsernames = actors.map((actor) => actor.username)
    const contestedUsername = `profile-race-winner-${suffix}`

    cleanup(async () => {
      await db
        .from('users')
        .whereIn(
          'id',
          actors.map((actor) => actor.id)
        )
        .delete()
    })

    const start = createBarrier(actors.length)
    const update = async (actor: User) => {
      await start()
      return client.patch('/api/v1/me').loginAs(actor).json({ username: contestedUsername })
    }
    const responses = await Promise.all(actors.map(update))

    assert.deepEqual(
      responses.map((response) => response.status()).sort((left, right) => left - right),
      [200, 422]
    )
    const winnerIndex = responses.findIndex((response) => response.status() === 200)
    const loserIndex = responses.findIndex((response) => response.status() === 422)
    assert.notEqual(winnerIndex, -1)
    assert.notEqual(loserIndex, -1)
    responses[loserIndex].assertBodyContains({
      errors: [{ field: 'username', rule: 'database.unique' }],
    })

    const claimedBy = await User.query().where('username', contestedUsername)
    assert.lengthOf(claimedBy, 1)
    assert.equal(claimedBy[0].id, actors[winnerIndex].id)

    await Promise.all(actors.map((actor) => actor.refresh()))
    assert.equal(actors[winnerIndex].username, contestedUsername)
    assert.equal(actors[loserIndex].username, originalUsernames[loserIndex])
  })
})
