import { chmod, mkdtemp, readFile, rename, rm, stat, symlink, writeFile } from 'node:fs/promises'
import { tmpdir } from 'node:os'
import { join } from 'node:path'
import { pathToFileURL } from 'node:url'

import { test } from '@japa/runner'

import SecurityRotateBootstrap from '../../../commands/security_rotate_bootstrap.js'
import {
  assertBootstrapCredentialFileIntegrity,
  BOOTSTRAP_CREDENTIAL_HOST_DIRECTORY,
  BOOTSTRAP_CREDENTIAL_HOST_MARKER,
  BOOTSTRAP_CREDENTIAL_HOST_MARKER_CONTENT,
  BootstrapCredentialRotationError,
  classifyBootstrapCommitOutcome,
  parseBootstrapUserIds,
  resolveSecureBootstrapOutputTarget,
  sortBootstrapCredentialAccounts,
  writeBootstrapCredentialFile,
  type BootstrapCredentialDocument,
} from '#modules/auth/utils/bootstrap_credential_rotation'
import IRole from '#modules/roles/interfaces/role_interface'

function captureFailure(callback: () => unknown): unknown {
  try {
    callback()
    return null
  } catch (error) {
    return error
  }
}

test.group('Bootstrap credential rotation contract', () => {
  test('registers the production command with mandatory non-secret flags', ({ assert }) => {
    SecurityRotateBootstrap.boot()
    const metadata = SecurityRotateBootstrap.serialize()

    assert.equal(metadata.commandName, 'security:rotate-bootstrap')
    assert.isTrue(metadata.options.startApp)
    assert.deepInclude(
      metadata.flags.map((flag) => ({
        name: flag.name,
        flagName: flag.flagName,
        required: flag.required,
      })),
      { name: 'userIds', flagName: 'user-ids', required: true }
    )
    assert.deepInclude(
      metadata.flags.map((flag) => ({
        name: flag.name,
        flagName: flag.flagName,
        required: flag.required,
      })),
      { name: 'output', flagName: 'output', required: true }
    )
  })

  test('pins production output to the host-mounted recovery directory', async ({ assert }) => {
    let receivedOptions: Record<string, unknown> | undefined
    const command = Object.create(SecurityRotateBootstrap.prototype) as SecurityRotateBootstrap
    Object.assign(command, {
      userIds: '1,2,3',
      output: `${BOOTSTRAP_CREDENTIAL_HOST_DIRECTORY}/bootstrap-test.json`,
      app: {
        appRoot: pathToFileURL(`${process.cwd()}/`),
        inProduction: true,
        container: {
          async make() {
            return {
              async run(options: Record<string, unknown>) {
                receivedOptions = options
                return { rotatedUsers: 3, commitConfirmedAfterError: false }
              },
            }
          },
        },
      },
    })
    Object.defineProperty(command, 'logger', {
      configurable: true,
      value: { success() {} },
    })

    await command.run()
    assert.equal(receivedOptions?.requiredHostMountDirectory, BOOTSTRAP_CREDENTIAL_HOST_DIRECTORY)
  })

  test('replaces unexpected failures with a fixed non-sensitive command error', async ({
    assert,
  }) => {
    const leakedValue = 'generated-password-or-hash-must-not-leak'
    const command = Object.create(SecurityRotateBootstrap.prototype) as SecurityRotateBootstrap
    Object.assign(command, {
      userIds: '1,2,3',
      output: '/unused-in-the-stub.json',
      app: {
        appRoot: pathToFileURL(`${process.cwd()}/`),
        container: {
          async make() {
            return {
              async run() {
                throw new Error(leakedValue)
              },
            }
          },
        },
      },
    })

    const failure = await command.run().catch((error) => error)
    assert.instanceOf(failure, BootstrapCredentialRotationError)
    assert.equal((failure as BootstrapCredentialRotationError).code, 'rotation_failed')
    assert.notInclude((failure as Error).message, leakedValue)
  })

  test('does not misreport a post-commit logger failure as a rotation failure', async ({
    assert,
  }) => {
    const loggerFailure = new Error('controlled logger failure')
    const command = Object.create(SecurityRotateBootstrap.prototype) as SecurityRotateBootstrap
    Object.assign(command, {
      userIds: '1,2,3',
      output: '/unused-in-the-stub.json',
      app: {
        appRoot: pathToFileURL(`${process.cwd()}/`),
        container: {
          async make() {
            return {
              async run() {
                return { rotatedUsers: 3, commitConfirmedAfterError: false }
              },
            }
          },
        },
      },
    })
    Object.defineProperty(command, 'logger', {
      configurable: true,
      value: {
        success() {
          throw loggerFailure
        },
      },
    })

    const failure = await command.run().catch((error) => error)
    assert.strictEqual(failure, loggerFailure)
    assert.notInstanceOf(failure, BootstrapCredentialRotationError)
  })

  test('accepts only exactly three distinct canonical positive int4 IDs', ({ assert }) => {
    assert.deepEqual(parseBootstrapUserIds('3,1,2147483647'), [3, 1, 2_147_483_647])

    for (const value of [
      '',
      '1,2',
      '1,2,3,4',
      '1,1,2',
      '0,1,2',
      '01,2,3',
      '+1,2,3',
      '1, 2,3',
      '1,2,2147483648',
    ]) {
      const failure = captureFailure(() => parseBootstrapUserIds(value))
      assert.instanceOf(failure, BootstrapCredentialRotationError)
      assert.equal((failure as BootstrapCredentialRotationError).code, 'invalid_user_ids')
    }
  })

  test('orders Root accounts first and then uses the stable user ID', ({ assert }) => {
    const account = (userId: number, roles: string[]) => ({
      user_id: userId,
      full_name: `User ${userId}`,
      email: `user-${userId}@example.com`,
      username: `user-${userId}`,
      roles,
      password: `secret-${userId}`,
    })

    const ordered = sortBootstrapCredentialAccounts([
      account(30, [IRole.Slugs.USER]),
      account(20, [IRole.Slugs.ROOT]),
      account(10, [IRole.Slugs.ROOT]),
    ])

    assert.deepEqual(
      ordered.map(({ user_id: userId }) => userId),
      [10, 20, 30]
    )
  })

  test('treats only an exact all-new or all-original password state as conclusive', ({
    assert,
  }) => {
    const states = [1, 2, 3].map((userId) => ({
      userId,
      originalHash: `old-${userId}`,
      generatedHash: `new-${userId}`,
    }))

    assert.equal(
      classifyBootstrapCommitOutcome(
        states,
        states.map((state) => ({ id: state.userId, password: state.generatedHash }))
      ),
      'committed'
    )
    assert.equal(
      classifyBootstrapCommitOutcome(
        states,
        states.map((state) => ({ id: state.userId, password: state.originalHash }))
      ),
      'rolled_back'
    )
    assert.equal(
      classifyBootstrapCommitOutcome(states, [
        { id: 1, password: 'new-1' },
        { id: 2, password: 'old-2' },
        { id: 3, password: 'new-3' },
      ]),
      'ambiguous'
    )
    assert.equal(
      classifyBootstrapCommitOutcome(states, [
        { id: 1, password: 'new-1' },
        { id: 2, password: 'new-2' },
      ]),
      'ambiguous'
    )
  })

  test('creates a durable exclusive 0600 JSON file in a private 0700 directory', async ({
    assert,
    cleanup,
  }) => {
    const privateDirectory = await mkdtemp(join(tmpdir(), 'experimente-bootstrap-unit-'))
    await chmod(privateDirectory, 0o700)
    cleanup(() => rm(privateDirectory, { recursive: true, force: true }))

    const outputPath = join(privateDirectory, 'credentials.json')
    const target = await resolveSecureBootstrapOutputTarget(outputPath, process.cwd())
    const document: BootstrapCredentialDocument = {
      schema_version: 1,
      generated_at: '2026-09-04T00:00:00.000Z',
      accounts: [
        {
          user_id: 1,
          full_name: 'Root User',
          email: 'root@example.com',
          username: 'root',
          roles: [IRole.Slugs.ROOT],
          password: 'only-in-the-private-file',
        },
      ],
    }

    const createdFile = await writeBootstrapCredentialFile(target, document)
    await assertBootstrapCredentialFileIntegrity(createdFile)
    const outputStat = await stat(outputPath)
    assert.equal(outputStat.mode & 0o777, 0o600)
    assert.deepEqual(JSON.parse(await readFile(outputPath, 'utf8')), document)

    const duplicateFailure = await writeBootstrapCredentialFile(target, document).catch(
      (error) => error
    )
    assert.instanceOf(duplicateFailure, BootstrapCredentialRotationError)
    assert.equal((duplicateFailure as BootstrapCredentialRotationError).code, 'output_exists')

    const originalPath = join(privateDirectory, 'credentials.original.json')
    await rename(outputPath, originalPath)
    await writeFile(outputPath, await readFile(originalPath), { mode: 0o600 })

    const integrityFailure = await assertBootstrapCredentialFileIntegrity(createdFile).catch(
      (error) => error
    )
    assert.instanceOf(integrityFailure, BootstrapCredentialRotationError)
    assert.equal(
      (integrityFailure as BootstrapCredentialRotationError).code,
      'output_integrity_failed'
    )
    assert.isTrue((integrityFailure as BootstrapCredentialRotationError).outputRetained)
    await stat(outputPath)
    await stat(originalPath)
  })

  test('rejects relative paths and non-private parent directories', async ({ assert }) => {
    const relativeFailure = await resolveSecureBootstrapOutputTarget(
      'credentials.json',
      process.cwd()
    ).catch((error) => error)
    assert.instanceOf(relativeFailure, BootstrapCredentialRotationError)
    assert.equal((relativeFailure as BootstrapCredentialRotationError).code, 'invalid_output_path')

    const publicFailure = await resolveSecureBootstrapOutputTarget(
      join(tmpdir(), 'credentials.json'),
      process.cwd()
    ).catch((error) => error)
    assert.instanceOf(publicFailure, BootstrapCredentialRotationError)
    assert.equal((publicFailure as BootstrapCredentialRotationError).code, 'invalid_output_path')
  })

  test('requires and revalidates the private host-mount marker in production mode', async ({
    assert,
    cleanup,
  }) => {
    const privateDirectory = await mkdtemp(join(tmpdir(), 'experimente-bootstrap-mount-'))
    await chmod(privateDirectory, 0o700)
    cleanup(() => rm(privateDirectory, { recursive: true, force: true }))
    const outputPath = join(privateDirectory, 'credentials.json')
    const markerPath = join(privateDirectory, BOOTSTRAP_CREDENTIAL_HOST_MARKER)

    const missingMarker = await resolveSecureBootstrapOutputTarget(
      outputPath,
      process.cwd(),
      privateDirectory
    ).catch((error) => error)
    assert.instanceOf(missingMarker, BootstrapCredentialRotationError)
    assert.equal((missingMarker as BootstrapCredentialRotationError).code, 'invalid_output_mount')

    await writeFile(markerPath, BOOTSTRAP_CREDENTIAL_HOST_MARKER_CONTENT, { mode: 0o600 })
    const permissiveMarker = await resolveSecureBootstrapOutputTarget(
      outputPath,
      process.cwd(),
      privateDirectory
    ).catch((error) => error)
    assert.instanceOf(permissiveMarker, BootstrapCredentialRotationError)
    assert.equal(
      (permissiveMarker as BootstrapCredentialRotationError).code,
      'invalid_output_mount'
    )

    await writeFile(markerPath, 'wrong-marker\n')
    await chmod(markerPath, 0o400)
    const wrongContents = await resolveSecureBootstrapOutputTarget(
      outputPath,
      process.cwd(),
      privateDirectory
    ).catch((error) => error)
    assert.instanceOf(wrongContents, BootstrapCredentialRotationError)
    assert.equal((wrongContents as BootstrapCredentialRotationError).code, 'invalid_output_mount')

    await chmod(markerPath, 0o600)
    await writeFile(markerPath, Buffer.alloc(1024 * 1024, 0x61))
    await chmod(markerPath, 0o400)
    const oversizedMarker = await resolveSecureBootstrapOutputTarget(
      outputPath,
      process.cwd(),
      privateDirectory
    ).catch((error) => error)
    assert.instanceOf(oversizedMarker, BootstrapCredentialRotationError)
    assert.equal((oversizedMarker as BootstrapCredentialRotationError).code, 'invalid_output_mount')

    await rm(markerPath)
    const markerTarget = join(privateDirectory, '.marker-target')
    await writeFile(markerTarget, BOOTSTRAP_CREDENTIAL_HOST_MARKER_CONTENT, { mode: 0o400 })
    await symlink(markerTarget, markerPath)
    const symbolicMarker = await resolveSecureBootstrapOutputTarget(
      outputPath,
      process.cwd(),
      privateDirectory
    ).catch((error) => error)
    assert.instanceOf(symbolicMarker, BootstrapCredentialRotationError)
    assert.equal((symbolicMarker as BootstrapCredentialRotationError).code, 'invalid_output_mount')

    await rm(markerPath)
    await rm(markerTarget)
    await writeFile(markerPath, BOOTSTRAP_CREDENTIAL_HOST_MARKER_CONTENT, { mode: 0o400 })
    const target = await resolveSecureBootstrapOutputTarget(
      outputPath,
      process.cwd(),
      privateDirectory
    )
    const document: BootstrapCredentialDocument = {
      schema_version: 1,
      generated_at: '2026-09-04T00:00:00.000Z',
      accounts: [],
    }
    const createdFile = await writeBootstrapCredentialFile(target, document)
    await chmod(markerPath, 0o600)

    const changedMarker = await assertBootstrapCredentialFileIntegrity(createdFile).catch(
      (error) => error
    )
    assert.instanceOf(changedMarker, BootstrapCredentialRotationError)
    assert.equal(
      (changedMarker as BootstrapCredentialRotationError).code,
      'output_integrity_failed'
    )
    assert.isTrue((changedMarker as BootstrapCredentialRotationError).outputRetained)
  })
})
