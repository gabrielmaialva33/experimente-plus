import { test } from '@japa/runner'
import testUtils from '@adonisjs/core/services/test_utils'

import User from '#modules/users/models/user'

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

  test('requires authentication', async ({ client }) => {
    const response = await client.patch('/api/v1/me').json({ full_name: 'Anonymous' })
    response.assertStatus(401)
  })
})
