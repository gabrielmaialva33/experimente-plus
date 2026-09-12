import { constants } from 'node:fs'
import { open, realpath } from 'node:fs/promises'
import { isAbsolute, relative, sep } from 'node:path'

export const ACCOUNT_KINDS = ['administrator', 'partner', 'customer'] as const
export type AccountKind = (typeof ACCOUNT_KINDS)[number]
export interface ProvisioningAccount {
  fullName: string
  email: string
  password: string
}
export interface HomologationProvisioningConfig {
  tenantSlug: string
  tenantName: string
  accounts: Record<AccountKind, ProvisioningAccount>
}

/** Do not attach input, causes or validation-library payloads to this error. */
export class ProvisioningError extends Error {}

export function parseProvisioningConfig(
  value: unknown,
  testAccounts = false
): HomologationProvisioningConfig {
  const fail = () => {
    throw new ProvisioningError('Invalid provisioning configuration')
  }
  if (!value || typeof value !== 'object') return fail()
  const input = value as HomologationProvisioningConfig
  if (typeof input.tenantSlug !== 'string' || !/^[a-z][a-z0-9-]{2,62}$/.test(input.tenantSlug))
    return fail()
  if (
    typeof input.tenantName !== 'string' ||
    input.tenantName.trim().length < 3 ||
    input.tenantName.length > 120
  )
    return fail()
  const accounts = {} as Record<AccountKind, ProvisioningAccount>
  for (const kind of ACCOUNT_KINDS) {
    const a = input.accounts?.[kind]
    if (
      !a ||
      typeof a.fullName !== 'string' ||
      a.fullName.trim().length < 3 ||
      a.fullName.length > 120 ||
      typeof a.email !== 'string' ||
      a.email.length > 254 ||
      !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(a.email) ||
      (!testAccounts && /\.local$/i.test(a.email)) ||
      typeof a.password !== 'string' ||
      a.password.length < (testAccounts ? 8 : 20) ||
      a.password.length > 128 ||
      !a.password.trim() ||
      (!testAccounts &&
        (!/[a-z]/.test(a.password) || !/[A-Z]/.test(a.password) || !/[0-9]/.test(a.password)))
    )
      return fail()
    accounts[kind] = {
      fullName: a.fullName.trim(),
      email: a.email.toLowerCase(),
      password: a.password,
    }
  }
  if (
    new Set(ACCOUNT_KINDS.map((k) => accounts[k].email)).size !== 3 ||
    (!testAccounts && new Set(ACCOUNT_KINDS.map((k) => accounts[k].password)).size !== 3)
  )
    return fail()
  return { tenantSlug: input.tenantSlug, tenantName: input.tenantName.trim(), accounts }
}

/** One-shot private configuration, never a CLI password argument or a committed fixture. */
export async function readProvisioningConfig(
  path: string,
  applicationRoot: string,
  testAccounts = false
) {
  if (!isAbsolute(path))
    throw new ProvisioningError(
      'Configuration must be an absolute private file outside the application'
    )
  let file
  try {
    const resolved = await realpath(path)
    const root = await realpath(applicationRoot)
    const within = relative(root, resolved)
    if (within !== '..' && !within.startsWith('..' + sep) && !isAbsolute(within)) throw new Error()
    file = await open(path, constants.O_RDONLY | constants.O_NOFOLLOW)
    const stat = await file.stat()
    if (
      !stat.isFile() ||
      (stat.mode & 0o777) !== 0o600 ||
      stat.nlink !== 1 ||
      stat.size > 16384 ||
      (process.getuid && stat.uid !== process.getuid())
    )
      throw new Error()
    return parseProvisioningConfig(JSON.parse(await file.readFile('utf8')), testAccounts)
  } catch {
    throw new ProvisioningError(
      'Configuration must be valid JSON in an owned, non-symlink, mode 0600 private file outside the application'
    )
  } finally {
    await file?.close()
  }
}
