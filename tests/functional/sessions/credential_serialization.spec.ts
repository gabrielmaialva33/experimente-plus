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
import PermissionCacheService from '#modules/permissions/services/permission_cache_service'
import IRole from '#modules/roles/interfaces/role_interface'
import Role from '#modules/roles/models/role'
import RolesRepository from '#modules/roles/repositories/roles_repository'
import User from '#modules/users/models/user'
import UsersRepository from '#modules/users/repositories/users_repository'
import ActiveRootGuardService from '#modules/users/services/active_root_guard_service'
import DeleteOwnAccountService from '#modules/users/services/delete_own_account_service'
import DeleteUserService from '#modules/users/services/delete_user_service'
import EditUserService from '#modules/users/services/edit_user_service'
import UserAdministrationPolicyService from '#modules/users/services/user_administration_policy_service'
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
  const userAdministrationPolicyService = {
    async assertCanUpdate() {},
    async assertCanDelete() {},
  } as unknown as UserAdministrationPolicyService
  const activeRootGuardService = new ActiveRootGuardService()

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
    deleteOwnAccount: new DeleteOwnAccountService(
      usersRepository,
      credentialInvalidationService,
      activeRootGuardService,
      new PermissionCacheService(usersRepository)
    ),
    deleteUser: new DeleteUserService(
      usersRepository,
      credentialInvalidationService,
      userAdministrationPolicyService,
      new PermissionCacheService(usersRepository)
    ),
    editUser: new EditUserService(
      usersRepository,
      credentialInvalidationService,
      userAdministrationPolicyService
    ),
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
    cleanup(() => releaseLogin.resolve())
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
    cleanup(() => releaseDeletion.resolve())
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
    assert.deepEqual(Object.keys(result).sort(), [
      'auth',
      'created_at',
      'email',
      'email_verified',
      'email_verified_at',
      'full_name',
      'id',
      'roles',
      'updated_at',
      'username',
    ])
    assert.lengthOf(result.roles, 1)
    assert.deepEqual(Object.keys(result.roles[0]).sort(), [
      'created_at',
      'description',
      'id',
      'name',
      'slug',
      'updated_at',
    ])
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
    cleanup(() => releaseRotation.resolve())
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
    cleanup(() => releaseReset.resolve())
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
    cleanup(() => releaseRotation.resolve())
    let observeDelete = false
    const lockActiveUsers = services.usersRepository.lockActiveByIds.bind(services.usersRepository)
    services.usersRepository.lockActiveByIds = async (userIds, client) => {
      if (observeDelete) {
        deleteRequestedUserLock.resolve()
      }
      return lockActiveUsers(userIds, client)
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
    const deletion = services.deleteUser.run(user.id, user.id)
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

  test('rejects a target mutation after a concurrent actor deletion commits', async ({
    assert,
    cleanup,
  }) => {
    assert.equal(db.connectionGlobalTransactions.size, 0)
    const services = createServices()
    const actorAccount = await createAccount(cleanup, 'deleted-admin-actor')
    const targetAccount = await createAccount(cleanup, 'deleted-admin-target')
    const adminRole = await Role.findByOrFail('slug', IRole.Slugs.ADMIN)
    const userRole = await Role.findByOrFail('slug', IRole.Slugs.USER)
    await actorAccount.user.related('roles').attach([adminRole.id])
    await targetAccount.user.related('roles').attach([userRole.id])

    const policy = new UserAdministrationPolicyService(new ActiveRootGuardService())
    const editUser = new EditUserService(
      services.usersRepository,
      services.credentialInvalidationService,
      policy
    )
    const actorDeletionLocked = deferred()
    const releaseActorDeletion = deferred()
    cleanup(() => releaseActorDeletion.resolve())
    const actorDeletion = db.transaction(async (client) => {
      const actor = await services.usersRepository.findActiveByIdForUpdate(
        actorAccount.user.id,
        client
      )
      if (!actor) throw new Error('Expected the administrative actor to be active')

      actorDeletionLocked.resolve()
      await releaseActorDeletion.promise
      actor.useTransaction(client)
      actor.is_deleted = true
      await actor.save()
    })
    await actorDeletionLocked.promise

    const mutationRequestedLocks = deferred()
    const lockActiveUsers = services.usersRepository.lockActiveByIds.bind(services.usersRepository)
    services.usersRepository.lockActiveByIds = async (userIds, client) => {
      mutationRequestedLocks.resolve()
      return lockActiveUsers(userIds, client)
    }

    let mutationSettled = false
    const mutation = editUser.run(actorAccount.user.id, targetAccount.user.id, {
      full_name: 'Unauthorized concurrent mutation',
    })
    void mutation.then(
      () => {
        mutationSettled = true
      },
      () => {
        mutationSettled = true
      }
    )
    await mutationRequestedLocks.promise
    await new Promise<void>((resolve) => setImmediate(resolve))
    assert.isFalse(mutationSettled)

    releaseActorDeletion.resolve()
    await actorDeletion
    await assert.rejects(() => mutation, 'The acting user is no longer active')

    await targetAccount.user.refresh()
    assert.notEqual(targetAccount.user.full_name, 'Unauthorized concurrent mutation')
  })

  test('reasserts the admin ACL after role demotions that still dominate the target', async ({
    assert,
    cleanup,
  }) => {
    assert.equal(db.connectionGlobalTransactions.size, 0)

    for (const scenario of [
      {
        label: 'moderator-over-user',
        demotedActorSlug: IRole.Slugs.MODERATOR,
        targetSlug: IRole.Slugs.USER,
      },
      {
        label: 'user-over-guest',
        demotedActorSlug: IRole.Slugs.USER,
        targetSlug: IRole.Slugs.GUEST,
      },
    ]) {
      const services = createServices()
      // Create the target first so the repository must reorder [actor, target].
      const targetAccount = await createAccount(cleanup, `${scenario.label}-target`)
      const actorAccount = await createAccount(cleanup, `${scenario.label}-actor`)
      const adminRole = await Role.findByOrFail('slug', IRole.Slugs.ADMIN)
      const demotedActorRole = await Role.findByOrFail('slug', scenario.demotedActorSlug)
      const targetRole = await Role.findByOrFail('slug', scenario.targetSlug)
      assert.isTrue(IRole.dominates(demotedActorRole.slug, targetRole.slug))
      await actorAccount.user.related('roles').attach([adminRole.id])
      await targetAccount.user.related('roles').attach([targetRole.id])

      const policy = new UserAdministrationPolicyService(new ActiveRootGuardService())
      const editUser = new EditUserService(
        services.usersRepository,
        services.credentialInvalidationService,
        policy
      )
      const actorDemotionLocked = deferred()
      const releaseActorDemotion = deferred()
      cleanup(() => releaseActorDemotion.resolve())
      const actorDemotion = db.transaction(async (client) => {
        const actor = await services.usersRepository.findActiveByIdForUpdate(
          actorAccount.user.id,
          client
        )
        if (!actor) throw new Error('Expected the administrative actor to be active')

        actorDemotionLocked.resolve()
        await releaseActorDemotion.promise
        await client
          .from('user_roles')
          .where('user_id', actor.id)
          .where('role_id', adminRole.id)
          .update({ role_id: demotedActorRole.id, updated_at: new Date() })
      })
      await actorDemotionLocked.promise

      const mutationRequestedLocks = deferred()
      const lockActiveUsers = services.usersRepository.lockActiveByIds.bind(
        services.usersRepository
      )
      services.usersRepository.lockActiveByIds = async (userIds, client) => {
        mutationRequestedLocks.resolve()
        return lockActiveUsers(userIds, client)
      }

      let mutationSettled = false
      const forbiddenName = `Unauthorized ${scenario.label} mutation`
      const mutation = editUser.run(actorAccount.user.id, targetAccount.user.id, {
        full_name: forbiddenName,
      })
      void mutation.then(
        () => {
          mutationSettled = true
        },
        () => {
          mutationSettled = true
        }
      )
      await mutationRequestedLocks.promise
      await new Promise<void>((resolve) => setImmediate(resolve))
      assert.isFalse(mutationSettled)

      releaseActorDemotion.resolve()
      await actorDemotion
      await assert.rejects(() => mutation, 'The acting user is no longer a platform administrator')

      await targetAccount.user.refresh()
      assert.notEqual(targetAccount.user.full_name, forbiddenName)
    }
  })

  test('allows only one of two concurrent root self-deletions', async ({ assert, cleanup }) => {
    assert.equal(db.connectionGlobalTransactions.size, 0)
    const services = createServices()
    const first = await createAccount(cleanup, 'concurrent-root-first')
    const second = await createAccount(cleanup, 'concurrent-root-second')
    const rootRole = await Role.findByOrFail('slug', IRole.Slugs.ROOT)
    await first.user.related('roles').attach([rootRole.id])
    await second.user.related('roles').attach([rootRole.id])
    const epochCache = new PermissionCacheService(services.usersRepository)
    const epochBefore = await epochCache.getUserPermissionsSnapshot(first.user.id)

    const bothPasswordsVerified = deferred()
    const releasePasswordVerifications = deferred()
    cleanup(() => releasePasswordVerifications.resolve())
    let verifiedPasswords = 0
    const verifyCredentials = services.usersRepository.verifyCredentials.bind(
      services.usersRepository
    )
    services.usersRepository.verifyCredentials = async (...args) => {
      const verifiedUser = await verifyCredentials(...args)
      verifiedPasswords += 1
      if (verifiedPasswords === 2) {
        bothPasswordsVerified.resolve()
      }
      await releasePasswordVerifications.promise
      return verifiedUser
    }

    const confirmation = 'EXCLUIR MINHA CONTA'
    const deletions = [
      services.deleteOwnAccount.run(first.user.id, {
        currentPassword: first.password,
        confirmation,
      }),
      services.deleteOwnAccount.run(second.user.id, {
        currentPassword: second.password,
        confirmation,
      }),
    ]
    await bothPasswordsVerified.promise
    releasePasswordVerifications.resolve()

    const results = await Promise.allSettled(deletions)

    assert.deepEqual(results.map((result) => result.status).sort(), ['fulfilled', 'rejected'])
    const rejected = results.find((result) => result.status === 'rejected')
    assert.instanceOf(rejected!.reason, BadRequestException)
    assert.equal(rejected!.reason.message, 'The last active root user cannot be deleted')
    const epochAfter = await epochCache.getUserPermissionsSnapshot(first.user.id)
    assert.equal(BigInt(epochAfter.epoch), BigInt(epochBefore.epoch) + 1n)

    const activeRoots = await db
      .from('users')
      .innerJoin('user_roles', 'user_roles.user_id', 'users.id')
      .whereIn('users.id', [first.user.id, second.user.id])
      .where('users.is_deleted', false)
      .where('user_roles.role_id', rootRole.id)
    assert.lengthOf(activeRoots, 1)
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
    await services.deleteUser.run(deletedAccount.user.id, deletedAccount.user.id)

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
    cleanup(() => releaseRotation.resolve())
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
    cleanup(() => releaseLogout.resolve())
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

    const updated = await services.editUser.run(user.id, user.id, {
      password: 'admin-password123',
    })
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
