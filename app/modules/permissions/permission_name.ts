import IPermission from '#modules/permissions/interfaces/permission_interface'

/**
 * Permission names are the stable, machine-readable projection of their
 * resource/action/context tuple. The default `any` context stays implicit for
 * compatibility with the established `resource.action` authorization keys.
 */
export function canonicalPermissionName(
  resource: string,
  action: string,
  context: string = IPermission.Contexts.ANY
): string {
  return context === IPermission.Contexts.ANY
    ? `${resource}.${action}`
    : `${resource}.${action}.${context}`
}
