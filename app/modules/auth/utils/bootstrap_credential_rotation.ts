import { createHash, timingSafeEqual } from 'node:crypto'
import { constants } from 'node:fs'
import type { BigIntStats } from 'node:fs'
import { lstat, open, realpath } from 'node:fs/promises'
import { basename, dirname, isAbsolute, join, relative, resolve, sep } from 'node:path'

import IRole from '#modules/roles/interfaces/role_interface'

const EXPECTED_BOOTSTRAP_USER_COUNT = 3
const POSTGRES_INT4_MAX = 2_147_483_647
const CANONICAL_USER_IDS_PATTERN = /^[1-9]\d*(?:,[1-9]\d*){2}$/
const OUTPUT_DIRECTORY_MODE = 0o700
const OUTPUT_FILE_MODE = 0o600
const HOST_MOUNT_MARKER_MODE = 0o400

export const BOOTSTRAP_CREDENTIAL_HOST_DIRECTORY = '/var/lib/experimente-plus/bootstrap-credentials'
export const BOOTSTRAP_CREDENTIAL_HOST_MARKER = '.host-mounted-v1'
export const BOOTSTRAP_CREDENTIAL_HOST_MARKER_CONTENT =
  'experimente-plus-bootstrap-credentials-v1\n'

export type BootstrapCredentialRotationErrorCode =
  | 'invalid_user_ids'
  | 'invalid_output_path'
  | 'invalid_output_mount'
  | 'output_exists'
  | 'output_write_failed'
  | 'output_integrity_failed'
  | 'invalid_selected_users'
  | 'missing_root'
  | 'credential_generation_failed'
  | 'rotation_in_progress'
  | 'rotation_failed'
  | 'commit_ambiguous'

/**
 * Every error leaving the rotation boundary has a fixed, non-sensitive
 * message. In particular, lower-level database and filesystem errors are
 * never allowed to echo generated credentials or password hashes.
 */
export class BootstrapCredentialRotationError extends Error {
  constructor(
    readonly code: BootstrapCredentialRotationErrorCode,
    message: string,
    readonly outputRetained = false
  ) {
    super(message)
    this.name = 'BootstrapCredentialRotationError'
  }
}

export const BOOTSTRAP_ROTATION_MESSAGES = Object.freeze({
  invalidUserIds:
    'The user-ids flag must contain exactly three distinct canonical positive int4 IDs.',
  invalidOutputPath:
    'The output must be an absolute normalized path outside the application tree, with an existing private 0700 parent directory owned by the current user.',
  invalidOutputMount:
    'Production credentials must target the approved private host-mounted recovery directory.',
  outputExists: 'The requested credentials output file already exists and was not modified.',
  outputWriteFailed: 'The credentials output file could not be created and synchronized securely.',
  outputWriteFailedRetained:
    'The credentials output file could not be fully synchronized. A private file may have been retained; inspect the requested path before retrying.',
  outputIntegrityFailed:
    'The prepared credentials file changed before database commit. Rotation was not committed and the private file was retained for operator inspection.',
  invalidSelectedUsers: 'All three selected user IDs must identify active accounts.',
  missingRoot: 'At least one selected active account must have the Root platform role.',
  credentialGenerationFailed: 'Secure bootstrap credentials could not be generated.',
  rotationInProgress: 'Another bootstrap credential rotation is already in progress.',
  rotationFailed: 'Bootstrap credential rotation failed and was not committed.',
  rotationFailedRetained:
    'Bootstrap credential rotation was not committed. The prepared private credentials file was retained for operator inspection.',
  commitAmbiguous:
    'The database commit result could not be confirmed. The credentials file was retained; verify the selected accounts before retrying.',
})

export type BootstrapCredentialAccount = {
  user_id: number
  full_name: string
  email: string
  username: string | null
  roles: string[]
  password: string
}

export type BootstrapCredentialDocument = {
  schema_version: 1
  generated_at: string
  accounts: BootstrapCredentialAccount[]
}

export type SecureBootstrapOutputTarget = {
  filePath: string
  parentPath: string
  hostMountMarker?: BootstrapHostMountMarker
}

export type BootstrapHostMountMarker = {
  filePath: string
  device: bigint
  inode: bigint
  size: bigint
  contentSha256: Buffer
}

export type CreatedBootstrapCredentialFile = SecureBootstrapOutputTarget & {
  device: bigint
  inode: bigint
  size: bigint
  contentSha256: Buffer
}

export type BootstrapPasswordCommitState = {
  userId: number
  originalHash: string
  generatedHash: string
}

export type BootstrapStoredPasswordRow = {
  id: unknown
  password: unknown
}

export type BootstrapCommitResolution = 'committed' | 'rolled_back' | 'ambiguous'

function currentEffectiveUserId(): number | undefined {
  return typeof process.geteuid === 'function' ? process.geteuid() : undefined
}

function isWithin(parentPath: string, candidatePath: string): boolean {
  const relativePath = relative(parentPath, candidatePath)

  return (
    relativePath === '' ||
    (!relativePath.startsWith(`..${sep}`) && relativePath !== '..' && !isAbsolute(relativePath))
  )
}

function hasErrnoCode(error: unknown, code: string): boolean {
  return error instanceof Error && 'code' in error && error.code === code
}

function hasSecureHostMountMarkerMetadata(fileStat: BigIntStats, expectedSize: bigint): boolean {
  const effectiveUserId = currentEffectiveUserId()

  return (
    fileStat.isFile() &&
    fileStat.nlink === 1n &&
    fileStat.size === expectedSize &&
    (fileStat.mode & 0o7777n) === BigInt(HOST_MOUNT_MARKER_MODE) &&
    (effectiveUserId === undefined || fileStat.uid === BigInt(effectiveUserId))
  )
}

async function readBootstrapHostMountMarker(parentPath: string): Promise<BootstrapHostMountMarker> {
  const filePath = join(parentPath, BOOTSTRAP_CREDENTIAL_HOST_MARKER)
  const expectedContents = Buffer.from(BOOTSTRAP_CREDENTIAL_HOST_MARKER_CONTENT, 'utf8')
  const expectedSize = BigInt(expectedContents.byteLength)
  let handle: Awaited<ReturnType<typeof open>> | undefined

  try {
    const beforeOpen = await lstat(filePath, { bigint: true })
    if (!hasSecureHostMountMarkerMetadata(beforeOpen, expectedSize)) {
      throw new Error('Invalid host mount marker metadata')
    }

    handle = await open(filePath, constants.O_RDONLY | constants.O_NOFOLLOW)
    const descriptorStat = await handle.stat({ bigint: true })
    if (
      !hasSecureHostMountMarkerMetadata(descriptorStat, expectedSize) ||
      descriptorStat.dev !== beforeOpen.dev ||
      descriptorStat.ino !== beforeOpen.ino
    ) {
      throw new Error('Host mount marker changed while opening')
    }

    const contents = await handle.readFile()
    if (
      contents.length !== expectedContents.length ||
      !timingSafeEqual(contents, expectedContents)
    ) {
      throw new Error('Invalid host mount marker contents')
    }

    const afterOpen = await lstat(filePath, { bigint: true })
    if (
      !hasSecureHostMountMarkerMetadata(afterOpen, expectedSize) ||
      afterOpen.dev !== descriptorStat.dev ||
      afterOpen.ino !== descriptorStat.ino ||
      afterOpen.size !== descriptorStat.size
    ) {
      throw new Error('Host mount marker changed while reading')
    }

    return {
      filePath,
      device: descriptorStat.dev,
      inode: descriptorStat.ino,
      size: descriptorStat.size,
      contentSha256: createHash('sha256').update(contents).digest(),
    }
  } finally {
    await handle?.close().catch(() => {})
  }
}

/** Parse a canonical CSV without normalizing whitespace, signs, or leading zeroes. */
export function parseBootstrapUserIds(value: string): number[] {
  if (!CANONICAL_USER_IDS_PATTERN.test(value)) {
    throw new BootstrapCredentialRotationError(
      'invalid_user_ids',
      BOOTSTRAP_ROTATION_MESSAGES.invalidUserIds
    )
  }

  const ids = value.split(',').map(Number)
  if (
    ids.length !== EXPECTED_BOOTSTRAP_USER_COUNT ||
    new Set(ids).size !== EXPECTED_BOOTSTRAP_USER_COUNT ||
    ids.some((id) => !Number.isSafeInteger(id) || id < 1 || id > POSTGRES_INT4_MAX)
  ) {
    throw new BootstrapCredentialRotationError(
      'invalid_user_ids',
      BOOTSTRAP_ROTATION_MESSAGES.invalidUserIds
    )
  }

  return ids
}

export function assertBootstrapUserIds(userIds: readonly number[]): void {
  if (
    userIds.length !== EXPECTED_BOOTSTRAP_USER_COUNT ||
    new Set(userIds).size !== EXPECTED_BOOTSTRAP_USER_COUNT ||
    userIds.some((id) => !Number.isSafeInteger(id) || id < 1 || id > POSTGRES_INT4_MAX)
  ) {
    throw new BootstrapCredentialRotationError(
      'invalid_user_ids',
      BOOTSTRAP_ROTATION_MESSAGES.invalidUserIds
    )
  }
}

/** Root accounts are presented first for recovery ergonomics, then by stable ID. */
export function sortBootstrapCredentialAccounts(
  accounts: BootstrapCredentialAccount[]
): BootstrapCredentialAccount[] {
  return [...accounts].sort((left, right) => {
    const leftIsRoot = left.roles.includes(IRole.Slugs.ROOT)
    const rightIsRoot = right.roles.includes(IRole.Slugs.ROOT)

    if (leftIsRoot !== rightIsRoot) {
      return leftIsRoot ? -1 : 1
    }

    return left.user_id - right.user_id
  })
}

/**
 * A generated hash is unique to this process, so seeing all three exact hashes
 * proves the transaction committed. The all-original state proves rollback;
 * any mixed, missing, or changed state remains intentionally ambiguous.
 */
export function classifyBootstrapCommitOutcome(
  states: readonly BootstrapPasswordCommitState[],
  rows: readonly BootstrapStoredPasswordRow[]
): BootstrapCommitResolution {
  if (rows.length !== states.length) {
    return 'ambiguous'
  }

  const passwordsByUserId = new Map(rows.map((row) => [Number(row.id), String(row.password)]))
  if (passwordsByUserId.size !== states.length) {
    return 'ambiguous'
  }
  if (states.every((state) => passwordsByUserId.get(state.userId) === state.generatedHash)) {
    return 'committed'
  }
  if (states.every((state) => passwordsByUserId.get(state.userId) === state.originalHash)) {
    return 'rolled_back'
  }
  return 'ambiguous'
}

/**
 * Resolve and validate the destination before any database lock is acquired.
 * The private parent requirement also prevents another local user from racing
 * directory entries around the O_EXCL/O_NOFOLLOW create.
 */
export async function resolveSecureBootstrapOutputTarget(
  outputPath: string,
  applicationRoot: string,
  requiredHostMountDirectory?: string
): Promise<SecureBootstrapOutputTarget> {
  try {
    if (
      !isAbsolute(outputPath) ||
      resolve(outputPath) !== outputPath ||
      basename(outputPath) === '' ||
      outputPath.includes('\0')
    ) {
      throw new BootstrapCredentialRotationError(
        'invalid_output_path',
        BOOTSTRAP_ROTATION_MESSAGES.invalidOutputPath
      )
    }

    const requestedParent = dirname(outputPath)
    const parentLinkStat = await lstat(requestedParent)
    const resolvedParent = await realpath(requestedParent)

    if (
      !parentLinkStat.isDirectory() ||
      parentLinkStat.isSymbolicLink() ||
      resolvedParent !== requestedParent
    ) {
      throw new BootstrapCredentialRotationError(
        'invalid_output_path',
        BOOTSTRAP_ROTATION_MESSAGES.invalidOutputPath
      )
    }

    const parentStat = await lstat(resolvedParent)
    const effectiveUserId = currentEffectiveUserId()
    if (
      !parentStat.isDirectory() ||
      (parentStat.mode & 0o7777) !== OUTPUT_DIRECTORY_MODE ||
      (effectiveUserId !== undefined && parentStat.uid !== effectiveUserId)
    ) {
      throw new BootstrapCredentialRotationError(
        'invalid_output_path',
        BOOTSTRAP_ROTATION_MESSAGES.invalidOutputPath
      )
    }

    const resolvedApplicationRoot = await realpath(applicationRoot)
    const filePath = join(resolvedParent, basename(outputPath))
    if (isWithin(resolvedApplicationRoot, filePath)) {
      throw new BootstrapCredentialRotationError(
        'invalid_output_path',
        BOOTSTRAP_ROTATION_MESSAGES.invalidOutputPath
      )
    }

    let hostMountMarker: BootstrapHostMountMarker | undefined
    if (requiredHostMountDirectory !== undefined) {
      try {
        if (
          !isAbsolute(requiredHostMountDirectory) ||
          resolve(requiredHostMountDirectory) !== requiredHostMountDirectory ||
          (await realpath(requiredHostMountDirectory)) !== requiredHostMountDirectory ||
          resolvedParent !== requiredHostMountDirectory
        ) {
          throw new Error('Output is outside the required host mount')
        }
        hostMountMarker = await readBootstrapHostMountMarker(requiredHostMountDirectory)
      } catch {
        throw new BootstrapCredentialRotationError(
          'invalid_output_mount',
          BOOTSTRAP_ROTATION_MESSAGES.invalidOutputMount
        )
      }
    }

    try {
      await lstat(filePath)
      throw new BootstrapCredentialRotationError(
        'output_exists',
        BOOTSTRAP_ROTATION_MESSAGES.outputExists
      )
    } catch (error) {
      if (!hasErrnoCode(error, 'ENOENT')) {
        throw error
      }
    }

    return { filePath, parentPath: resolvedParent, hostMountMarker }
  } catch (error) {
    if (error instanceof BootstrapCredentialRotationError) {
      throw error
    }

    throw new BootstrapCredentialRotationError(
      'invalid_output_path',
      BOOTSTRAP_ROTATION_MESSAGES.invalidOutputPath
    )
  }
}

async function syncDirectory(parentPath: string): Promise<void> {
  const directory = await open(
    parentPath,
    constants.O_RDONLY | constants.O_DIRECTORY | constants.O_NOFOLLOW
  )
  try {
    await directory.sync()
  } finally {
    await directory.close()
  }
}

function hasSecureFileMetadata(
  fileStat: BigIntStats,
  expected?: Pick<CreatedBootstrapCredentialFile, 'device' | 'inode' | 'size'>
): boolean {
  const effectiveUserId = currentEffectiveUserId()

  return (
    fileStat.isFile() &&
    fileStat.nlink === 1n &&
    (fileStat.mode & 0o7777n) === BigInt(OUTPUT_FILE_MODE) &&
    (effectiveUserId === undefined || fileStat.uid === BigInt(effectiveUserId)) &&
    (expected === undefined ||
      (fileStat.dev === expected.device &&
        fileStat.ino === expected.inode &&
        fileStat.size === expected.size))
  )
}

/** Create the only plaintext credential artifact, durably, without following links. */
export async function writeBootstrapCredentialFile(
  target: SecureBootstrapOutputTarget,
  document: BootstrapCredentialDocument
): Promise<CreatedBootstrapCredentialFile> {
  const serializedDocument = `${JSON.stringify(document, null, 2)}\n`
  const serializedBytes = Buffer.from(serializedDocument, 'utf8')
  const contentSha256 = createHash('sha256').update(serializedBytes).digest()
  let handle: Awaited<ReturnType<typeof open>> | undefined
  let fileWasCreated = false
  let createdIdentity: Pick<CreatedBootstrapCredentialFile, 'device' | 'inode'> | undefined

  try {
    handle = await open(
      target.filePath,
      constants.O_WRONLY | constants.O_CREAT | constants.O_EXCL | constants.O_NOFOLLOW,
      OUTPUT_FILE_MODE
    )
    fileWasCreated = true
    await handle.chmod(OUTPUT_FILE_MODE)

    const initialStat = await handle.stat({ bigint: true })
    createdIdentity = { device: initialStat.dev, inode: initialStat.ino }
    if (!hasSecureFileMetadata(initialStat)) {
      throw new Error('Created output file did not satisfy the secure file contract')
    }

    await handle.writeFile(serializedBytes)
    await handle.sync()
    const finalStat = await handle.stat({ bigint: true })
    if (
      !hasSecureFileMetadata(finalStat) ||
      finalStat.dev !== createdIdentity.device ||
      finalStat.ino !== createdIdentity.inode ||
      finalStat.size !== BigInt(serializedBytes.byteLength)
    ) {
      throw new Error('Created output file changed while it was being written')
    }
    await handle.close()
    handle = undefined
    await syncDirectory(target.parentPath)

    return {
      ...target,
      ...createdIdentity,
      size: finalStat.size,
      contentSha256,
    }
  } catch (error) {
    if (handle) {
      await handle.sync().catch(() => {})
      await handle.close().catch(() => {})
    }

    if (fileWasCreated) {
      await syncDirectory(target.parentPath).catch(() => {})
      throw new BootstrapCredentialRotationError(
        'output_write_failed',
        BOOTSTRAP_ROTATION_MESSAGES.outputWriteFailedRetained,
        true
      )
    }

    if (hasErrnoCode(error, 'EEXIST')) {
      throw new BootstrapCredentialRotationError(
        'output_exists',
        BOOTSTRAP_ROTATION_MESSAGES.outputExists
      )
    }

    throw new BootstrapCredentialRotationError(
      'output_write_failed',
      BOOTSTRAP_ROTATION_MESSAGES.outputWriteFailed
    )
  }
}

/** Revalidate the exact path, inode, mode, size, and contents immediately before commit. */
export async function assertBootstrapCredentialFileIntegrity(
  createdFile: CreatedBootstrapCredentialFile
): Promise<void> {
  let handle: Awaited<ReturnType<typeof open>> | undefined
  try {
    if (createdFile.hostMountMarker) {
      const expectedMarker = createdFile.hostMountMarker
      const currentMarker = await readBootstrapHostMountMarker(dirname(expectedMarker.filePath))
      if (
        currentMarker.filePath !== expectedMarker.filePath ||
        currentMarker.device !== expectedMarker.device ||
        currentMarker.inode !== expectedMarker.inode ||
        currentMarker.size !== expectedMarker.size ||
        !timingSafeEqual(currentMarker.contentSha256, expectedMarker.contentSha256)
      ) {
        throw new Error('Host mount marker changed')
      }
    }

    const resolvedParent = await realpath(createdFile.parentPath)
    const parentStat = await lstat(createdFile.parentPath)
    const effectiveUserId = currentEffectiveUserId()
    if (
      resolvedParent !== createdFile.parentPath ||
      !parentStat.isDirectory() ||
      (parentStat.mode & 0o7777) !== OUTPUT_DIRECTORY_MODE ||
      (effectiveUserId !== undefined && parentStat.uid !== effectiveUserId)
    ) {
      throw new Error('Output parent changed')
    }

    const beforeOpen = await lstat(createdFile.filePath, { bigint: true })
    if (!hasSecureFileMetadata(beforeOpen, createdFile)) {
      throw new Error('Output path changed')
    }

    handle = await open(createdFile.filePath, constants.O_RDONLY | constants.O_NOFOLLOW)
    const descriptorStat = await handle.stat({ bigint: true })
    if (!hasSecureFileMetadata(descriptorStat, createdFile)) {
      throw new Error('Output descriptor changed')
    }

    const contents = await handle.readFile()
    const contentSha256 = createHash('sha256').update(contents).digest()
    if (!timingSafeEqual(contentSha256, createdFile.contentSha256)) {
      throw new Error('Output contents changed')
    }

    const afterOpen = await lstat(createdFile.filePath, { bigint: true })
    if (!hasSecureFileMetadata(afterOpen, createdFile)) {
      throw new Error('Output path changed during validation')
    }
  } catch {
    throw new BootstrapCredentialRotationError(
      'output_integrity_failed',
      BOOTSTRAP_ROTATION_MESSAGES.outputIntegrityFailed,
      true
    )
  } finally {
    await handle?.close().catch(() => {})
  }
}
