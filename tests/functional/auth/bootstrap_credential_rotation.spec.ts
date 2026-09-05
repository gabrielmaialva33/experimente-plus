import { randomBytes, randomUUID } from 'node:crypto'
import { chmod, mkdtemp, readFile, rm, stat, writeFile } from 'node:fs/promises'
import { tmpdir } from 'node:os'
import { join } from 'node:path'

import { test } from '@japa/runner'
import app from '@adonisjs/core/services/app'
import hash from '@adonisjs/core/services/hash'
import db from '@adonisjs/lucid/services/db'
import type { TransactionClientContract } from '@adonisjs/lucid/types/database'

import PasswordResetTokenRepository from '#modules/auth/repositories/password_reset_token_repository'
import RefreshTokenRepository from '#modules/auth/repositories/refresh_token_repository'
import BootstrapCredentialRotationService from '#modules/auth/services/bootstrap_credential_rotation_service'
import CredentialInvalidationService from '#modules/auth/services/credential_invalidation_service'
import {
  BootstrapCredentialRotationError,
  type BootstrapCredentialDocument,
  type BootstrapPasswordCommitState,
} from '#modules/auth/utils/bootstrap_credential_rotation'
import IRole from '#modules/roles/interfaces/role_interface'
import Role from '#modules/roles/models/role'
import User, { type UserMetadata } from '#modules/users/models/user'
import UsersRepository from '#modules/users/repositories/users_repository'

const ARGON_HASH_MARKER = '$argon2'

type AccountSnapshot = {
  id: number
  fullName: string
  email: string
  username: string | null
  passwordHash: string
  credentialVersion: number
  metadata: UserMetadata
  roleSlugs: string[]
}

type MutationObservation = {
  users: Array<{
    id: number
    passwordHash: string
    credentialVersion: number
    metadata: UserMetadata
  }>
  resetTokens: Array<{ consumedAt: unknown }>
  refreshTokens: Array<{ revokedAt: unknown }>
  accessTokenCount: number
}

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

function makeCredentialInvalidationService(): CredentialInvalidationService {
  return new CredentialInvalidationService(
    new PasswordResetTokenRepository(),
    new RefreshTokenRepository()
  )
}

class FailingAfterCredentialMutationsService extends BootstrapCredentialRotationService {
  observation: MutationObservation | undefined

  constructor(private readonly selectedUserIds: number[]) {
    super(new UsersRepository(), makeCredentialInvalidationService())
  }

  protected override async afterCredentialsMutated(
    client: TransactionClientContract
  ): Promise<void> {
    const users = await client
      .from('users')
      .whereIn('id', this.selectedUserIds)
      .orderBy('id', 'asc')
      .select('id', 'password', 'credential_version', 'metadata')
    const resetTokens = await client
      .from('password_reset_tokens')
      .whereIn('user_id', this.selectedUserIds)
      .select('consumed_at')
    const refreshTokens = await client
      .from('auth_refresh_tokens')
      .whereIn('user_id', this.selectedUserIds)
      .select('revoked_at')
    const accessTokens = await client
      .from('auth_access_tokens')
      .whereIn('tokenable_id', this.selectedUserIds)
      .select('id')

    this.observation = {
      users: users.map((row) => ({
        id: Number(row.id),
        passwordHash: String(row.password),
        credentialVersion: Number(row.credential_version),
        metadata: row.metadata as UserMetadata,
      })),
      resetTokens: resetTokens.map((row) => ({ consumedAt: row.consumed_at })),
      refreshTokens: refreshTokens.map((row) => ({ revokedAt: row.revoked_at })),
      accessTokenCount: accessTokens.length,
    }

    throw new Error('Injected failure after credential mutations')
  }
}

class InspectableCommitOutcomeService extends BootstrapCredentialRotationService {
  constructor() {
    super(new UsersRepository(), makeCredentialInvalidationService())
  }

  inspectCommitOutcome(states: BootstrapPasswordCommitState[]) {
    return this.resolveCommitOutcome(states)
  }
}

class PausingBootstrapCredentialRotationService extends BootstrapCredentialRotationService {
  readonly mutationsReached = deferred()
  readonly releaseMutations = deferred()

  constructor() {
    super(new UsersRepository(), makeCredentialInvalidationService())
  }

  protected override async afterCredentialsMutated(): Promise<void> {
    this.mutationsReached.resolve()
    await this.releaseMutations.promise
  }
}

class RejectingGeneratedCredentialService extends BootstrapCredentialRotationService {
  constructor() {
    super(new UsersRepository(), makeCredentialInvalidationService())
  }

  protected override async verifyGeneratedCredential(): Promise<boolean> {
    return false
  }
}

class LosingCoordinatorBootstrapCredentialRotationService extends BootstrapCredentialRotationService {
  readonly coordinationLost = deferred()
  readonly releaseMutation = deferred()
  private coordinationTransaction: TransactionClientContract | undefined

  constructor() {
    super(new UsersRepository(), makeCredentialInvalidationService())
  }

  protected override async afterCoordinationLeaseAcquired(
    client: TransactionClientContract
  ): Promise<void> {
    this.coordinationTransaction = client
  }

  protected override async afterCredentialsMutated(): Promise<void> {
    await this.coordinationTransaction!.rollback()
    this.coordinationLost.resolve()
    await this.releaseMutation.promise
  }
}

async function createPrivateOutputDirectory(): Promise<string> {
  const directory = await mkdtemp(join(tmpdir(), 'experimente-bootstrap-functional-'))
  await chmod(directory, 0o700)
  return directory
}

async function createSelectedAccounts(
  label: string,
  includeRoot: boolean
): Promise<AccountSnapshot[]> {
  const suffix = randomUUID()
  const rootRole = await Role.findByOrFail('slug', IRole.Slugs.ROOT)
  const userRole = await Role.findByOrFail('slug', IRole.Slugs.USER)
  const accounts: AccountSnapshot[] = []

  for (const index of [0, 1, 2]) {
    const metadata: UserMetadata = {
      email_verified: index !== 1,
      email_verification_token_hash: `${index + 1}`.repeat(64),
      email_verification_sent_at: '2026-09-04T12:00:00.000Z',
      email_verified_at: index !== 1 ? '2026-09-03T12:00:00.000Z' : null,
    }
    const user = await User.create({
      full_name: `Bootstrap ${label} ${index}`,
      email: `bootstrap-${label}-${index}-${suffix}@example.com`,
      username: `bootstrap-${label}-${index}-${suffix}`,
      password: `original-password-${index}`,
      metadata,
    })
    const role = includeRoot && index === 2 ? rootRole : userRole
    await user.related('roles').attach([role.id])
    await user.refresh()

    accounts.push({
      id: user.id,
      fullName: user.full_name,
      email: user.email,
      username: user.username,
      passwordHash: user.password,
      credentialVersion: user.credential_version,
      metadata: { ...metadata },
      roleSlugs: [role.slug],
    })
  }

  return accounts
}

async function seedRevocableCredentials(accounts: AccountSnapshot[]): Promise<void> {
  const now = new Date()
  const expiresAt = new Date(Date.now() + 3_600_000)

  await db.table('password_reset_tokens').multiInsert(
    accounts.map((account) => ({
      user_id: account.id,
      token_hash: randomBytes(32).toString('hex'),
      expires_at: expiresAt,
      consumed_at: null,
      created_at: now,
      updated_at: now,
    }))
  )
  await db.table('auth_refresh_tokens').multiInsert(
    accounts.map((account) => ({
      user_id: account.id,
      tenant_id: null,
      token_hash: randomBytes(32).toString('hex'),
      expires_at: expiresAt,
      revoked_at: null,
      rotated_from_id: null,
      created_at: now,
      updated_at: now,
    }))
  )
  await db.table('auth_access_tokens').multiInsert(
    accounts.map((account, index) => ({
      tokenable_id: account.id,
      type: 'auth_token',
      name: 'bootstrap-rotation-test',
      hash: `${index + 7}`.repeat(64),
      abilities: JSON.stringify(['*']),
      created_at: now,
      updated_at: now,
      last_used_at: null,
      expires_at: expiresAt,
    }))
  )
}

async function deleteAccounts(accounts: AccountSnapshot[]): Promise<void> {
  if (accounts.length > 0) {
    await db
      .from('users')
      .whereIn(
        'id',
        accounts.map((account) => account.id)
      )
      .delete()
  }
}

test.group('Bootstrap credential rotation command service', () => {
  test('rotates three explicit active users atomically and preserves identity, roles, and verification state', async ({
    assert,
    cleanup,
  }) => {
    assert.equal(db.connectionGlobalTransactions.size, 0)
    const outputDirectory = await createPrivateOutputDirectory()
    const outputPath = join(outputDirectory, 'bootstrap-credentials.json')
    const accounts = await createSelectedAccounts('success', true)
    cleanup(async () => {
      await deleteAccounts(accounts)
      await rm(outputDirectory, { recursive: true, force: true })
    })
    await seedRevocableCredentials(accounts)

    const service = await app.container.make(BootstrapCredentialRotationService)
    const result = await service.run({
      userIds: [accounts[2].id, accounts[0].id, accounts[1].id],
      outputPath,
      applicationRoot: app.makePath(),
    })

    assert.deepEqual(result, { rotatedUsers: 3, commitConfirmedAfterError: false })
    const outputStat = await stat(outputPath)
    assert.equal(outputStat.mode & 0o777, 0o600)

    const rawDocument = await readFile(outputPath, 'utf8')
    const document = JSON.parse(rawDocument) as BootstrapCredentialDocument
    assert.equal(document.schema_version, 1)
    assert.lengthOf(document.accounts, 3)
    assert.equal(document.accounts[0].user_id, accounts[2].id)
    assert.notInclude(rawDocument, ARGON_HASH_MARKER)

    const generatedPasswords = document.accounts.map((account) => account.password)
    assert.equal(new Set(generatedPasswords).size, 3)
    for (const password of generatedPasswords) {
      assert.match(password, /^[A-Za-z0-9_-]{43}$/)
      assert.lengthOf(Buffer.from(password, 'base64url'), 32)
    }

    const reloadedUsers = await User.query()
      .whereIn(
        'id',
        accounts.map((account) => account.id)
      )
      .orderBy('id', 'asc')
    assert.equal(new Set(reloadedUsers.map((user) => user.password)).size, 3)

    for (const original of accounts) {
      const reloaded = reloadedUsers.find((user) => user.id === original.id)!
      const outputAccount = document.accounts.find((account) => account.user_id === original.id)!
      await reloaded.load('roles')

      assert.equal(reloaded.full_name, original.fullName)
      assert.equal(reloaded.email, original.email)
      assert.equal(reloaded.username, original.username)
      assert.equal(reloaded.credential_version, original.credentialVersion + 1)
      assert.deepEqual(
        reloaded.roles.map((role) => role.slug),
        original.roleSlugs
      )
      assert.equal(reloaded.metadata.email_verified, original.metadata.email_verified)
      assert.equal(reloaded.metadata.email_verified_at, original.metadata.email_verified_at)
      assert.isNull(reloaded.metadata.email_verification_token_hash)
      assert.isNull(reloaded.metadata.email_verification_sent_at)
      assert.isTrue(await hash.use('argon').verify(reloaded.password, outputAccount.password))
      assert.isFalse(
        await hash
          .use('argon')
          .verify(reloaded.password, `original-password-${accounts.indexOf(original)}`)
      )
      assert.match(reloaded.password, /^\$argon2id\$/)
    }

    const resetTokens = await db.from('password_reset_tokens').whereIn(
      'user_id',
      accounts.map((account) => account.id)
    )
    assert.isTrue(resetTokens.every((token) => token.consumed_at !== null))

    const refreshTokens = await db.from('auth_refresh_tokens').whereIn(
      'user_id',
      accounts.map((account) => account.id)
    )
    assert.isTrue(refreshTokens.every((token) => token.revoked_at !== null))

    const accessTokens = await db.from('auth_access_tokens').whereIn(
      'tokenable_id',
      accounts.map((account) => account.id)
    )
    assert.lengthOf(accessTokens, 0)
  })

  test('rolls back every password change when none of the selected users is Root', async ({
    assert,
    cleanup,
  }) => {
    assert.equal(db.connectionGlobalTransactions.size, 0)
    const outputDirectory = await createPrivateOutputDirectory()
    const outputPath = join(outputDirectory, 'bootstrap-credentials.json')
    const accounts = await createSelectedAccounts('no-root', false)
    cleanup(async () => {
      await deleteAccounts(accounts)
      await rm(outputDirectory, { recursive: true, force: true })
    })

    const service = await app.container.make(BootstrapCredentialRotationService)
    const failure = await service
      .run({
        userIds: accounts.map((account) => account.id),
        outputPath,
        applicationRoot: app.makePath(),
      })
      .catch((error) => error)

    assert.instanceOf(failure, BootstrapCredentialRotationError)
    assert.equal((failure as BootstrapCredentialRotationError).code, 'missing_root')
    await assert.rejects(() => stat(outputPath), /ENOENT/)

    const storedCredentials = await db
      .from('users')
      .whereIn(
        'id',
        accounts.map((account) => account.id)
      )
      .orderBy('id', 'asc')
      .select('id', 'password', 'credential_version')
    assert.deepEqual(
      storedCredentials.map((row) => ({
        passwordHash: String(row.password),
        credentialVersion: Number(row.credential_version),
      })),
      [...accounts]
        .sort((left, right) => left.id - right.id)
        .map((account) => ({
          passwordHash: account.passwordHash,
          credentialVersion: account.credentialVersion,
        }))
    )
  })

  test('rolls back before revocation when a generated plaintext does not match its hash', async ({
    assert,
    cleanup,
  }) => {
    assert.equal(db.connectionGlobalTransactions.size, 0)
    const outputDirectory = await createPrivateOutputDirectory()
    const outputPath = join(outputDirectory, 'bootstrap-credentials.json')
    const accounts = await createSelectedAccounts('hash-mismatch', true)
    cleanup(async () => {
      await deleteAccounts(accounts)
      await rm(outputDirectory, { recursive: true, force: true })
    })
    await seedRevocableCredentials(accounts)

    const selectedUserIds = accounts.map((account) => account.id)
    const failure = await new RejectingGeneratedCredentialService()
      .run({
        userIds: selectedUserIds,
        outputPath,
        applicationRoot: app.makePath(),
      })
      .catch((error) => error)

    assert.instanceOf(failure, BootstrapCredentialRotationError)
    assert.equal((failure as BootstrapCredentialRotationError).code, 'credential_generation_failed')
    await assert.rejects(() => stat(outputPath), /ENOENT/)

    const reloadedUsers = await User.query().whereIn('id', selectedUserIds).orderBy('id', 'asc')
    assert.deepEqual(
      reloadedUsers.map((user) => ({
        passwordHash: user.password,
        credentialVersion: user.credential_version,
      })),
      [...accounts]
        .sort((left, right) => left.id - right.id)
        .map((account) => ({
          passwordHash: account.passwordHash,
          credentialVersion: account.credentialVersion,
        }))
    )

    const resetTokens = await db.from('password_reset_tokens').whereIn('user_id', selectedUserIds)
    const refreshTokens = await db.from('auth_refresh_tokens').whereIn('user_id', selectedUserIds)
    const accessTokens = await db
      .from('auth_access_tokens')
      .whereIn('tokenable_id', selectedUserIds)
    assert.isTrue(resetTokens.every((token) => token.consumed_at === null))
    assert.isTrue(refreshTokens.every((token) => token.revoked_at === null))
    assert.lengthOf(accessTokens, accounts.length)
  })

  test('fails closed when any explicitly selected account is inactive', async ({
    assert,
    cleanup,
  }) => {
    assert.equal(db.connectionGlobalTransactions.size, 0)
    const outputDirectory = await createPrivateOutputDirectory()
    const outputPath = join(outputDirectory, 'bootstrap-credentials.json')
    const accounts = await createSelectedAccounts('inactive', true)
    cleanup(async () => {
      await deleteAccounts(accounts)
      await rm(outputDirectory, { recursive: true, force: true })
    })
    await db.from('users').where('id', accounts[1].id).update({ is_deleted: true })

    const service = await app.container.make(BootstrapCredentialRotationService)
    const failure = await service
      .run({
        userIds: accounts.map((account) => account.id),
        outputPath,
        applicationRoot: app.makePath(),
      })
      .catch((error) => error)

    assert.instanceOf(failure, BootstrapCredentialRotationError)
    assert.equal((failure as BootstrapCredentialRotationError).code, 'invalid_selected_users')
    await assert.rejects(() => stat(outputPath), /ENOENT/)

    const storedCredentials = await db
      .from('users')
      .whereIn(
        'id',
        accounts.map((account) => account.id)
      )
      .orderBy('id', 'asc')
      .select('password', 'credential_version')
    assert.deepEqual(
      storedCredentials.map((row) => ({
        passwordHash: String(row.password),
        credentialVersion: Number(row.credential_version),
      })),
      [...accounts]
        .sort((left, right) => left.id - right.id)
        .map((account) => ({
          passwordHash: account.passwordHash,
          credentialVersion: account.credentialVersion,
        }))
    )
  })

  test('keeps an existing output untouched without starting a rotation', async ({
    assert,
    cleanup,
  }) => {
    assert.equal(db.connectionGlobalTransactions.size, 0)
    const outputDirectory = await createPrivateOutputDirectory()
    const outputPath = join(outputDirectory, 'bootstrap-credentials.json')
    const accounts = await createSelectedAccounts('exclusive-output', true)
    cleanup(async () => {
      await deleteAccounts(accounts)
      await rm(outputDirectory, { recursive: true, force: true })
    })
    const existingDocument = '{"owner":"operator"}\n'
    await writeFile(outputPath, existingDocument, { mode: 0o600 })

    const service = await app.container.make(BootstrapCredentialRotationService)
    const failure = await service
      .run({
        userIds: accounts.map((account) => account.id),
        outputPath,
        applicationRoot: app.makePath(),
      })
      .catch((error) => error)

    assert.instanceOf(failure, BootstrapCredentialRotationError)
    assert.equal((failure as BootstrapCredentialRotationError).code, 'output_exists')
    assert.equal(await readFile(outputPath, 'utf8'), existingDocument)

    const storedCredentials = await db
      .from('users')
      .whereIn(
        'id',
        accounts.map((account) => account.id)
      )
      .orderBy('id', 'asc')
      .select('password', 'credential_version')
    assert.deepEqual(
      storedCredentials.map((row) => ({
        passwordHash: String(row.password),
        credentialVersion: Number(row.credential_version),
      })),
      [...accounts]
        .sort((left, right) => left.id - right.id)
        .map((account) => ({
          passwordHash: account.passwordHash,
          credentialVersion: account.credentialVersion,
        }))
    )
  })

  test('rolls back passwords, metadata, credential versions, and tokens after an injected post-mutation failure', async ({
    assert,
    cleanup,
  }) => {
    assert.equal(db.connectionGlobalTransactions.size, 0)
    const outputDirectory = await createPrivateOutputDirectory()
    const outputPath = join(outputDirectory, 'bootstrap-credentials.json')
    const accounts = await createSelectedAccounts('post-mutation-failure', true)
    cleanup(async () => {
      await deleteAccounts(accounts)
      await rm(outputDirectory, { recursive: true, force: true })
    })
    await seedRevocableCredentials(accounts)

    const selectedUserIds = accounts.map((account) => account.id)
    const service = new FailingAfterCredentialMutationsService(selectedUserIds)
    const failure = await service
      .run({
        userIds: selectedUserIds,
        outputPath,
        applicationRoot: app.makePath(),
      })
      .catch((error) => error)

    assert.instanceOf(failure, BootstrapCredentialRotationError)
    assert.equal((failure as BootstrapCredentialRotationError).code, 'rotation_failed')
    assert.isFalse((failure as BootstrapCredentialRotationError).outputRetained)
    await assert.rejects(() => stat(outputPath), /ENOENT/)

    assert.exists(service.observation)
    const observation = service.observation!
    assert.lengthOf(observation.users, accounts.length)
    for (const original of accounts) {
      const mutated = observation.users.find((user) => user.id === original.id)!
      assert.notEqual(mutated.passwordHash, original.passwordHash)
      assert.equal(mutated.credentialVersion, original.credentialVersion + 1)
      assert.isNull(mutated.metadata.email_verification_token_hash)
      assert.isNull(mutated.metadata.email_verification_sent_at)
    }
    assert.isTrue(observation.resetTokens.every((token) => token.consumedAt !== null))
    assert.isTrue(observation.refreshTokens.every((token) => token.revokedAt !== null))
    assert.equal(observation.accessTokenCount, 0)

    const reloadedUsers = await User.query().whereIn('id', selectedUserIds).orderBy('id', 'asc')
    for (const original of accounts) {
      const reloaded = reloadedUsers.find((user) => user.id === original.id)!
      await reloaded.load('roles')

      assert.equal(reloaded.full_name, original.fullName)
      assert.equal(reloaded.email, original.email)
      assert.equal(reloaded.username, original.username)
      assert.equal(reloaded.password, original.passwordHash)
      assert.equal(reloaded.credential_version, original.credentialVersion)
      assert.deepEqual(reloaded.metadata, original.metadata)
      assert.deepEqual(
        reloaded.roles.map((role) => role.slug),
        original.roleSlugs
      )
    }

    const resetTokens = await db.from('password_reset_tokens').whereIn('user_id', selectedUserIds)
    assert.lengthOf(resetTokens, accounts.length)
    assert.isTrue(resetTokens.every((token) => token.consumed_at === null))

    const refreshTokens = await db.from('auth_refresh_tokens').whereIn('user_id', selectedUserIds)
    assert.lengthOf(refreshTokens, accounts.length)
    assert.isTrue(refreshTokens.every((token) => token.revoked_at === null))

    const accessTokens = await db
      .from('auth_access_tokens')
      .whereIn('tokenable_id', selectedUserIds)
    assert.lengthOf(accessTokens, accounts.length)
  })

  test('allows only one bootstrap rotation to own the global operation lease', async ({
    assert,
    cleanup,
  }) => {
    assert.equal(db.connectionGlobalTransactions.size, 0)
    const firstOutputDirectory = await createPrivateOutputDirectory()
    const secondOutputDirectory = await createPrivateOutputDirectory()
    const firstOutputPath = join(firstOutputDirectory, 'bootstrap-first.json')
    const secondOutputPath = join(secondOutputDirectory, 'bootstrap-second.json')
    const accounts = await createSelectedAccounts('concurrent-lease', true)
    const selectedUserIds = accounts.map((account) => account.id)
    const firstService = new PausingBootstrapCredentialRotationService()
    cleanup(async () => {
      firstService.releaseMutations.resolve()
      await deleteAccounts(accounts)
      await rm(firstOutputDirectory, { recursive: true, force: true })
      await rm(secondOutputDirectory, { recursive: true, force: true })
    })

    const firstRotation = firstService.run({
      userIds: selectedUserIds,
      outputPath: firstOutputPath,
      applicationRoot: app.makePath(),
    })
    await firstService.mutationsReached.promise

    const secondService = new BootstrapCredentialRotationService(
      new UsersRepository(),
      makeCredentialInvalidationService()
    )
    const secondFailure = await secondService
      .run({
        userIds: selectedUserIds,
        outputPath: secondOutputPath,
        applicationRoot: app.makePath(),
      })
      .catch((error) => error)
    assert.instanceOf(secondFailure, BootstrapCredentialRotationError)
    assert.equal((secondFailure as BootstrapCredentialRotationError).code, 'rotation_in_progress')
    await assert.rejects(() => stat(secondOutputPath), /ENOENT/)

    firstService.releaseMutations.resolve()
    assert.deepEqual(await firstRotation, {
      rotatedUsers: 3,
      commitConfirmedAfterError: false,
    })

    const document = JSON.parse(
      await readFile(firstOutputPath, 'utf8')
    ) as BootstrapCredentialDocument
    const reloadedUsers = await User.query().whereIn('id', selectedUserIds)
    for (const outputAccount of document.accounts) {
      const reloaded = reloadedUsers.find((user) => user.id === outputAccount.user_id)!
      assert.isTrue(await hash.use('argon').verify(reloaded.password, outputAccount.password))
    }
  })

  test('fences concurrent mutation and rolls back when the coordinator connection is lost', async ({
    assert,
    cleanup,
  }) => {
    assert.equal(db.connectionGlobalTransactions.size, 0)
    const firstOutputDirectory = await createPrivateOutputDirectory()
    const secondOutputDirectory = await createPrivateOutputDirectory()
    const firstOutputPath = join(firstOutputDirectory, 'bootstrap-first.json')
    const secondOutputPath = join(secondOutputDirectory, 'bootstrap-second.json')
    const accounts = await createSelectedAccounts('lost-coordinator', true)
    const selectedUserIds = accounts.map((account) => account.id)
    const firstService = new LosingCoordinatorBootstrapCredentialRotationService()
    cleanup(async () => {
      firstService.releaseMutation.resolve()
      await deleteAccounts(accounts)
      await rm(firstOutputDirectory, { recursive: true, force: true })
      await rm(secondOutputDirectory, { recursive: true, force: true })
    })

    const firstRotation = firstService
      .run({
        userIds: selectedUserIds,
        outputPath: firstOutputPath,
        applicationRoot: app.makePath(),
      })
      .catch((error) => error)
    await firstService.coordinationLost.promise

    const secondFailure = await new BootstrapCredentialRotationService(
      new UsersRepository(),
      makeCredentialInvalidationService()
    )
      .run({
        userIds: selectedUserIds,
        outputPath: secondOutputPath,
        applicationRoot: app.makePath(),
      })
      .catch((error) => error)
    assert.instanceOf(secondFailure, BootstrapCredentialRotationError)
    assert.equal((secondFailure as BootstrapCredentialRotationError).code, 'rotation_in_progress')
    await assert.rejects(() => stat(secondOutputPath), /ENOENT/)

    firstService.releaseMutation.resolve()
    const firstFailure = await firstRotation
    assert.instanceOf(firstFailure, BootstrapCredentialRotationError)
    assert.equal((firstFailure as BootstrapCredentialRotationError).code, 'rotation_failed')
    assert.isFalse((firstFailure as BootstrapCredentialRotationError).outputRetained)
    await assert.rejects(() => stat(firstOutputPath), /ENOENT/)

    const reloadedUsers = await User.query().whereIn('id', selectedUserIds).orderBy('id', 'asc')
    assert.deepEqual(
      reloadedUsers.map((user) => ({
        passwordHash: user.password,
        credentialVersion: user.credential_version,
      })),
      [...accounts]
        .sort((left, right) => left.id - right.id)
        .map((account) => ({
          passwordHash: account.passwordHash,
          credentialVersion: account.credentialVersion,
        }))
    )
  })

  test('resolves committed, rolled-back, and mixed password states through locked verification', async ({
    assert,
    cleanup,
  }) => {
    assert.equal(db.connectionGlobalTransactions.size, 0)
    const accounts = await createSelectedAccounts('commit-outcomes', true)
    cleanup(() => deleteAccounts(accounts))
    const service = new InspectableCommitOutcomeService()

    const committedStates = accounts.map((account) => ({
      userId: account.id,
      originalHash: `unobserved-original-${account.id}`,
      generatedHash: account.passwordHash,
    }))
    assert.equal(await service.inspectCommitOutcome(committedStates), 'committed')

    const rolledBackStates = accounts.map((account) => ({
      userId: account.id,
      originalHash: account.passwordHash,
      generatedHash: `unobserved-generated-${account.id}`,
    }))
    assert.equal(await service.inspectCommitOutcome(rolledBackStates), 'rolled_back')

    const mixedStates = accounts.map((account, index) => ({
      userId: account.id,
      originalHash: index === 1 ? account.passwordHash : `unobserved-original-${account.id}`,
      generatedHash: index === 1 ? `unobserved-generated-${account.id}` : account.passwordHash,
    }))
    assert.equal(await service.inspectCommitOutcome(mixedStates), 'ambiguous')
  })
})
