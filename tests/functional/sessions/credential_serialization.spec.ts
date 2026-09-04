import { randomUUID } from 'node:crypto'

import { test } from '@japa/runner'
import { HttpContext } from '@adonisjs/core/http'
import testUtils from '@adonisjs/core/services/test_utils'
import db from '@adonisjs/lucid/services/db'

import BadRequestException from '#exceptions/bad_request_exception'
import UnauthorizedException from '#exceptions/unauthorized_exception'
import PasswordResetToken from '#modules/auth/models/password_reset_token'
import RefreshToken from '#modules/auth/models/refresh_token'
import PasswordResetTokenRepository from '#modules/auth/repositories/password_reset_token_repository'
import RefreshTokenRepository from '#modules/auth/repositories/refresh_token_repository'
import AdminSignInService from '#modules/auth/services/admin_sign_in_service'
import CredentialInvalidationService from '#modules/auth/services/credential_invalidation_service'
import JwtAuthTokensService from '#modules/auth/services/jwt_auth_tokens_service'
import PasswordResetTokenService from '#modules/auth/services/password_reset_token_service'
import SignInService from '#modules/auth/services/sign_in_service'
import IRole from '#modules/roles/interfaces/role_interface'
import Role from '#modules/roles/models/role'
import RolesRepository from '#modules/roles/repositories/roles_repository'
import User from '#modules/users/models/user'
import UsersRepository from '#modules/users/repositories/users_repository'
import DeleteOwnAccountService from '#modules/users/services/delete_own_account_service'
import DeleteUserService from '#modules/users/services/delete_user_service'
import EditUserService from '#modules/users/services/edit_user_service'
import JwtService from '#shared/jwt/jwt_service'

type Deferred = {
  promise: Promise<void>
  resolve: () => void
}

function deferred(): Deferred {
  let resolve!: () => void
  const promise = new Promise<void>((resolvePromise) => {
    resolve = resolvePromise
  })

  return { promise, resolve }
}

function createServices() {
  const usersRepository = new UsersRepository()
  const refreshTokenRepository = new RefreshTokenRepository()
  const passwordResetTokenRepository = new PasswordResetTokenRepository()
  const credentialInvalidationService = new CredentialInvalidationService(
    passwordResetTokenRepository,
    refreshTokenRepository
  )
  const jwtTokens = new JwtAuthTokensService(
    new JwtService(),
    refreshTokenRepository,
    usersRepository
  )

  return {
    usersRepository,
    refreshTokenRepository,
    credentialInvalidationService,
    jwtTokens,
    passwordResets: new PasswordResetTokenService(
      passwordResetTokenRepository,
      usersRepository,
      credentialInvalidationService
    ),
    signIn: new SignInService(usersRepository, jwtTokens),
    adminSignIn: new AdminSignInService(usersRepository, new RolesRepository(), jwtTokens),
    deleteOwnAccount: new DeleteOwnAccountService(usersRepository, credentialInvalidationService),
    deleteUser: new DeleteUserService(usersRepository, credentialInvalidationService),
    editUser: new EditUserService(usersRepository, credentialInvalidationService),
  }
}

async function createAccount(cleanup: (handler: () => Promise<void>) => void, label: string) {
  const suffix = randomUUID()
  const password = 'password123'
  const user = await User.create({
    full_name: `Credential ${label}`,
    email: `credential-${label}-${suffix}@example.com`,
    username: `credential-${label}-${suffix}`,
    password,
  })

  cleanup(async () => {
    await db.from('users').where('id', user.id).delete()
  })

  return { user, password }
}

test.group('Credential mutation serialization', () => {
  test('rejects a verified login snapshot after password reset wins', async ({
    assert,
    cleanup,
  }) => {
    assert.equal(db.connectionGlobalTransactions.size, 0)
    const services = createServices()
    const { user, password } = await createAccount(cleanup, 'stale-login')
    const issued = await services.passwordResets.issue(user.id)
    assert.isNotNull(issued)

    const loginVerified = deferred()
    const releaseLogin = deferred()
    const verifyCredentials = services.usersRepository.verifyCredentials.bind(
      services.usersRepository
    )
    services.usersRepository.verifyCredentials = async (...args) => {
      const verified = await verifyCredentials(...args)
      loginVerified.resolve()
      await releaseLogin.promise
      return verified
    }

    const ctx = await testUtils.createHttpContext()
    const login = services.signIn.run({ uid: user.email, password, ctx })
    await loginVerified.promise
    await services.passwordResets.consume(issued!.token, 'new-password123')
    releaseLogin.resolve()

    await assert.rejects(() => login, 'Invalid user credentials')
    const refreshTokens = await RefreshToken.query().where('user_id', user.id)
    assert.lengthOf(refreshTokens, 0)
  })

  test('rejects account deletion when its verified password snapshot becomes stale', async ({
    assert,
    cleanup,
  }) => {
    assert.equal(db.connectionGlobalTransactions.size, 0)
    const services = createServices()
    const { user, password } = await createAccount(cleanup, 'stale-delete')
    const issued = await services.passwordResets.issue(user.id)
    assert.isNotNull(issued)

    const deletionVerified = deferred()
    const releaseDeletion = deferred()
    const verifyCredentials = services.usersRepository.verifyCredentials.bind(
      services.usersRepository
    )
    services.usersRepository.verifyCredentials = async (...args) => {
      const verified = await verifyCredentials(...args)
      deletionVerified.resolve()
      await releaseDeletion.promise
      return verified
    }

    const deletion = services.deleteOwnAccount.run(user.id, {
      currentPassword: password,
      confirmation: 'EXCLUIR MINHA CONTA',
    })
    await deletionVerified.promise
    await services.passwordResets.consume(issued!.token, 'new-password123')
    releaseDeletion.resolve()

    await assert.rejects(() => deletion, 'A senha atual está incorreta')
    const storedUser = await db.from('users').where('id', user.id).firstOrFail()
    assert.isFalse(storedUser.is_deleted)
  })

  test('starts an admin refresh chain from the verified password snapshot', async ({
    assert,
    cleanup,
  }) => {
    assert.equal(db.connectionGlobalTransactions.size, 0)
    const services = createServices()
    const { user, password } = await createAccount(cleanup, 'admin-sign-in')
    const adminRole = await Role.firstOrCreate(
      { slug: IRole.Slugs.ADMIN },
      { name: 'Admin', slug: IRole.Slugs.ADMIN, description: 'Administrator role' }
    )
    await user.related('roles').attach([adminRole.id])

    const ctx = await testUtils.createHttpContext()
    const getHttpContext = HttpContext.getOrFail
    HttpContext.getOrFail = () => ctx
    cleanup(() => {
      HttpContext.getOrFail = getHttpContext
    })

    const result = await services.adminSignIn.run({ uid: user.email, password })

    assert.isString(result.auth.access_token)
    assert.isString(result.auth.refresh_token)
    const refreshTokens = await RefreshToken.query().where('user_id', user.id)
    assert.lengthOf(refreshTokens, 1)
    assert.isNull(refreshTokens[0].revoked_at)
  })

  test('revokes a child refresh when rotation commits before password reset', async ({
    assert,
    cleanup,
  }) => {
    assert.equal(db.connectionGlobalTransactions.size, 0)
    const services = createServices()
    const { user } = await createAccount(cleanup, 'rotate-before-reset')
    const auth = await services.jwtTokens.startChain(
      { userId: user.id },
      { expectedPasswordHash: user.password }
    )
    const issued = await services.passwordResets.issue(user.id)
    assert.isNotNull(issued)

    const rotationEntered = deferred()
    const releaseRotation = deferred()
    const resetRequestedUserLock = deferred()
    let observeReset = false
    const findActiveUser = services.usersRepository.findActiveByIdForUpdate.bind(
      services.usersRepository
    )
    services.usersRepository.findActiveByIdForUpdate = async (userId, client) => {
      if (observeReset) {
        resetRequestedUserLock.resolve()
      }
      return findActiveUser(userId, client)
    }

    const rotation = services.jwtTokens.rotateForAuthenticatedUser(
      auth.refresh_token,
      user.id,
      async () => {
        rotationEntered.resolve()
        await releaseRotation.promise
        return { value: undefined }
      }
    )
    await rotationEntered.promise

    observeReset = true
    const reset = services.passwordResets.consume(issued!.token, 'new-password123')
    await resetRequestedUserLock.promise
    releaseRotation.resolve()

    await rotation
    await reset

    const refreshTokens = await RefreshToken.query().where('user_id', user.id).orderBy('id', 'asc')
    assert.lengthOf(refreshTokens, 2)
    assert.isNotNull(refreshTokens[0].revoked_at)
    assert.isNotNull(refreshTokens[1].revoked_at)
    assert.equal(refreshTokens[1].rotated_from_id, refreshTokens[0].id)
  })

  test('rejects refresh without a child when password reset commits first', async ({
    assert,
    cleanup,
  }) => {
    assert.equal(db.connectionGlobalTransactions.size, 0)
    const services = createServices()
    const { user } = await createAccount(cleanup, 'reset-before-refresh')
    const auth = await services.jwtTokens.startChain(
      { userId: user.id },
      { expectedPasswordHash: user.password }
    )
    const issued = await services.passwordResets.issue(user.id)
    assert.isNotNull(issued)

    const resetReachedInvalidation = deferred()
    const releaseReset = deferred()
    const refreshRequestedUserLock = deferred()
    const invalidateCredentials = services.credentialInvalidationService.run.bind(
      services.credentialInvalidationService
    )
    services.credentialInvalidationService.run = async (...args) => {
      resetReachedInvalidation.resolve()
      await releaseReset.promise
      return invalidateCredentials(...args)
    }

    let observeRefresh = false
    const findActiveUser = services.usersRepository.findActiveByIdForUpdate.bind(
      services.usersRepository
    )
    services.usersRepository.findActiveByIdForUpdate = async (userId, client) => {
      if (observeRefresh) {
        refreshRequestedUserLock.resolve()
      }
      return findActiveUser(userId, client)
    }

    const reset = services.passwordResets.consume(issued!.token, 'new-password123')
    await resetReachedInvalidation.promise

    observeRefresh = true
    const refresh = services.jwtTokens.refresh(auth.refresh_token)
    await refreshRequestedUserLock.promise
    releaseReset.resolve()

    await reset
    await assert.rejects(() => refresh, 'Invalid or expired refresh token')

    const refreshTokens = await RefreshToken.query().where('user_id', user.id)
    assert.lengthOf(refreshTokens, 1)
    assert.isNotNull(refreshTokens[0].revoked_at)
    assert.isNull(refreshTokens[0].rotated_from_id)
  })

  test('serializes account deletion behind rotation without deadlock or active refresh', async ({
    assert,
    cleanup,
  }) => {
    assert.equal(db.connectionGlobalTransactions.size, 0)
    const services = createServices()
    const { user } = await createAccount(cleanup, 'delete-and-rotate')
    const auth = await services.jwtTokens.startChain(
      { userId: user.id },
      { expectedPasswordHash: user.password }
    )

    const rotationEntered = deferred()
    const releaseRotation = deferred()
    const deleteRequestedUserLock = deferred()
    let observeDelete = false
    const findActiveUser = services.usersRepository.findActiveByIdForUpdate.bind(
      services.usersRepository
    )
    services.usersRepository.findActiveByIdForUpdate = async (userId, client) => {
      if (observeDelete) {
        deleteRequestedUserLock.resolve()
      }
      return findActiveUser(userId, client)
    }

    const rotation = services.jwtTokens.rotateForAuthenticatedUser(
      auth.refresh_token,
      user.id,
      async () => {
        rotationEntered.resolve()
        await releaseRotation.promise
        return { value: undefined }
      }
    )
    await rotationEntered.promise

    observeDelete = true
    const deletion = services.deleteUser.run(user.id)
    await deleteRequestedUserLock.promise
    releaseRotation.resolve()

    await rotation
    await deletion

    const storedUser = await db.from('users').where('id', user.id).firstOrFail()
    assert.isTrue(storedUser.is_deleted)
    const refreshTokens = await RefreshToken.query().where('user_id', user.id)
    assert.lengthOf(refreshTokens, 2)
    assert.isTrue(refreshTokens.every((token) => token.revoked_at !== null))
  })

  test('keeps exactly one active password reset token under concurrent issuance', async ({
    assert,
    cleanup,
  }) => {
    assert.equal(db.connectionGlobalTransactions.size, 0)
    const services = createServices()
    const { user } = await createAccount(cleanup, 'reset-issue')

    const issued = await Promise.all([
      services.passwordResets.issue(user.id),
      services.passwordResets.issue(user.id),
    ])

    assert.isTrue(issued.every((token) => token !== null))
    const tokens = await PasswordResetToken.query().where('user_id', user.id)
    assert.lengthOf(tokens, 2)
    assert.lengthOf(
      tokens.filter((token) => token.consumed_at === null),
      1
    )
  })

  test('allows exactly one concurrent consume of a password reset token', async ({
    assert,
    cleanup,
  }) => {
    assert.equal(db.connectionGlobalTransactions.size, 0)
    const services = createServices()
    const { user } = await createAccount(cleanup, 'reset-consume')
    const auth = await services.jwtTokens.startChain(
      { userId: user.id },
      { expectedPasswordHash: user.password }
    )
    const issued = await services.passwordResets.issue(user.id)
    assert.isNotNull(issued)

    const results = await Promise.allSettled([
      services.passwordResets.consume(issued!.token, 'first-password123'),
      services.passwordResets.consume(issued!.token, 'second-password123'),
    ])

    assert.deepEqual(results.map((result) => result.status).sort(), ['fulfilled', 'rejected'])
    const rejected = results.find((result) => result.status === 'rejected')
    assert.instanceOf(rejected!.reason, BadRequestException)
    assert.equal(rejected!.reason.message, 'Invalid or expired password reset token')

    const refresh = await RefreshToken.query().where('user_id', user.id).firstOrFail()
    assert.equal(refresh.token_hash.length, 64)
    assert.isNotNull(refresh.revoked_at)
    const resetToken = await PasswordResetToken.query().where('user_id', user.id).firstOrFail()
    assert.isNotNull(resetToken.consumed_at)
    await assert.rejects(
      () => services.jwtTokens.refresh(auth.refresh_token),
      'Invalid or expired refresh token'
    )
  })

  test('keeps logout idempotent after password reset and account deletion', async ({
    assert,
    cleanup,
  }) => {
    assert.equal(db.connectionGlobalTransactions.size, 0)
    const services = createServices()
    const resetAccount = await createAccount(cleanup, 'logout-reset')
    const resetAuth = await services.jwtTokens.startChain(
      { userId: resetAccount.user.id },
      { expectedPasswordHash: resetAccount.user.password }
    )
    const issued = await services.passwordResets.issue(resetAccount.user.id)
    assert.isNotNull(issued)
    await services.passwordResets.consume(issued!.token, 'new-password123')

    await services.jwtTokens.revoke(resetAuth.refresh_token)
    await services.jwtTokens.revoke(resetAuth.refresh_token)

    const deletedAccount = await createAccount(cleanup, 'logout-delete')
    const deletedAuth = await services.jwtTokens.startChain(
      { userId: deletedAccount.user.id },
      { expectedPasswordHash: deletedAccount.user.password }
    )
    await services.deleteUser.run(deletedAccount.user.id)

    await services.jwtTokens.revoke(deletedAuth.refresh_token)
    await services.jwtTokens.revoke(deletedAuth.refresh_token)

    const active = await RefreshToken.query()
      .whereIn('user_id', [resetAccount.user.id, deletedAccount.user.id])
      .whereNull('revoked_at')
    assert.lengthOf(active, 0)
  })

  test('revokes the refresh descendants when rotation commits before logout of the root', async ({
    assert,
    cleanup,
  }) => {
    assert.equal(db.connectionGlobalTransactions.size, 0)
    const services = createServices()
    const { user } = await createAccount(cleanup, 'rotate-before-logout')
    const rootAuth = await services.jwtTokens.startChain(
      { userId: user.id },
      { expectedPasswordHash: user.password }
    )
    const childAuth = await services.jwtTokens.refresh(rootAuth.refresh_token)
    await services.jwtTokens.startChain(
      { userId: user.id },
      { expectedPasswordHash: user.password }
    )

    const rotationEntered = deferred()
    const releaseRotation = deferred()
    const logoutRequestedUserLock = deferred()
    let observeLogout = false
    const findActiveUser = services.usersRepository.findActiveByIdForUpdate.bind(
      services.usersRepository
    )
    services.usersRepository.findActiveByIdForUpdate = async (userId, client) => {
      if (observeLogout) {
        logoutRequestedUserLock.resolve()
      }
      return findActiveUser(userId, client)
    }

    const rotation = services.jwtTokens.rotateForAuthenticatedUser(
      childAuth.refresh_token,
      user.id,
      async () => {
        rotationEntered.resolve()
        await releaseRotation.promise
        return { value: undefined }
      }
    )
    await rotationEntered.promise

    observeLogout = true
    const logout = services.jwtTokens.revoke(rootAuth.refresh_token)
    await logoutRequestedUserLock.promise
    releaseRotation.resolve()

    await rotation
    await logout

    const tokens = await RefreshToken.query().where('user_id', user.id).orderBy('id', 'asc')
    assert.lengthOf(tokens, 4)
    assert.isNotNull(tokens[0].revoked_at)
    assert.isNotNull(tokens[1].revoked_at)
    assert.isNull(tokens[2].revoked_at)
    assert.isNotNull(tokens[3].revoked_at)
    assert.equal(tokens[1].rotated_from_id, tokens[0].id)
    assert.isNull(tokens[2].rotated_from_id)
    assert.equal(tokens[3].rotated_from_id, tokens[1].id)
  })

  test('rejects rotation without a child when logout commits first', async ({
    assert,
    cleanup,
  }) => {
    assert.equal(db.connectionGlobalTransactions.size, 0)
    const services = createServices()
    const { user } = await createAccount(cleanup, 'logout-before-rotate')
    const auth = await services.jwtTokens.startChain(
      { userId: user.id },
      { expectedPasswordHash: user.password }
    )

    const logoutReachedRevocation = deferred()
    const releaseLogout = deferred()
    const rotationRequestedUserLock = deferred()
    const revokeChainFrom = services.refreshTokenRepository.revokeChainFrom.bind(
      services.refreshTokenRepository
    )
    services.refreshTokenRepository.revokeChainFrom = async (...args) => {
      logoutReachedRevocation.resolve()
      await releaseLogout.promise
      return revokeChainFrom(...args)
    }

    const logout = services.jwtTokens.revoke(auth.refresh_token)
    await logoutReachedRevocation.promise

    const findActiveUser = services.usersRepository.findActiveByIdForUpdate.bind(
      services.usersRepository
    )
    services.usersRepository.findActiveByIdForUpdate = async (userId, client) => {
      rotationRequestedUserLock.resolve()
      return findActiveUser(userId, client)
    }

    const rotation = services.jwtTokens.refresh(auth.refresh_token)
    await rotationRequestedUserLock.promise
    releaseLogout.resolve()

    await logout
    await assert.rejects(() => rotation, 'Invalid or expired refresh token')

    const tokens = await RefreshToken.query().where('user_id', user.id)
    assert.lengthOf(tokens, 1)
    assert.isNotNull(tokens[0].revoked_at)
    assert.isNull(tokens[0].rotated_from_id)
  })

  test('invalidates reset, refresh, and persisted access tokens on admin password edit', async ({
    assert,
    cleanup,
  }) => {
    assert.equal(db.connectionGlobalTransactions.size, 0)
    const services = createServices()
    const { user } = await createAccount(cleanup, 'admin-password')
    await services.jwtTokens.startChain(
      { userId: user.id },
      { expectedPasswordHash: user.password }
    )
    const issued = await services.passwordResets.issue(user.id)
    assert.isNotNull(issued)
    await db.table('auth_access_tokens').insert({
      tokenable_id: user.id,
      type: 'auth_token',
      name: 'test credential',
      hash: randomUUID(),
      abilities: '[]',
      created_at: new Date(),
      updated_at: new Date(),
    })

    const updated = await services.editUser.run(user.id, { password: 'admin-password123' })
    assert.isNotNull(updated)

    const activeRefresh = await RefreshToken.query()
      .where('user_id', user.id)
      .whereNull('revoked_at')
    const activeResets = await PasswordResetToken.query()
      .where('user_id', user.id)
      .whereNull('consumed_at')
    const accessTokens = await db.from('auth_access_tokens').where('tokenable_id', user.id)
    assert.lengthOf(activeRefresh, 0)
    assert.lengthOf(activeResets, 0)
    assert.lengthOf(accessTokens, 0)
    const verifiedUser = await User.verifyCredentials(user.email, 'admin-password123')
    assert.equal(verifiedUser.id, user.id)
  })

  test('allows exactly one concurrent rotation of the same refresh token', async ({
    assert,
    cleanup,
  }) => {
    assert.equal(db.connectionGlobalTransactions.size, 0)
    const services = createServices()
    const { user } = await createAccount(cleanup, 'same-refresh')
    const auth = await services.jwtTokens.startChain(
      { userId: user.id },
      { expectedPasswordHash: user.password }
    )

    const results = await Promise.allSettled([
      services.jwtTokens.refresh(auth.refresh_token),
      services.jwtTokens.refresh(auth.refresh_token),
    ])

    assert.deepEqual(results.map((result) => result.status).sort(), ['fulfilled', 'rejected'])
    const rejected = results.find((result) => result.status === 'rejected')
    assert.instanceOf(rejected!.reason, UnauthorizedException)
    assert.equal(rejected!.reason.message, 'Invalid or expired refresh token')

    const tokens = await RefreshToken.query().where('user_id', user.id).orderBy('id', 'asc')
    assert.lengthOf(tokens, 2)
    assert.isNotNull(tokens[0].revoked_at)
    assert.isNull(tokens[1].revoked_at)
    assert.equal(tokens[1].rotated_from_id, tokens[0].id)
  })
})
