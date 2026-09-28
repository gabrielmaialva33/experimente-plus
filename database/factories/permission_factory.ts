import factory from '@adonisjs/lucid/factories'

import IPermission from '#modules/permissions/interfaces/permission_interface'
import Permission from '#modules/permissions/models/permission'

/**
 * Resources no migration seeds. With the random suffix, a factory permission
 * can never take the name, or the resource/action/context tuple, of one the
 * authorization code depends on.
 */
const RESOURCES = [
  'partner_reports',
  'curated_itineraries',
  'cultural_agenda',
  'loyalty_campaigns',
] as const

/**
 * A global-context permission over a resource of its own. The name is left to
 * the model hook, which derives it from resource, action and context, so the
 * states that change the context keep it canonical.
 */
export const PermissionFactory = factory
  .define(Permission, ({ faker }) => {
    const resource = `${faker.helpers.arrayElement(RESOURCES)}_${faker.string.alphanumeric(6).toLowerCase()}`
    const action = faker.helpers.arrayElement([
      IPermission.Actions.READ,
      IPermission.Actions.LIST,
      IPermission.Actions.UPDATE,
      IPermission.Actions.EXPORT,
    ])
    return {
      resource,
      action,
      context: IPermission.Contexts.ANY,
      description: `Permissão fictícia (${action}) criada para cenários de teste.`,
    }
  })
  .state('own', (permission) => {
    permission.context = IPermission.Contexts.OWN
  })
  .state('team', (permission) => {
    permission.context = IPermission.Contexts.TEAM
  })
  .build()
