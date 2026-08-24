import type IOrganization from '#modules/organizations/interfaces/organization_interface'
import Organization from '#modules/organizations/models/organization'
import OrganizationMember from '#modules/organizations/models/organization_member'
import IRole from '#modules/roles/interfaces/role_interface'
import { DateTime } from 'luxon'
import Role from '#modules/roles/models/role'
import Tenant from '#modules/tenants/models/tenant'
import User from '#modules/users/models/user'

let sequence = 0

export async function createOperation(prefix = 'organization-test'): Promise<Tenant> {
  sequence += 1
  return Tenant.create({
    name: `${prefix} ${sequence}`,
    slug: `${prefix}-${sequence}`,
    is_active: true,
  })
}

export async function createUser(
  options: {
    prefix?: string
    tenant?: Tenant
    globalRole?: IRole.Slugs
    tenantRole?: 'owner' | 'admin' | 'member'
  } = {}
): Promise<User> {
  sequence += 1
  const prefix = options.prefix ?? 'organization-user'
  const user = await User.create({
    full_name: `${prefix} ${sequence}`,
    username: `${prefix}-${sequence}`,
    email: `${prefix}-${sequence}@example.com`,
    password: 'password123',
    is_deleted: false,
  })
  const role = await Role.findByOrFail('slug', options.globalRole ?? IRole.Slugs.USER)
  await user.related('roles').sync([role.id])

  if (options.tenant) {
    await user.related('tenants').sync({
      [options.tenant.id]: { role: options.tenantRole ?? 'member' },
    })
  }

  return user
}

export async function createOrganization(options: {
  tenant: Tenant
  owner?: User | null
  status?: IOrganization.Status
  prefix?: string
  cnpjBase?: string
}): Promise<Organization> {
  sequence += 1
  const prefix = options.prefix ?? 'Organization'
  const organization = await Organization.create({
    tenant_id: options.tenant.id,
    legal_name: `${prefix} Legal ${sequence}`,
    trade_name: `${prefix} ${sequence}`,
    slug: `${prefix.toLowerCase().replace(/[^a-z0-9]+/g, '-')}-${sequence}`,
    tax_id: generateCnpj(options.cnpjBase ?? String(100000000000 + sequence).padStart(12, '0')),
    email: `${prefix.toLowerCase().replace(/[^a-z0-9]+/g, '-')}-${sequence}@example.com`,
    phone: `4399${String(1000000 + sequence).slice(-7)}`,
    website: null,
    status: options.status ?? 'draft',
    created_by: options.owner?.id ?? null,
  })

  if (options.owner) {
    await OrganizationMember.create({
      tenant_id: options.tenant.id,
      organization_id: organization.id,
      user_id: options.owner.id,
      role: 'owner',
      status: 'active',
      invited_by: null,
    })
  }

  return organization
}

export async function addOrganizationMember(options: {
  tenant: Tenant
  organization: Organization
  user: User
  role: IOrganization.Role
  status?: IOrganization.MemberStatus
  invitedBy?: User | null
}): Promise<OrganizationMember> {
  return OrganizationMember.create({
    tenant_id: options.tenant.id,
    organization_id: options.organization.id,
    user_id: options.user.id,
    role: options.role,
    status: options.status ?? 'active',
    invited_by: options.invitedBy?.id ?? null,
    suspended_at: options.status === 'suspended' ? DateTime.now() : null,
    removed_at: options.status === 'removed' ? DateTime.now() : null,
  })
}

export function organizationPayload(base = '123456780001') {
  return {
    legal_name: 'Experimente Comércio de Alimentos Ltda',
    trade_name: 'Experimente Café',
    tax_id: formatCnpj(generateCnpj(base)),
    email: 'contato@experimente-cafe.example',
    phone: '(43) 99999-0000',
    website: 'https://experimente-cafe.example',
  }
}

export function generateCnpj(base: string): string {
  const digits = base.replace(/\D/g, '').padStart(12, '0').slice(-12)
  const first = calculateDigit(digits, [5, 4, 3, 2, 9, 8, 7, 6, 5, 4, 3, 2])
  const second = calculateDigit(`${digits}${first}`, [6, 5, 4, 3, 2, 9, 8, 7, 6, 5, 4, 3, 2])
  return `${digits}${first}${second}`
}

export function formatCnpj(value: string): string {
  return value.replace(/^(\d{2})(\d{3})(\d{3})(\d{4})(\d{2})$/, '$1.$2.$3/$4-$5')
}

function calculateDigit(value: string, weights: number[]): number {
  const sum = value
    .split('')
    .reduce((total, digit, index) => total + Number(digit) * weights[index], 0)
  const remainder = sum % 11
  return remainder < 2 ? 0 : 11 - remainder
}
