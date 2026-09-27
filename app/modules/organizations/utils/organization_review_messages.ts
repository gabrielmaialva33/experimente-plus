/**
 * pt-BR copy for the rules a moderator can trip in the back-office
 * "Organizações" queue. The API keeps the services' English messages; the
 * Inertia controller says what happened and what to do next instead.
 */
const REVIEW_RULE_MESSAGES: Record<string, string> = {
  'Organization must be pending_review to perform this transition':
    'Esta organização não está mais em análise: outra decisão já foi registrada. Atualize a página para ver a situação atual.',
  'A decision reason is required': 'Escreva o motivo da decisão.',
  'A claim review reason is required': 'Escreva o motivo da decisão.',
  'Only pending organization claims may be reviewed':
    'Esta reivindicação já foi decidida. Atualize a página.',
  'Organization already has an active owner':
    'A organização já tem um proprietário ativo, por isso a reivindicação não pode ser aprovada.',
}

export function organizationReviewErrorMessage(message: string): string {
  if (message.startsWith('Organization cannot be claimed while')) {
    return 'Organizações rejeitadas ou arquivadas não podem ser reivindicadas.'
  }

  return (
    REVIEW_RULE_MESSAGES[message] ??
    'Não foi possível registrar a decisão. Atualize a página e tente de novo.'
  )
}
