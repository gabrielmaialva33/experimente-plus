import { test } from '@japa/runner'
import type { ApiClient, ApiResponse } from '@japa/api-client'
import testUtils from '@adonisjs/core/services/test_utils'
import limiter from '@adonisjs/limiter/services/main'
import jwt from 'jsonwebtoken'
import { DateTime } from 'luxon'

import RefreshToken from '#modules/auth/models/refresh_token'
import { isCanonicalRefreshToken } from '#modules/auth/utils/refresh_token'
import User from '#modules/users/models/user'
import { JWT_AUDIENCE, JWT_ISSUER } from '#shared/jwt/constants'
import env from '#start/env'

function assertPrivateCredentialResponse(response: ApiResponse): void {
  response.assertHeader('cache-control', 'private, no-store')
  response.assertHeader('pragma', 'no-cache')
  response.assertHeader('x-robots-tag', 'noindex, nofollow')
  response.assertHeader('referrer-policy', 'no-referrer')
}

test.group('Session refresh tokens', (group) => {
  group.each.setup(() => testUtils.db().withGlobalTransaction())
  group.each.setup(async () => {
    await limiter.clear()
    return () => limiter.clear()
  })

  async function signIn(client: ApiClient) {
    const user = await User.create({
      full_name: 'Refresh User',
      email: 'refresh@example.com',
      username: 'refresh-user',
      password: 'password123',
    })

    const response = await client.post('/api/v1/sessions/sign-in').json({
      uid: user.email,
      password: 'password123',
    })
    response.assertStatus(200)

    return {
      user,
      accessToken: response.body().auth.access_token as string,
      refreshToken: response.body().auth.refresh_token as string,
    }
  }

  test('should issue an access JWT and an opaque hashed refresh token', async ({
    client,
    assert,
  }) => {
    const { user, accessToken, refreshToken } = await signIn(client)

    const payload = jwt.verify(accessToken, env.get('ACCESS_TOKEN_SECRET', env.get('APP_KEY')), {
      issuer: JWT_ISSUER,
      audience: JWT_AUDIENCE,
    }) as jwt.JwtPayload & { token_use: string; userId: number; credentialVersion: number }

    assert.equal(payload.token_use, 'access')
    assert.equal(payload.userId, user.id)
    assert.equal(payload.credentialVersion, user.credential_version)
    assert.notProperty(user.serialize(), 'credential_version')
    assert.isString(payload.jti)
    assert.equal(payload.exp! - payload.iat!, 900)
    assert.isNull(jwt.decode(refreshToken))
    assert.lengthOf(refreshToken, 43)
    assert.isTrue(isCanonicalRefreshToken(refreshToken))

    const stored = await RefreshToken.query().where('user_id', user.id).firstOrFail()
    assert.lengthOf(stored.token_hash, 64)
    assert.notEqual(stored.token_hash, refreshToken)
    assert.isNull(stored.revoked_at)
    assert.approximately(stored.expires_at.diffNow('seconds').seconds, 259200, 5)
  })

  test('should reject an opaque refresh token as bearer authentication', async ({ client }) => {
    const { refreshToken } = await signIn(client)

    const response = await client.get('/api/v1/me').bearerToken(refreshToken)
    response.assertStatus(401)
  })

  test('should reject access JWTs without the current credential version', async ({ client }) => {
    const { user } = await signIn(client)
    const secret = env.get('ACCESS_TOKEN_SECRET', env.get('APP_KEY'))
    const options: jwt.SignOptions = {
      expiresIn: '15m',
      issuer: JWT_ISSUER,
      audience: JWT_AUDIENCE,
    }
    const baseClaims = {
      sub: String(user.id),
      userId: user.id,
      token_use: 'access',
    }
    const invalidTokens = [
      jwt.sign(baseClaims, secret, options),
      jwt.sign({ ...baseClaims, credentialVersion: user.credential_version + 1 }, secret, options),
      jwt.sign(
        { ...baseClaims, credentialVersion: String(user.credential_version) },
        secret,
        options
      ),
    ]

    for (const token of invalidTokens) {
      const response = await client.get('/api/v1/me').bearerToken(token)
      response.assertStatus(401)
    }
  })

  test('should rotate refresh tokens and reject replay of the previous token', async ({
    client,
    assert,
  }) => {
    const { user, refreshToken } = await signIn(client)

    const response = await client.post('/api/v1/sessions/refresh').json({
      refresh_token: refreshToken,
    })
    response.assertStatus(200)
    response.assertBodyContains({
      auth: {
        token_type: 'Bearer',
        expires_in: 900,
        refresh_expires_in: 259200,
      },
    })
    assertPrivateCredentialResponse(response)

    const rotatedAccessToken = response.body().auth.access_token as string
    const rotatedRefreshToken = response.body().auth.refresh_token as string
    assert.notEqual(rotatedRefreshToken, refreshToken)

    const rotatedPayload = jwt.verify(
      rotatedAccessToken,
      env.get('ACCESS_TOKEN_SECRET', env.get('APP_KEY')),
      { issuer: JWT_ISSUER, audience: JWT_AUDIENCE }
    ) as jwt.JwtPayload & { credentialVersion: number }
    assert.equal(rotatedPayload.credentialVersion, user.credential_version)

    const accessResponse = await client.get('/api/v1/me').bearerToken(rotatedAccessToken)
    accessResponse.assertStatus(200)
    assert.equal(accessResponse.body().id, user.id)

    const replay = await client.post('/api/v1/sessions/refresh').json({
      refresh_token: refreshToken,
    })
    replay.assertStatus(401)

    const current = await client.post('/api/v1/sessions/refresh').json({
      refresh_token: rotatedRefreshToken,
    })
    current.assertStatus(200)

    const records = await RefreshToken.query().where('user_id', user.id).orderBy('id', 'asc')
    assert.lengthOf(records, 3)
    assert.isNotNull(records[0].revoked_at)
    assert.isNotNull(records[1].revoked_at)
    assert.isNull(records[2].revoked_at)
    assert.equal(records[1].rotated_from_id, records[0].id)
    assert.equal(records[2].rotated_from_id, records[1].id)
  })

  test('should revoke a refresh token on API logout', async ({ client }) => {
    const { refreshToken } = await signIn(client)

    const logout = await client.post('/api/v1/sessions/logout').json({
      refresh_token: refreshToken,
    })
    logout.assertStatus(204)

    const refresh = await client.post('/api/v1/sessions/refresh').json({
      refresh_token: refreshToken,
    })
    refresh.assertStatus(401)
  })

  test('should reject non-canonical refresh token encodings without normalizing whitespace', async ({
    client,
    assert,
  }) => {
    const { user, refreshToken } = await signIn(client)
    const malformedTokens = [
      'A'.repeat(42),
      `${refreshToken}=`,
      ` ${refreshToken}`,
      `${refreshToken} `,
      `${'A'.repeat(42)}B`,
    ]

    for (const malformed of malformedTokens) {
      const response = await client
        .post('/api/v1/sessions/refresh')
        .unsafeJson(JSON.stringify({ refresh_token: malformed }))
      response.assertStatus(422)
      response.assertBodyContains({ errors: [{ field: 'refresh_token' }] })
      assertPrivateCredentialResponse(response)
    }

    const stored = await RefreshToken.query().where('user_id', user.id).firstOrFail()
    assert.isNull(stored.revoked_at)
  })

  for (const endpoint of ['refresh', 'logout'] as const) {
    test(`should require canonical application/json for session ${endpoint}`, async ({
      client,
      assert,
    }) => {
      const { user, refreshToken } = await signIn(client)
      const path = `/api/v1/sessions/${endpoint}`
      const jsonBody = JSON.stringify({ refresh_token: refreshToken })

      const responses = [
        await client.post(path).accept('json').form({ refresh_token: refreshToken }),
        await client.post(path).accept('json').field('refresh_token', refreshToken),
        await client.post(path).accept('json').qs({ refresh_token: refreshToken }).json({}),
      ]
      for (const contentType of [
        'application/json-patch+json',
        'application/vnd.api+json',
        'application/csp-report',
        'text/plain',
        'application/octet-stream',
      ]) {
        responses.push(
          await client
            .post(path)
            .header('content-type', contentType)
            .accept('json')
            .setup((request) => {
              request.request.send(jsonBody)
            })
        )
      }

      for (const response of responses) {
        response.assertStatus(422)
        response.assertBodyContains({
          errors: [{ field: 'refresh_token', rule: 'required' }],
        })
        assertPrivateCredentialResponse(response)
      }

      const stored = await RefreshToken.query().where('user_id', user.id).firstOrFail()
      assert.isNull(stored.revoked_at)
    })
  }

  test('should accept canonical JSON with a charset parameter', async ({ client, assert }) => {
    const { user, refreshToken } = await signIn(client)

    const response = await client
      .post('/api/v1/sessions/refresh')
      .header('content-type', 'Application/JSON; charset=utf-8')
      .accept('json')
      .setup((request) => {
        request.request.send(JSON.stringify({ refresh_token: refreshToken }))
      })

    response.assertStatus(200)
    assertPrivateCredentialResponse(response)
    const parent = await RefreshToken.query()
      .where('user_id', user.id)
      .whereNotNull('revoked_at')
      .firstOrFail()
    assert.isNotNull(parent.revoked_at)
  })

  test('should sanitize malformed JSON without consuming or echoing the refresh token', async ({
    client,
    assert,
  }) => {
    const { user, refreshToken } = await signIn(client)

    const response = await client
      .post('/api/v1/sessions/refresh')
      .accept('json')
      .unsafeJson(`{"refresh_token":"${refreshToken}"`)

    response.assertStatus(400)
    response.assertBody({ status: 400, message: 'Malformed JSON request body' })
    assertPrivateCredentialResponse(response)
    assert.notInclude(response.text(), refreshToken)

    const stored = await RefreshToken.query().where('user_id', user.id).firstOrFail()
    assert.isNull(stored.revoked_at)
  })

  test('should reject an expired refresh token without rotating its credential chain', async ({
    client,
    assert,
  }) => {
    const { user, refreshToken } = await signIn(client)
    const stored = await RefreshToken.query().where('user_id', user.id).firstOrFail()
    stored.expires_at = DateTime.now().minus({ minute: 1 })
    await stored.save()

    const response = await client.post('/api/v1/sessions/refresh').json({
      refresh_token: refreshToken,
    })

    response.assertStatus(401)
    response.assertBody({ status: 401, message: 'Invalid or expired refresh token' })
    assertPrivateCredentialResponse(response)

    const records = await RefreshToken.query().where('user_id', user.id)
    assert.lengthOf(records, 1)
    assert.isNull(records[0].revoked_at)
    assert.isNull(records[0].rotated_from_id)
  })
})
