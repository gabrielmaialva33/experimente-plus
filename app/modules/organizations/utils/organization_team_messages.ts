import type IOrganization from '#modules/organizations/interfaces/organization_interface'

/**
 * pt-BR copy of the web team and invitation flows. The API keeps the domain
 * services' English messages; the Inertia controllers translate the rules a
 * person can actually trip into sentences that say what to do next.
 */

export const ORGANIZATION_ROLE_LABELS: Record<IOrganization.Role, string> = {
  owner: 'Proprietário',
  admin: 'Administrador',
  editor: 'Editor',
  analyst: 'Analista',
}

export function organizationRoleLabel(role: IOrganization.Role): string {
  return ORGANIZATION_ROLE_LABELS[role] ?? role
}

const TEAM_RULE_MESSAGES: Record<string, string> = {
  'This user is already an active organization member':
    'Esta pessoa já faz parte da equipe. Para mudar o acesso dela, altere o papel na lista.',
  'The last active organization owner cannot be changed':
    'A organização precisa de pelo menos um proprietário ativo. Promova outra pessoa a proprietário antes de fazer esta alteração.',
  'Removed memberships may only be reactivated by invitation or claim':
    'Quem foi removido da equipe só volta com um novo convite.',
  'Organization member is already removed': 'Esta pessoa já foi removida da equipe.',
  'At least one membership field must be provided': 'Escolha o que deseja alterar.',
  'Organization invitation has already been accepted': 'Este convite já foi aceito.',
  'Organization invitation has been revoked': 'Este convite foi cancelado.',
  'Organization invitation has expired':
    'Este convite expirou. Peça a quem convidou você para reenviá-lo.',
  'The authenticated account does not match the invitation email':
    'Você entrou com uma conta de outro e-mail. Entre com o e-mail que recebeu o convite para aceitá-lo.',
  'User is already an active organization member': 'Você já faz parte da equipe desta organização.',
  'Suspended membership requires an administrative decision':
    'Seu acesso a esta organização está suspenso. Peça a um proprietário ou administrador para reativá-lo.',
  'Organization member not found': 'Não encontramos esta pessoa na equipe. Atualize a página.',
  'Organization invitation not found':
    'Não encontramos este convite. Ele pode ter sido substituído por um mais recente.',
}

/**
 * Translates a domain rule refused by the team services. Unknown messages
 * fall back to a neutral sentence instead of leaking English or internals.
 */
export function organizationTeamErrorMessage(message: string): string {
  if (message.startsWith('Organization cannot manage invitations while')) {
    return 'Organizações rejeitadas ou arquivadas não recebem convites.'
  }

  return (
    TEAM_RULE_MESSAGES[message] ??
    'Não foi possível concluir a alteração na equipe. Atualize a página e tente novamente.'
  )
}

/**
 * `maria.silva@exemplo.com` → `ma•••@exemplo.com`. The acceptance page names
 * the invited address to whoever opens the link only through this hint.
 */
export function maskEmail(email: string): string {
  const [local, domain] = email.split('@')
  if (!domain) return '•••'

  const visible = local.length <= 2 ? local.slice(0, 1) : local.slice(0, 2)
  return `${visible}•••@${domain}`
}
