import vine from '@vinejs/vine'

import { refreshTokenField } from '#modules/auth/validators/refresh_token_field'

const tenantNameField = () => vine.string().trim().minLength(2).maxLength(120)

export const createTenantValidator = vine.compile(
  vine.object({
    name: tenantNameField(),
    refresh_token: refreshTokenField(),
  })
)

export const createWebTenantValidator = vine.compile(
  vine.object({
    name: tenantNameField(),
  })
)

export const switchTenantValidator = vine.compile(
  vine.object({
    tenant_id: vine.number({ strict: true }).withoutDecimals().min(1).max(2_147_483_647),
    refresh_token: refreshTokenField(),
  })
)
