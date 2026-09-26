/**
 * Brazilian time zones by the name people use (audit W43/W63), keyed by the
 * IANA identifier the server stores. Anything else is shown as stored.
 */
export const BRAZILIAN_TIME_ZONES: Array<{ value: string; label: string }> = [
  { value: 'America/Sao_Paulo', label: 'Horário de Brasília' },
  { value: 'America/Manaus', label: 'Horário do Amazonas (−1h)' },
  { value: 'America/Rio_Branco', label: 'Horário do Acre (−2h)' },
  { value: 'America/Noronha', label: 'Horário de Fernando de Noronha (+1h)' },
]

export function timeZoneLabel(value: string): string {
  return BRAZILIAN_TIME_ZONES.find((zone) => zone.value === value)?.label ?? value
}
