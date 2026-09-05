import { randomBytes } from 'node:crypto'

import { inject } from '@adonisjs/core'
import hash from '@adonisjs/core/services/hash'
import db from '@adonisjs/lucid/services/db'
import type { TransactionClientContract } from '@adonisjs/lucid/types/database'
import { DateTime } from 'luxon'

import CredentialInvalidationService from '#modules/auth/services/credential_invalidation_service'
import {
  assertBootstrapUserIds,
  assertBootstrapCredentialFileIntegrity,
  BOOTSTRAP_ROTATION_MESSAGES,
  BootstrapCredentialRotationError,
  classifyBootstrapCommitOutcome,
  resolveSecureBootstrapOutputTarget,
  sortBootstrapCredentialAccounts,
  writeBootstrapCredentialFile,
  type BootstrapCredentialAccount,
  type BootstrapCredentialDocument,
  type BootstrapCommitResolution,
  type BootstrapPasswordCommitState,
  type CreatedBootstrapCredentialFile,
  type SecureBootstrapOutputTarget,
} from '#modules/auth/utils/bootstrap_credential_rotation'
import IRole from '#modules/roles/interfaces/role_interface'
import type User from '#modules/users/models/user'
import UsersRepository from '#modules/users/repositories/users_repository'

const GENERATED_PASSWORD_BYTES = 32
const ARGON2ID_PREFIX = '$argon2id$'
// The ASCII-ish namespaces "EXP+" and "EXP," form a two-layer lease. The
// coordinator serializes the full operation, while the mutation transaction
// fences database writes if that independent coordinator connection is lost.
const BOOTSTRAP_ROTATION_COORDINATOR_LOCK_NAMESPACE = 0x4558502b
const BOOTSTRAP_ROTATION_MUTATION_LOCK_NAMESPACE = 0x4558502c
const BOOTSTRAP_ROTATION_LOCK_NAME = 'security:rotate-bootstrap'

type GeneratedCredential = {
  userId: number
  password: string
}

export type BootstrapCredentialRotationResult = {
  rotatedUsers: number
  commitConfirmedAfterError: boolean
}

export type BootstrapCredentialRotationOptions = {
  userIds: number[]
  outputPath: string
  applicationRoot: string
  requiredHostMountDirectory?: string
}

/**
 * Operationally rotates exactly three explicitly selected bootstrap accounts.
 * The durable credentials file is prepared before the database commit so a
 * successful rotation can never make the generated passwords unrecoverable.
 */
@inject()
export default class BootstrapCredentialRotationService {
  constructor(
    private usersRepository: UsersRepository,
    private credentialInvalidationService: CredentialInvalidationService
  ) {}

  async run(
    options: BootstrapCredentialRotationOptions
  ): Promise<BootstrapCredentialRotationResult> {
    assertBootstrapUserIds(options.userIds)

    const outputTarget = await resolveSecureBootstrapOutputTarget(
      options.outputPath,
      options.applicationRoot,
      options.requiredHostMountDirectory
    )
    let coordinationTransaction: TransactionClientContract | undefined

    try {
      coordinationTransaction = await db.transaction()
      if (
        !(await this.tryAcquireOperationLock(
          coordinationTransaction,
          BOOTSTRAP_ROTATION_COORDINATOR_LOCK_NAMESPACE
        ))
      ) {
        throw new BootstrapCredentialRotationError(
          'rotation_in_progress',
          BOOTSTRAP_ROTATION_MESSAGES.rotationInProgress
        )
      }
      await this.afterCoordinationLeaseAcquired(coordinationTransaction)

      return await this.runExclusive(options.userIds, outputTarget, async () => {
        if (
          coordinationTransaction?.isCompleted ||
          !(await this.tryAcquireOperationLock(
            coordinationTransaction!,
            BOOTSTRAP_ROTATION_COORDINATOR_LOCK_NAMESPACE
          ))
        ) {
          throw new Error('Bootstrap rotation coordination lease was lost')
        }
      })
    } catch (error) {
      if (error instanceof BootstrapCredentialRotationError) {
        throw error
      }

      throw new BootstrapCredentialRotationError(
        'rotation_failed',
        BOOTSTRAP_ROTATION_MESSAGES.rotationFailed
      )
    } finally {
      // The coordinator exists only to retain the transaction-scoped advisory
      // lock across commit verification. Releasing it must never turn an
      // already-confirmed credential rotation into a reported failure.
      if (coordinationTransaction && !coordinationTransaction.isCompleted) {
        await coordinationTransaction.rollback().catch(() => {})
      }
    }
  }

  private async runExclusive(
    userIds: number[],
    outputTarget: SecureBootstrapOutputTarget,
    assertCoordinationLease: () => Promise<void>
  ): Promise<BootstrapCredentialRotationResult> {
    const orderedUserIds = [...userIds].sort((left, right) => left - right)
    const generatedCredentials = await this.generateCredentials(orderedUserIds)
    const credentialsByUserId = new Map(
      generatedCredentials.map((credential) => [credential.userId, credential])
    )

    let transaction: TransactionClientContract | undefined
    let createdFile: CreatedBootstrapCredentialFile | undefined
    let commitAttempted = false

    try {
      transaction = await db.transaction()
      if (
        !(await this.tryAcquireOperationLock(
          transaction,
          BOOTSTRAP_ROTATION_MUTATION_LOCK_NAMESPACE
        ))
      ) {
        throw new BootstrapCredentialRotationError(
          'rotation_in_progress',
          BOOTSTRAP_ROTATION_MESSAGES.rotationInProgress
        )
      }
      const users = await this.usersRepository.lockActiveByIds(orderedUserIds, transaction)
      if (users.length !== orderedUserIds.length) {
        throw new BootstrapCredentialRotationError(
          'invalid_selected_users',
          BOOTSTRAP_ROTATION_MESSAGES.invalidSelectedUsers
        )
      }

      const roleSlugsByUserId = await this.loadRoleSlugs(orderedUserIds, transaction)
      if (
        !orderedUserIds.some((userId) => roleSlugsByUserId.get(userId)?.includes(IRole.Slugs.ROOT))
      ) {
        throw new BootstrapCredentialRotationError(
          'missing_root',
          BOOTSTRAP_ROTATION_MESSAGES.missingRoot
        )
      }

      const document = this.createCredentialDocument(users, roleSlugsByUserId, credentialsByUserId)
      const invalidatedAt = DateTime.now()
      const storedPasswordStates: BootstrapPasswordCommitState[] = []
      const generatedPasswordHashes = new Set<string>()

      for (const user of users) {
        const credential = credentialsByUserId.get(user.id)!
        const originalHash = user.password
        user.useTransaction(transaction)
        // The AuthFinder model hook owns password hashing. Supplying a pre-hashed
        // value here would hash the PHC string again and make the generated
        // plaintext unusable.
        user.password = credential.password
        user.metadata = {
          ...user.metadata,
          email_verified: user.metadata?.email_verified ?? false,
          email_verification_token_hash: null,
          email_verification_sent_at: null,
          email_verified_at: user.metadata?.email_verified_at ?? null,
        }
        await user.save()
        const generatedCredentialMatches = await this.verifyGeneratedCredential(
          user.password,
          credential.password
        ).catch(() => false)
        if (
          !user.password.startsWith(ARGON2ID_PREFIX) ||
          user.password === originalHash ||
          generatedPasswordHashes.has(user.password) ||
          !generatedCredentialMatches
        ) {
          throw new BootstrapCredentialRotationError(
            'credential_generation_failed',
            BOOTSTRAP_ROTATION_MESSAGES.credentialGenerationFailed
          )
        }
        generatedPasswordHashes.add(user.password)
        storedPasswordStates.push({
          userId: user.id,
          originalHash,
          generatedHash: user.password,
        })
        await this.credentialInvalidationService.run(user.id, transaction, invalidatedAt)
      }

      await this.afterCredentialsMutated(transaction)
      await assertCoordinationLease()

      createdFile = await writeBootstrapCredentialFile(outputTarget, document)
      await assertBootstrapCredentialFileIntegrity(createdFile)
      await assertCoordinationLease()
      commitAttempted = true

      try {
        await transaction.commit()
        return { rotatedUsers: orderedUserIds.length, commitConfirmedAfterError: false }
      } catch {
        if (!transaction.isCompleted) {
          await transaction.rollback().catch(() => {})
        }
        const resolution = await this.resolveCommitOutcome(storedPasswordStates)
        if (resolution === 'committed') {
          return { rotatedUsers: orderedUserIds.length, commitConfirmedAfterError: true }
        }

        if (resolution === 'rolled_back') {
          throw new BootstrapCredentialRotationError(
            'rotation_failed',
            BOOTSTRAP_ROTATION_MESSAGES.rotationFailedRetained,
            true
          )
        }

        throw new BootstrapCredentialRotationError(
          'commit_ambiguous',
          BOOTSTRAP_ROTATION_MESSAGES.commitAmbiguous,
          true
        )
      }
    } catch (error) {
      if (commitAttempted) {
        if (error instanceof BootstrapCredentialRotationError) {
          throw error
        }

        throw new BootstrapCredentialRotationError(
          'commit_ambiguous',
          BOOTSTRAP_ROTATION_MESSAGES.commitAmbiguous,
          true
        )
      }

      if (transaction && !transaction.isCompleted) {
        await transaction.rollback().catch(() => {})
      }

      if (error instanceof BootstrapCredentialRotationError) {
        throw error
      }

      if (createdFile) {
        throw new BootstrapCredentialRotationError(
          'rotation_failed',
          BOOTSTRAP_ROTATION_MESSAGES.rotationFailedRetained,
          true
        )
      }

      throw new BootstrapCredentialRotationError(
        'rotation_failed',
        BOOTSTRAP_ROTATION_MESSAGES.rotationFailed
      )
    }
  }

  /** Test seam for proving that every mutation remains inside the transaction. */
  protected async afterCredentialsMutated(_client: TransactionClientContract): Promise<void> {}

  /** Test seam for simulating loss of the independent coordinator connection. */
  protected async afterCoordinationLeaseAcquired(
    _client: TransactionClientContract
  ): Promise<void> {}

  /**
   * Prove that the exact plaintext written to the recovery document matches
   * the stored hash before any credential is invalidated or the transaction is
   * committed. Keeping this as a seam lets the rollback contract be exercised
   * without weakening the production verifier.
   */
  protected async verifyGeneratedCredential(
    passwordHash: string,
    generatedPassword: string
  ): Promise<boolean> {
    return hash.use('argon').verify(passwordHash, generatedPassword)
  }

  private async tryAcquireOperationLock(
    client: TransactionClientContract,
    namespace: number
  ): Promise<boolean> {
    const lock = await client.rawQuery<{ rows: Array<{ acquired: boolean }> }>(
      'SELECT pg_try_advisory_xact_lock(CAST(? AS integer), hashtext(?)) AS acquired',
      [namespace, BOOTSTRAP_ROTATION_LOCK_NAME]
    )
    return lock.rows.length === 1 && lock.rows[0].acquired === true
  }

  private async generateCredentials(userIds: number[]): Promise<GeneratedCredential[]> {
    try {
      const passwords = new Set<string>()
      while (passwords.size < userIds.length) {
        passwords.add(randomBytes(GENERATED_PASSWORD_BYTES).toString('base64url'))
      }
      const passwordList = [...passwords]
      return userIds.map((userId, index) => ({
        userId,
        password: passwordList[index],
      }))
    } catch {
      throw new BootstrapCredentialRotationError(
        'credential_generation_failed',
        BOOTSTRAP_ROTATION_MESSAGES.credentialGenerationFailed
      )
    }
  }

  private async loadRoleSlugs(
    userIds: number[],
    client: TransactionClientContract
  ): Promise<Map<number, string[]>> {
    const rows = await client
      .from('user_roles')
      .innerJoin('roles', 'roles.id', 'user_roles.role_id')
      .whereIn('user_roles.user_id', userIds)
      .orderBy('user_roles.user_id', 'asc')
      .orderBy('roles.slug', 'asc')
      .select('user_roles.user_id', 'roles.slug')

    const rolesByUserId = new Map(userIds.map((userId) => [userId, [] as string[]]))
    for (const row of rows) {
      rolesByUserId.get(Number(row.user_id))?.push(String(row.slug))
    }
    return rolesByUserId
  }

  private createCredentialDocument(
    users: User[],
    roleSlugsByUserId: Map<number, string[]>,
    credentialsByUserId: Map<number, GeneratedCredential>
  ): BootstrapCredentialDocument {
    const accounts: BootstrapCredentialAccount[] = users.map((user) => ({
      user_id: user.id,
      full_name: user.full_name,
      email: user.email,
      username: user.username,
      roles: [...(roleSlugsByUserId.get(user.id) ?? [])],
      password: credentialsByUserId.get(user.id)!.password,
    }))

    return {
      schema_version: 1,
      generated_at: DateTime.utc().toISO(),
      accounts: sortBootstrapCredentialAccounts(accounts),
    }
  }

  protected async resolveCommitOutcome(
    states: BootstrapPasswordCommitState[]
  ): Promise<BootstrapCommitResolution> {
    let verificationTransaction: TransactionClientContract | undefined
    try {
      verificationTransaction = await db.transaction()
      await verificationTransaction.rawQuery("SET LOCAL lock_timeout TO '2s'")
      await verificationTransaction.rawQuery("SET LOCAL statement_timeout TO '5s'")

      const rows = await verificationTransaction
        .from('users')
        .whereIn(
          'id',
          [...states].sort((left, right) => left.userId - right.userId).map((state) => state.userId)
        )
        .orderBy('id', 'asc')
        .forUpdate()
        .select('id', 'password')

      const outcome = classifyBootstrapCommitOutcome(states, rows)
      await verificationTransaction.commit()
      return outcome
    } catch {
      if (verificationTransaction && !verificationTransaction.isCompleted) {
        await verificationTransaction.rollback().catch(() => {})
      }
      return 'ambiguous'
    }
  }
}
