import { randomUUID } from 'node:crypto'

import { test } from '@japa/runner'
import app from '@adonisjs/core/services/app'
import testUtils from '@adonisjs/core/services/test_utils'
import limiter from '@adonisjs/limiter/services/main'
import db from '@adonisjs/lucid/services/db'
import mail from '@adonisjs/mail/services/main'
import type { ApiResponse } from '@japa/api-client'

import PasswordResetToken from '#modules/auth/models/password_reset_token'
import RefreshToken from '#modules/auth/models/refresh_token'
import PasswordResetTokenRepository from '#modules/auth/repositories/password_reset_token_repository'
import RefreshTokenRepository from '#modules/auth/repositories/refresh_token_repository'
import CredentialInvalidationService from '#modules/auth/services/credential_invalidation_service'
import PasswordResetNotification from '#modules/auth/services/password_reset_notification'
import PasswordResetTokenService from '#modules/auth/services/password_reset_token_service'
import RequestPasswordResetService from '#modules/auth/services/request_password_reset_service'
import {
  PASSWORD_RESET_TOKEN_LENGTH,
  PASSWORD_RESET_TOKEN_PATTERN,
} from '#modules/auth/utils/password_reset_token'
import User from '#modules/users/models/user'
import UsersRepository from '#modules/users/repositories/users_repository'

const account = {
  full_name: 'Password Reset User',
  email: 'password-reset@example.com',
  username: 'password-reset-user',
  password: 'password123',
}

class FailingPasswordResetDeliveryService extends RequestPasswordResetService {
  constructor(
    usersRepository: UsersRepository,
    passwordResetTokenService: PasswordResetTokenService,
    private readonly failure: Error,
    private readonly beforeFailure: () => Promise<void> = async () => {}
  ) {
    super(usersRepository, passwordResetTokenService)
  }

  protected async deliver(): Promise<void> {
    await this.beforeFailure()
    throw this.failure
  }
}

function deferred() {
  let resolve!: () => void
  const promise = new Promise<void>((resolvePromise) => {
    resolve = resolvePromise
  })

  return { promise, resolve }
}

function assertPrivateResponse(response: ApiResponse): void {
  response.assertHeader('cache-control', 'private, no-store')
  response.assertHeader('pragma', 'no-cache')
  response.assertHeader('x-robots-tag', 'noindex, nofollow')
  response.assertHeader('referrer-policy', 'no-referrer')
}

test.group('Password reset', (group) => {
  group.each.setup(() => testUtils.db().withGlobalTransaction())
  group.each.setup(async () => {
    await limiter.clear()
    return () => limiter.clear()
  })
  group.each.teardown(() => mail.restore())

  test('should issue a single-use opaque token and reset the password', async ({
    client,
    assert,
  }) => {
    mail.restore()
    const { mails } = mail.fake()
    const user = await User.create(account)

    const forgot = await client.post('/api/v1/sessions/forgot-password').json({
      email: user.email.toUpperCase(),
    })
    forgot.assertStatus(202)
    assertPrivateResponse(forgot)
    forgot.assertBodyContains({
      message: 'If an account exists for that email, a password reset link has been sent.',
    })

    mails.assertSentCount(PasswordResetNotification, 1)
    const notification = mails.sent()[0] as PasswordResetNotification
    const rawToken = notification.getResetToken()

    assert.lengthOf(rawToken, PASSWORD_RESET_TOKEN_LENGTH)
    assert.match(rawToken, PASSWORD_RESET_TOKEN_PATTERN)
    const stored = await PasswordResetToken.query().where('user_id', user.id).firstOrFail()
    assert.lengthOf(stored.token_hash, 64)
    assert.notEqual(stored.token_hash, rawToken)
    assert.isNull(stored.consumed_at)

    const reset = await client.post('/api/v1/sessions/reset-password').json({
      token: rawToken,
      password: 'new-password123',
      password_confirmation: 'new-password123',
    })
    reset.assertStatus(200)
    assertPrivateResponse(reset)

    const oldLogin = await client.post('/api/v1/sessions/sign-in').json({
      uid: user.email,
      password: account.password,
    })
    oldLogin.assertStatus(400)

    const newLogin = await client.post('/api/v1/sessions/sign-in').json({
      uid: user.email,
      password: 'new-password123',
    })
    newLogin.assertStatus(200)

    const replay = await client.post('/api/v1/sessions/reset-password').json({
      token: rawToken,
      password: 'another-password123',
      password_confirmation: 'another-password123',
    })
    replay.assertStatus(400)
  })

  test('should reject non-canonical reset tokens without normalizing whitespace', async ({
    client,
    assert,
  }) => {
    mail.restore()
    const { mails } = mail.fake()
    const user = await User.create({
      ...account,
      email: 'reset-canonical-token@example.com',
      username: 'reset-canonical-token',
    })

    await client.post('/api/v1/sessions/forgot-password').json({ email: user.email })
    const token = (mails.sent()[0] as PasswordResetNotification).getResetToken()
    const malformedTokens = [
      token.slice(0, -1),
      `${token}A`,
      `${token}=`,
      ` ${token}`,
      `${token} `,
      `${token.slice(0, -1)}+`,
    ]

    for (const malformed of malformedTokens) {
      const response = await client.post('/api/v1/sessions/reset-password').unsafeJson(
        JSON.stringify({
          token: malformed,
          password: 'new-password123',
          password_confirmation: 'new-password123',
        })
      )

      response.assertStatus(422)
      response.assertBodyContains({ errors: [{ field: 'token' }] })
      assertPrivateResponse(response)
      assert.notInclude(response.text(), token)
    }

    const stored = await PasswordResetToken.query().where('user_id', user.id).firstOrFail()
    assert.isNull(stored.consumed_at)
  })

  test('should require canonical application/json when consuming a reset token', async ({
    client,
    assert,
  }) => {
    mail.restore()
    const { mails } = mail.fake()
    const user = await User.create({
      ...account,
      email: 'reset-json-only@example.com',
      username: 'reset-json-only',
    })

    await client.post('/api/v1/sessions/forgot-password').json({ email: user.email })
    const token = (mails.sent()[0] as PasswordResetNotification).getResetToken()
    const payload = {
      token,
      password: 'new-password123',
      password_confirmation: 'new-password123',
    }
    const rawPayload = JSON.stringify(payload)
    const responses = [
      await client.post('/api/v1/sessions/reset-password').accept('json').form(payload),
      await client
        .post('/api/v1/sessions/reset-password')
        .accept('json')
        .field('token', token)
        .field('password', payload.password)
        .field('password_confirmation', payload.password_confirmation),
      await client.post('/api/v1/sessions/reset-password').accept('json').qs(payload).json({}),
    ]

    for (const contentType of ['application/json-patch+json', 'application/vnd.api+json']) {
      responses.push(
        await client
          .post('/api/v1/sessions/reset-password')
          .accept('json')
          .unsafeJson(rawPayload)
          .header('content-type', contentType)
      )
    }

    for (const response of responses) {
      response.assertStatus(422)
      response.assertBodyContains({ errors: [{ field: 'token', rule: 'required' }] })
      assertPrivateResponse(response)
      assert.notInclude(response.text(), token)
    }

    const stored = await PasswordResetToken.query().where('user_id', user.id).firstOrFail()
    assert.isNull(stored.consumed_at)
  })

  test('should accept canonical JSON with a charset when consuming a reset token', async ({
    client,
    assert,
  }) => {
    mail.restore()
    const { mails } = mail.fake()
    const user = await User.create({
      ...account,
      email: 'reset-json-charset@example.com',
      username: 'reset-json-charset',
    })

    await client.post('/api/v1/sessions/forgot-password').json({ email: user.email })
    const token = (mails.sent()[0] as PasswordResetNotification).getResetToken()
    const response = await client
      .post('/api/v1/sessions/reset-password')
      .accept('json')
      .unsafeJson(
        JSON.stringify({
          token,
          password: 'new-password123',
          password_confirmation: 'new-password123',
        })
      )
      .header('content-type', 'Application/JSON; charset=utf-8')

    response.assertStatus(200)
    assertPrivateResponse(response)
    const stored = await PasswordResetToken.query().where('user_id', user.id).firstOrFail()
    assert.isNotNull(stored.consumed_at)
  })

  test('should revoke active refresh tokens after a successful reset', async ({
    client,
    assert,
  }) => {
    mail.restore()
    const { mails } = mail.fake()
    const user = await User.create({
      ...account,
      email: 'reset-revocation@example.com',
      username: 'reset-revocation',
    })

    const signIn = await client.post('/api/v1/sessions/sign-in').json({
      uid: user.email,
      password: account.password,
    })
    signIn.assertStatus(200)
    const refreshToken = signIn.body().auth.refresh_token as string

    await client.post('/api/v1/sessions/forgot-password').json({ email: user.email })
    const notification = mails.sent()[0] as PasswordResetNotification

    const reset = await client.post('/api/v1/sessions/reset-password').json({
      token: notification.getResetToken(),
      password: 'rotated-password123',
      password_confirmation: 'rotated-password123',
    })
    reset.assertStatus(200)

    const refresh = await client.post('/api/v1/sessions/refresh').json({
      refresh_token: refreshToken,
    })
    refresh.assertStatus(401)

    const storedRefresh = await RefreshToken.query().where('user_id', user.id).firstOrFail()
    assert.isNotNull(storedRefresh.revoked_at)
  })

  test('should invalidate previous reset links when a new one is requested', async ({ client }) => {
    mail.restore()
    const { mails } = mail.fake()
    const user = await User.create({
      ...account,
      email: 'reset-rotation@example.com',
      username: 'reset-rotation',
    })

    await client.post('/api/v1/sessions/forgot-password').json({ email: user.email })
    const first = (mails.sent()[0] as PasswordResetNotification).getResetToken()

    await client.post('/api/v1/sessions/forgot-password').json({ email: user.email })
    const second = (mails.sent()[1] as PasswordResetNotification).getResetToken()

    const stale = await client.post('/api/v1/sessions/reset-password').json({
      token: first,
      password: 'new-password123',
      password_confirmation: 'new-password123',
    })
    stale.assertStatus(400)

    const current = await client.post('/api/v1/sessions/reset-password').json({
      token: second,
      password: 'new-password123',
      password_confirmation: 'new-password123',
    })
    current.assertStatus(200)
  })

  test('should preserve the previous link and the generic response when SMTP fails', async ({
    client,
    assert,
    cleanup,
  }) => {
    mail.restore()
    const { mails } = mail.fake()
    cleanup(() => mail.restore())
    const user = await User.create({
      ...account,
      email: 'reset-delivery-failure@example.com',
      username: 'reset-delivery-failure',
    })

    const initialRequest = await client
      .post('/api/v1/sessions/forgot-password')
      .json({ email: user.email })
    initialRequest.assertStatus(202)
    const previousToken = (mails.sent()[0] as PasswordResetNotification).getResetToken()

    const usersRepository = await app.container.make(UsersRepository)
    const passwordResetTokenService = await app.container.make(PasswordResetTokenService)
    const failingService = new FailingPasswordResetDeliveryService(
      usersRepository,
      passwordResetTokenService,
      new Error('controlled SMTP failure')
    )
    app.container.swap(RequestPasswordResetService, () => failingService)
    cleanup(() => app.container.restore(RequestPasswordResetService))

    const failedDelivery = await client
      .post('/api/v1/sessions/forgot-password')
      .json({ email: user.email })

    failedDelivery.assertStatus(202)
    assertPrivateResponse(failedDelivery)
    failedDelivery.assertBody({
      message: 'If an account exists for that email, a password reset link has been sent.',
    })
    mails.assertSentCount(PasswordResetNotification, 1)

    const stored = await PasswordResetToken.query().where('user_id', user.id)
    assert.lengthOf(stored, 1)
    assert.isNull(stored[0].consumed_at)

    const reset = await client.post('/api/v1/sessions/reset-password').json({
      token: previousToken,
      password: 'preserved-link-password123',
      password_confirmation: 'preserved-link-password123',
    })
    reset.assertStatus(200)
  })

  test('should not reveal whether an email exists', async ({ client }) => {
    mail.restore()
    const { mails } = mail.fake()
    const response = await client.post('/api/v1/sessions/forgot-password').json({
      email: 'missing-account@example.com',
    })

    response.assertStatus(202)
    assertPrivateResponse(response)
    response.assertBodyContains({
      message: 'If an account exists for that email, a password reset link has been sent.',
    })
    mails.assertSentCount(PasswordResetNotification, 0)
  })

  test('should require canonical application/json when requesting a reset link', async ({
    client,
  }) => {
    mail.restore()
    const { mails } = mail.fake()
    const user = await User.create({
      ...account,
      email: 'forgot-canonical-json@example.com',
      username: 'forgot-canonical-json',
    })
    const payload = { email: user.email }
    const rawPayload = JSON.stringify(payload)
    const rejected = [
      await client.post('/api/v1/sessions/forgot-password').accept('json').form(payload),
      await client
        .post('/api/v1/sessions/forgot-password')
        .accept('json')
        .field('email', payload.email),
    ]

    for (const contentType of ['application/json-patch+json', 'application/vnd.api+json']) {
      rejected.push(
        await client
          .post('/api/v1/sessions/forgot-password')
          .accept('json')
          .unsafeJson(rawPayload)
          .header('content-type', contentType)
      )
    }

    for (const response of rejected) {
      response.assertStatus(422)
      response.assertBodyContains({ errors: [{ field: 'email', rule: 'required' }] })
      assertPrivateResponse(response)
    }
    mails.assertSentCount(PasswordResetNotification, 0)

    const canonicalWithCharset = await client
      .post('/api/v1/sessions/forgot-password')
      .accept('json')
      .unsafeJson(rawPayload)
      .header('content-type', 'Application/JSON; charset=utf-8')

    canonicalWithCharset.assertStatus(202)
    assertPrivateResponse(canonicalWithCharset)
    mails.assertSentCount(PasswordResetNotification, 1)
  })

  test('should read password reset secrets only from the request body', async ({ client }) => {
    mail.restore()
    const { mails } = mail.fake()
    const user = await User.create({
      ...account,
      email: 'reset-body-only@example.com',
      username: 'reset-body-only',
    })

    const queryOnlyForgot = await client
      .post('/api/v1/sessions/forgot-password')
      .qs({ email: user.email })
      .json({})
    queryOnlyForgot.assertStatus(422)
    queryOnlyForgot.assertBodyContains({ errors: [{ field: 'email', rule: 'required' }] })
    assertPrivateResponse(queryOnlyForgot)
    mails.assertSentCount(PasswordResetNotification, 0)

    const forgotBodyWins = await client
      .post('/api/v1/sessions/forgot-password')
      .qs({ email: 'query-attacker@example.com' })
      .json({ email: user.email })
    forgotBodyWins.assertStatus(202)
    assertPrivateResponse(forgotBodyWins)
    mails.assertSentCount(PasswordResetNotification, 1)
    const token = (mails.sent()[0] as PasswordResetNotification).getResetToken()

    const queryOnlyReset = await client
      .post('/api/v1/sessions/reset-password')
      .qs({
        token,
        password: 'query-password123',
        password_confirmation: 'query-password123',
      })
      .json({})
    queryOnlyReset.assertStatus(422)
    queryOnlyReset.assertBodyContains({
      errors: [
        { field: 'token', rule: 'required' },
        { field: 'password', rule: 'required' },
      ],
    })
    assertPrivateResponse(queryOnlyReset)

    const resetBodyWins = await client
      .post('/api/v1/sessions/reset-password')
      .qs({
        token: 'query-token-cannot-win'.repeat(2),
        password: 'query-password123',
        password_confirmation: 'query-password123',
      })
      .json({
        token,
        password: 'body-password123',
        password_confirmation: 'body-password123',
      })
    resetBodyWins.assertStatus(200)
    assertPrivateResponse(resetBodyWins)

    const signIn = await client.post('/api/v1/sessions/sign-in').json({
      uid: user.email,
      password: 'body-password123',
    })
    signIn.assertStatus(200)
  })
})

test.group('Password reset delivery serialization', () => {
  test('rolls back a failed concurrent rotation before consuming the previous token', async ({
    assert,
    cleanup,
  }) => {
    assert.equal(db.connectionGlobalTransactions.size, 0)
    const suffix = randomUUID()
    const user = await User.create({
      full_name: 'Concurrent Password Reset Delivery',
      email: `reset-delivery-${suffix}@example.com`,
      username: `reset-delivery-${suffix}`,
      password: 'password123',
    })
    const usersRepository = new UsersRepository()
    const passwordResetTokenRepository = new PasswordResetTokenRepository()
    const credentialInvalidationService = new CredentialInvalidationService(
      passwordResetTokenRepository,
      new RefreshTokenRepository()
    )
    const passwordResetTokenService = new PasswordResetTokenService(
      passwordResetTokenRepository,
      usersRepository,
      credentialInvalidationService
    )
    const previous = await passwordResetTokenService.issue(user.id)
    assert.isNotNull(previous)

    const deliveryStarted = deferred()
    const releaseDelivery = deferred()
    const resetRequestedUserLock = deferred()
    cleanup(async () => {
      releaseDelivery.resolve()
      await User.query().where('id', user.id).delete()
    })

    const findActiveUser = usersRepository.findActiveByIdForUpdate.bind(usersRepository)
    let userLockRequests = 0
    usersRepository.findActiveByIdForUpdate = async (userId, client) => {
      userLockRequests += 1
      if (userLockRequests === 2) {
        resetRequestedUserLock.resolve()
      }
      return findActiveUser(userId, client)
    }

    const failingService = new FailingPasswordResetDeliveryService(
      usersRepository,
      passwordResetTokenService,
      new Error('controlled concurrent SMTP failure'),
      async () => {
        deliveryStarted.resolve()
        await releaseDelivery.promise
      }
    )
    const failedRequest = failingService.run(user.email)
    await deliveryStarted.promise

    let resetSettled = false
    const reset = passwordResetTokenService.consume(previous!.token, 'concurrent-reset-password123')
    void reset.then(
      () => {
        resetSettled = true
      },
      () => {
        resetSettled = true
      }
    )
    await resetRequestedUserLock.promise
    await new Promise<void>((resolve) => setImmediate(resolve))
    assert.isFalse(resetSettled)

    releaseDelivery.resolve()
    await Promise.all([failedRequest, reset])

    const stored = await PasswordResetToken.query().where('user_id', user.id)
    assert.lengthOf(stored, 1)
    assert.isNotNull(stored[0].consumed_at)
    await usersRepository.verifyCredentials(user.email, 'concurrent-reset-password123')
  })
})
