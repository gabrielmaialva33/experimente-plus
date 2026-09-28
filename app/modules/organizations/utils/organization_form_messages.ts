/**
 * pt-BR copy of the Portal organization form. The organization service answers
 * in the API's words, a 400 with an English message, and the web form had no
 * translation: a CNPJ with a wrong check digit reached the partner as a raw
 * error instead of a note under the field. These are the service's rules a
 * person fixes in the form, each tied to the field it names.
 */
const FIELD_RULES: Record<string, readonly [field: string, message: string]> = {
  'CNPJ is invalid': ['tax_id', 'CNPJ inválido. Confira os 14 números.'],
  'CNPJ is already in use in this operation': [
    'tax_id',
    'Este CNPJ já tem cadastro no Experimente+. Se o negócio é seu, peça acesso a quem administra a organização.',
  ],
  'Organization slug is invalid': ['slug', 'Use letras, números e hífens no endereço.'],
  'Organization slug is already in use': ['slug', 'Este endereço já está em uso. Escolha outro.'],
  'Phone must contain between 10 and 15 digits': [
    'phone',
    'Informe o telefone com DDD, de 10 a 15 números.',
  ],
  'Website must be a valid HTTP or HTTPS URL': [
    'website',
    'Informe o endereço completo, começando com https://.',
  ],
}

/** The field error for a service rule, or null when the rule is not the form's to fix. */
export function organizationFormErrors(message: string): Record<string, string> | null {
  const rule = FIELD_RULES[message]
  return rule ? { [rule[0]]: rule[1] } : null
}
