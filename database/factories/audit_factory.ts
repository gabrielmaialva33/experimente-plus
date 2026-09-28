import { randomUUID } from 'node:crypto'

import factory from '@adonisjs/lucid/factories'

import { documentationIp } from '#database/factories/support/throwaway'
import IPermission from '#modules/permissions/interfaces/permission_interface'
import AuditLog from '#modules/audits/models/audit_log'

const USER_AGENTS = [
  'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/140.0.0.0 Safari/537.36',
  'Mozilla/5.0 (Linux; Android 14; moto g84 5G) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/140.0.0.0 Mobile Safari/537.36',
  'Mozilla/5.0 (iPhone; CPU iPhone OS 18_6 like Mac OS X) AppleWebKit/605.1.15 (KHTML, like Gecko) Version/18.6 Mobile/15E148 Safari/604.1',
] as const

/**
 * A granted permission check with its request context, as `AuditService`
 * writes it from an HTTP request. Nobody is attributed by default (the column
 * is optional); merge `user_id` for an actor. Addresses come from the
 * documentation ranges, so no row points at a real network.
 */
export const AuditLogFactory = factory
  .define(AuditLog, ({ faker }) => ({
    user_id: null,
    session_id: randomUUID(),
    ip_address: documentationIp(faker),
    user_agent: faker.helpers.arrayElement(USER_AGENTS),
    resource: IPermission.Resources.ORGANIZATIONS,
    action: IPermission.Actions.LIST,
    context: IPermission.Contexts.ANY,
    resource_id: null,
    method: 'GET',
    url: '/api/v1/organizations',
    request_data: {},
    result: 'granted' as const,
    reason: 'Permission granted',
    response_code: 200,
    metadata: null,
  }))
  .state('denied', (log) => {
    log.result = 'denied'
    log.reason = 'Insufficient permissions'
    log.response_code = 403
  })
  .state('unauthenticated', (log) => {
    log.user_id = null
    log.session_id = null
    log.result = 'denied'
    log.reason = 'User not authenticated'
    log.response_code = 401
  })
  .build()
