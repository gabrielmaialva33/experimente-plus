import { test } from '@japa/runner'
import type { ApiResponse } from '@japa/api-client'
import app from '@adonisjs/core/services/app'
import testUtils from '@adonisjs/core/services/test_utils'
import limiter from '@adonisjs/limiter/services/main'
import db from '@adonisjs/lucid/services/db'
import mail from '@adonisjs/mail/services/main'
import { DateTime } from 'luxon'

import EmailVerificationTokenService from '#modules/auth/services/email_verification_token_service'
import SendVerificationEmailService from '#modules/auth/services/send_verification_email_service'
import VerifyEmailService from '#modules/auth/services/verify_email_service'
import VerifyEmailNotification from '#modules/auth/services/verify_email_notification'
import {
  EMAIL_VERIFICATION_TOKEN_LENGTH,
  isCanonicalEmailVerificationToken,
} from '#modules/auth/utils/email_verification_token'
import User from '#modules/users/models/user'
import UsersRepository from '#modules/users/repositories/users_repository'

class FailingVerificationDeliveryService extends SendVerificationEmailService {
  constructor(
    tokenService: EmailVerificationTokenService,
    usersRepository: UsersRepository,
    private readonly failure: Error,
    private readonly beforeFailure: () => Promise<void> = async () => {}
  ) {
    super(tokenService, usersRepository)
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

function createBarrier(participants: number) {
  let arrivals = 0
  const release = deferred()

  return {
    wait: async () => {
      arrivals += 1
      if (arrivals === participants) {
        release.resolve()
      }
      await release.promise
    },
    release: release.resolve,
  }
}

function assertPrivateResponse(response: ApiResponse): void {
  response.assertHeader('cache-control', 'private, no-store')
  response.assertHeader('pragma', 'no-cache')
  response.assertHeader('x-robots-tag', 'noindex, nofollow')
  response.assertHeader('referrer-policy', 'no-referrer')
}

test.group('Email verification', (group) => {
  group.each.setup(() => testUtils.db().withGlobalTransaction())
  group.each.setup(async () => {
    await limiter.clear()
    return () => limiter.clear()
  })

  test('should email a raw token while storing only its HMAC', async ({
    client,
    assert,
    cleanup,
  }) => {
    mail.restore()
    const { mails } = mail.fake()
    cleanup(() => mail.restore())

    const response = await client.post('/api/v1/sessions/sign-up').json({
      full_name: 'Test User',
      email: 'testverify@example.com',
      password: 'password123',
      password_confirmation: 'password123',
      terms_accepted: true,
    })

    response.assertStatus(201)
    assert.notProperty(response.body(), 'metadata')
    assert.isFalse(response.body().email_verified)
    assert.isNull(response.body().email_verified_at)

    mails.assertSentCount(VerifyEmailNotification, 1)
    const sent = mails.sent()[0] as VerifyEmailNotification
    const rawToken = sent.getVerificationToken()

    assert.lengthOf(rawToken, EMAIL_VERIFICATION_TOKEN_LENGTH)
    assert.isTrue(isCanonicalEmailVerificationToken(rawToken))

    const user = await User.findByOrFail('email', 'testverify@example.com')
    assert.isFalse(user.metadata.email_verified)
    assert.lengthOf(user.metadata.email_verification_token_hash!, 64)
    assert.notEqual(user.metadata.email_verification_token_hash, rawToken)
    assert.exists(user.metadata.email_verification_sent_at)
  })

  test('should verify email with the raw token matching the stored HMAC', async ({
    client,
    assert,
  }) => {
    const tokenService = await app.container.make(EmailVerificationTokenService)
    const { token, tokenHash } = tokenService.generate()
    const user = await User.create({
      full_name: 'Verify Test',
      email: 'verifytest@example.com',
      password: 'password123',
      metadata: {
        email_verified: false,
        email_verified_at: null,
        email_verification_sent_at: DateTime.now().toISO(),
        email_verification_token_hash: tokenHash,
      },
    })

    const response = await client.get(`/api/v1/verify-email?token=${token}`)

    response.assertStatus(200)
    assertPrivateResponse(response)
    response.assertHeader('x-ratelimit-limit', '10')
    response.assertBodyContains({
      message: 'Email verified successfully',
      email_verified: true,
    })

    await user.refresh()
    assert.isTrue(user.metadata.email_verified)
    assert.isNull(user.metadata.email_verification_token_hash)
    assert.isNull(user.metadata.email_verification_sent_at)
    assert.exists(user.metadata.email_verified_at)
  })

  test('should reject malformed tokens before lookup', async ({ client }) => {
    const malformedLength = await client.get('/api/v1/verify-email?token=invalid-token')
    malformedLength.assertStatus(422)
    assertPrivateResponse(malformedLength)

    const nonCanonicalPadBits = await client.get(`/api/v1/verify-email?token=${'A'.repeat(42)}B`)
    nonCanonicalPadBits.assertStatus(422)
    assertPrivateResponse(nonCanonicalPadBits)
  })

  test('should return not found for an unknown canonical token', async ({ client }) => {
    const response = await client.get(`/api/v1/verify-email?token=${'A'.repeat(43)}`)

    response.assertStatus(404)
    response.assertBodyContains({ message: 'Invalid verification token' })
  })

  test('should read the verification token only from the query string', async ({
    client,
    assert,
  }) => {
    const tokenService = await app.container.make(EmailVerificationTokenService)
    const { token, tokenHash } = tokenService.generate()
    const user = await User.create({
      full_name: 'Query Only Verification',
      email: 'query-only-verification@example.com',
      password: 'password123',
      metadata: {
        email_verified: false,
        email_verified_at: null,
        email_verification_sent_at: DateTime.now().toISO(),
        email_verification_token_hash: tokenHash,
      },
    })

    const bodyOnly = await client.get('/api/v1/verify-email').unsafeJson({ token })
    bodyOnly.assertStatus(422)

    const leadingWhitespace = await client.get(
      `/api/v1/verify-email?token=${encodeURIComponent(` ${token}`)}`
    )
    leadingWhitespace.assertStatus(422)

    await user.refresh()
    assert.isFalse(user.metadata.email_verified)
    assert.equal(user.metadata.email_verification_token_hash, tokenHash)
  })

  test('should fail if email is already verified', async ({ client }) => {
    const tokenService = await app.container.make(EmailVerificationTokenService)
    const { token, tokenHash } = tokenService.generate()

    await User.create({
      full_name: 'Already Verified',
      email: 'alreadyverified@example.com',
      password: 'password123',
      metadata: {
        email_verified: true,
        email_verification_token_hash: tokenHash,
        email_verified_at: DateTime.now().toISO(),
        email_verification_sent_at: DateTime.now().toISO(),
      },
    })

    const response = await client.get(`/api/v1/verify-email?token=${token}`)

    response.assertStatus(400)
    response.assertBodyContains({ message: 'Email already verified' })
  })

  test('should fail with an expired token', async ({ client }) => {
    const tokenService = await app.container.make(EmailVerificationTokenService)
    const { token, tokenHash } = tokenService.generate()

    await User.create({
      full_name: 'Expired Token',
      email: 'expiredtoken@example.com',
      password: 'password123',
      metadata: {
        email_verified: false,
        email_verification_token_hash: tokenHash,
        email_verification_sent_at: DateTime.now().minus({ days: 2 }).toISO(),
        email_verified_at: null,
      },
    })

    const response = await client.get(`/api/v1/verify-email?token=${token}`)

    response.assertStatus(400)
    response.assertBodyContains({
      message: 'Verification token has expired. Please request a new one.',
    })
  })

  test('should resend verification email and rotate its token', async ({
    client,
    assert,
    cleanup,
  }) => {
    mail.restore()
    const { mails } = mail.fake()
    cleanup(() => mail.restore())

    const tokenService = await app.container.make(EmailVerificationTokenService)
    const previous = tokenService.generate()
    const user = await User.create({
      full_name: 'Resend Test',
      email: 'resendtest@example.com',
      password: 'password123',
      metadata: {
        email_verified: false,
        email_verification_token_hash: previous.tokenHash,
        email_verification_sent_at: DateTime.now().toISO(),
        email_verified_at: null,
      },
    })

    const signInResponse = await client.post('/api/v1/sessions/sign-in').json({
      uid: 'resendtest@example.com',
      password: 'password123',
    })
    signInResponse.assertStatus(200)

    const response = await client
      .post('/api/v1/resend-verification-email')
      .bearerToken(signInResponse.body().auth.access_token)

    response.assertStatus(200)
    assertPrivateResponse(response)
    response.assertHeader('x-ratelimit-limit', '3')
    response.assertBodyContains({ message: 'Verification email sent successfully' })
    mails.assertSentCount(VerifyEmailNotification, 1)

    const sent = mails.sent()[0] as VerifyEmailNotification
    const rawToken = sent.getVerificationToken()

    await user.refresh()
    assert.notEqual(user.metadata.email_verification_token_hash, previous.tokenHash)
    assert.equal(user.metadata.email_verification_token_hash, tokenService.hash(rawToken))
    assert.notEqual(user.metadata.email_verification_token_hash, rawToken)
    assert.exists(user.metadata.email_verification_sent_at)
  })

  test('should preserve the previous token when email delivery fails', async ({
    client,
    assert,
    cleanup,
  }) => {
    const tokenService = await app.container.make(EmailVerificationTokenService)
    const usersRepository = await app.container.make(UsersRepository)
    const previous = tokenService.generate()
    const previousSentAt = DateTime.now().minus({ minutes: 5 }).toISO()
    const user = await User.create({
      full_name: 'Failed Resend',
      email: 'failed-resend@example.com',
      password: 'password123',
      metadata: {
        email_verified: false,
        email_verification_token_hash: previous.tokenHash,
        email_verification_sent_at: previousSentAt,
        email_verified_at: null,
      },
    })

    const signInResponse = await client.post('/api/v1/sessions/sign-in').json({
      uid: user.email,
      password: 'password123',
    })
    signInResponse.assertStatus(200)

    const failingService = new FailingVerificationDeliveryService(
      tokenService,
      usersRepository,
      new Error('controlled SMTP failure')
    )
    app.container.swap(SendVerificationEmailService, () => failingService)
    cleanup(() => app.container.restore(SendVerificationEmailService))

    const response = await client
      .post('/api/v1/resend-verification-email')
      .bearerToken(signInResponse.body().auth.access_token)

    response.assertStatus(503)
    assertPrivateResponse(response)
    response.assertBodyContains({
      message: 'Verification email could not be delivered. Please try again later.',
    })

    await user.refresh()
    assert.equal(user.metadata.email_verification_token_hash, previous.tokenHash)
    assert.equal(user.metadata.email_verification_sent_at, previousSentAt)
  })

  test('should not resend if already verified', async ({ client }) => {
    await User.create({
      full_name: 'Already Verified Resend',
      email: 'verifiedresend@example.com',
      password: 'password123',
      metadata: {
        email_verified: true,
        email_verification_token_hash: null,
        email_verified_at: DateTime.now().toISO(),
        email_verification_sent_at: null,
      },
    })

    const signInResponse = await client.post('/api/v1/sessions/sign-in').json({
      uid: 'verifiedresend@example.com',
      password: 'password123',
    })
    signInResponse.assertStatus(200)

    const response = await client
      .post('/api/v1/resend-verification-email')
      .bearerToken(signInResponse.body().auth.access_token)

    response.assertStatus(400)
    assertPrivateResponse(response)
    response.assertBodyContains({ message: 'Email already verified' })
  })

  test('should require authentication to resend verification', async ({ client }) => {
    const response = await client.post('/api/v1/resend-verification-email')
    response.assertStatus(401)
    assertPrivateResponse(response)
  })

  test('should rate limit verification attempts by IP', async ({ client }) => {
    for (let attempt = 0; attempt < 10; attempt++) {
      const response = await client.get(`/api/v1/verify-email?token=${'A'.repeat(43)}`)
      response.assertStatus(404)
    }

    const rateLimited = await client.get(`/api/v1/verify-email?token=${'A'.repeat(43)}`)
    rateLimited.assertStatus(429)
    assertPrivateResponse(rateLimited)
    rateLimited.assertHeader('x-ratelimit-limit', '10')
  })

  test('should isolate resend limits by authenticated user and IP', async ({ client, cleanup }) => {
    mail.restore()
    mail.fake()
    cleanup(() => mail.restore())

    const firstUser = await User.create({
      full_name: 'First Resend Limit',
      email: 'first-resend-limit@example.com',
      password: 'password123',
    })
    const secondUser = await User.create({
      full_name: 'Second Resend Limit',
      email: 'second-resend-limit@example.com',
      password: 'password123',
    })

    const firstSignIn = await client.post('/api/v1/sessions/sign-in').json({
      uid: firstUser.email,
      password: 'password123',
    })
    const secondSignIn = await client.post('/api/v1/sessions/sign-in').json({
      uid: secondUser.email,
      password: 'password123',
    })
    firstSignIn.assertStatus(200)
    secondSignIn.assertStatus(200)

    for (let attempt = 0; attempt < 3; attempt++) {
      const response = await client
        .post('/api/v1/resend-verification-email')
        .bearerToken(firstSignIn.body().auth.access_token)
      response.assertStatus(200)
    }

    const firstRateLimited = await client
      .post('/api/v1/resend-verification-email')
      .bearerToken(firstSignIn.body().auth.access_token)
    firstRateLimited.assertStatus(429)

    const otherUser = await client
      .post('/api/v1/resend-verification-email')
      .bearerToken(secondSignIn.body().auth.access_token)
    otherUser.assertStatus(200)
    assertPrivateResponse(otherUser)
  })
})

test.group('Email verification concurrency', (group) => {
  group.each.setup(async () => {
    await limiter.clear()
    return () => limiter.clear()
  })

  test('should consume one token exactly once under concurrent requests', async ({
    client,
    assert,
    cleanup,
  }) => {
    assert.equal(db.connectionGlobalTransactions.size, 0)
    const tokenService = await app.container.make(EmailVerificationTokenService)
    const { token, tokenHash } = tokenService.generate()
    const user = await User.create({
      full_name: 'Concurrent Verification',
      email: `concurrent-verification-${token.slice(0, 12)}@example.com`,
      password: 'password123',
      metadata: {
        email_verified: false,
        email_verified_at: null,
        email_verification_sent_at: DateTime.now().toISO(),
        email_verification_token_hash: tokenHash,
      },
    })
    const ownerPreReadBarrier = createBarrier(2)
    class BarrierUsersRepository extends UsersRepository {
      override async findOwnerByEmailVerificationTokenHash(
        currentTokenHash: string
      ): Promise<number | null> {
        const ownerUserId = await super.findOwnerByEmailVerificationTokenHash(currentTokenHash)
        await ownerPreReadBarrier.wait()
        return ownerUserId
      }
    }
    const verifyService = new VerifyEmailService(new BarrierUsersRepository(), tokenService)
    app.container.swap(VerifyEmailService, () => verifyService)
    cleanup(async () => {
      ownerPreReadBarrier.release()
      app.container.restore(VerifyEmailService)
      await User.query().where('id', user.id).delete()
    })

    const responses = await Promise.all([
      client.get(`/api/v1/verify-email?token=${token}`),
      client.get(`/api/v1/verify-email?token=${token}`),
    ])

    assert.deepEqual(
      responses.map((response) => response.status()).sort((left, right) => left - right),
      [200, 404]
    )

    await user.refresh()
    assert.isTrue(user.metadata.email_verified)
    assert.isNull(user.metadata.email_verification_token_hash)
  })

  test('should let verification consume the previous token after a concurrent resend fails', async ({
    client,
    assert,
    cleanup,
  }) => {
    assert.equal(db.connectionGlobalTransactions.size, 0)
    const tokenService = await app.container.make(EmailVerificationTokenService)
    const { token, tokenHash } = tokenService.generate()
    const user = await User.create({
      full_name: 'Concurrent Resend Failure',
      email: `concurrent-resend-${token.slice(0, 12)}@example.com`,
      password: 'password123',
      metadata: {
        email_verified: false,
        email_verified_at: null,
        email_verification_sent_at: DateTime.now().toISO(),
        email_verification_token_hash: tokenHash,
      },
    })

    const deliveryStarted = deferred()
    const releaseDelivery = deferred()
    const ownerLookupFinished = deferred()
    cleanup(async () => {
      releaseDelivery.resolve()
      app.container.restore(SendVerificationEmailService)
      app.container.restore(VerifyEmailService)
      await User.query().where('id', user.id).delete()
    })

    const signInResponse = await client.post('/api/v1/sessions/sign-in').json({
      uid: user.email,
      password: 'password123',
    })
    signInResponse.assertStatus(200)

    const usersRepository = await app.container.make(UsersRepository)
    const failingService = new FailingVerificationDeliveryService(
      tokenService,
      usersRepository,
      new Error('controlled concurrent SMTP failure'),
      async () => {
        deliveryStarted.resolve()
        await releaseDelivery.promise
      }
    )
    class SignalingUsersRepository extends UsersRepository {
      override async findOwnerByEmailVerificationTokenHash(
        currentTokenHash: string
      ): Promise<number | null> {
        const ownerUserId = await super.findOwnerByEmailVerificationTokenHash(currentTokenHash)
        ownerLookupFinished.resolve()
        return ownerUserId
      }
    }
    const verifyService = new VerifyEmailService(new SignalingUsersRepository(), tokenService)

    app.container.swap(SendVerificationEmailService, () => failingService)
    app.container.swap(VerifyEmailService, () => verifyService)

    const resendPromise = (async () =>
      client
        .post('/api/v1/resend-verification-email')
        .bearerToken(signInResponse.body().auth.access_token))()
    await deliveryStarted.promise

    const verificationPromise = (async () => client.get(`/api/v1/verify-email?token=${token}`))()
    await ownerLookupFinished.promise
    releaseDelivery.resolve()

    const [resendResponse, verificationResponse] = await Promise.all([
      resendPromise,
      verificationPromise,
    ])
    resendResponse.assertStatus(503)
    verificationResponse.assertStatus(200)

    await user.refresh()
    assert.isTrue(user.metadata.email_verified)
    assert.isNull(user.metadata.email_verification_token_hash)
  })
})
