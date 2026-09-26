export interface ActivationMessages {
  updated: string
  deactivated: string
  reactivated: string
}

/**
 * The notice after saving a record that is retired by deactivation — web
 * audit W9.
 *
 * The edit forms never send `is_active`; only the Ativar/Desativar action does.
 * So when it is present, the notice says what changed for the visitor instead
 * of a bare "atualizada".
 */
export function activationMessage(messages: ActivationMessages, isActive?: boolean): string {
  if (isActive === undefined) return messages.updated
  return isActive ? messages.reactivated : messages.deactivated
}
