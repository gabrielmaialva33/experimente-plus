export type DeploymentEnvironment = 'development' | 'homologation' | 'production'

/** Missing configuration is production; unknown values never lower the policy. */
export function deploymentEnvironment(value?: string): DeploymentEnvironment {
  if (value === undefined) return 'production'
  if (value === 'development' || value === 'homologation' || value === 'production') return value
  throw new Error('DEPLOYMENT_ENV must be development, homologation or production')
}

/** Internet-facing homologation keeps the same transport/privacy protections as production. */
export function isHostedDeployment(value?: string): boolean {
  return deploymentEnvironment(value) !== 'development'
}
