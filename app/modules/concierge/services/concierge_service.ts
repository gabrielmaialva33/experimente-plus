import { inject } from '@adonisjs/core'

import NvidiaProvider, {
  ConciergeUnavailableException,
} from '#modules/concierge/adapters/nvidia_provider'
import type IConcierge from '#modules/concierge/interfaces/concierge_interface'
import GroundingService from '#modules/concierge/services/grounding_service'
import env from '#start/env'

/**
 * Subjects the contracted scope places outside this module. The boundary is a
 * rule in code, not an instruction to the model: a contractual limit cannot
 * rest on a probabilistic system, and a refusal we wrote is a refusal we can
 * test.
 */
const OUT_OF_SCOPE =
  /\b(advogad|jurídic|juridic|process(o|ar)|médic|medic|remédi|remedi|sintoma|diagnóstic|diagnostic|receita médica|investi(r|mento)|empréstim|emprestim|financiament|imposto|emergência|emergencia|socorro|ambulânci|ambulanci|polícia|policia|bombeir)/i

const REFUSAL =
  'Só consigo ajudar a descobrir lugares, experiências e eventos cadastrados no Experimente+. ' +
  'Para assuntos jurídicos, de saúde, financeiros ou de emergência, procure um profissional ou o serviço oficial adequado.'

const SYSTEM_PROMPT = [
  'Você é o concierge do Experimente+, um app de descoberta de lugares.',
  'Use EXCLUSIVAMENTE os lugares da lista fornecida. Nunca cite lugar que não esteja nela.',
  'Responda em português do Brasil e APENAS com JSON válido, sem texto fora do JSON, no formato:',
  '{"intro":"uma frase curta","steps":[{"id":<id da lista>,"why":"uma frase curta"}]}',
  'Use no máximo 4 steps. Não invente id. Não faça reservas, compras nem confirmações.',
].join(' ')

@inject()
export default class ConciergeService {
  constructor(private grounding: GroundingService) {}

  /** Off-topic never reaches the provider: no call, no cost, no uncertainty. */
  isOutOfScope(question: string): boolean {
    return OUT_OF_SCOPE.test(question)
  }

  async answer(
    question: string,
    offered: IConcierge.GroundingItem[],
    withheld: readonly string[] = []
  ): Promise<IConcierge.Reply> {
    if (this.isOutOfScope(question))
      return { outcome: 'refused', text: REFUSAL, items: [], model: null }

    if (!env.get('CONCIERGE_ENABLED', false) || offered.length === 0) return this.degrade(offered)

    const provider = this.provider()
    if (!provider) return this.degrade(offered)

    const user = [
      'Lugares disponíveis:',
      ...offered.map((i) => this.describe(i)),
      '',
      `Pergunta: ${question}`,
    ].join('\n')

    const request = {
      system: SYSTEM_PROMPT,
      user,
      maxOutputTokens: env.get('CONCIERGE_MAX_OUTPUT_TOKENS', 400),
      timeoutMs: env.get('CONCIERGE_TIMEOUT_MS', 12000),
    }

    // Primary first, then the reserve. Measured behaviour, not caution: the
    // provider returned 529 under load and answers 404 for some listed models.
    for (const model of this.models()) {
      let result: IConcierge.ProviderResult
      try {
        result = await provider.complete({ ...request, model })
      } catch (error) {
        if (error instanceof ConciergeUnavailableException) continue
        throw error
      }

      const parsed = this.grounding.parse(result.content)
      if (!parsed) continue

      const validated = this.grounding.validate(parsed, offered, withheld)
      if (validated.empty) continue

      return {
        outcome: 'grounded',
        text: this.render(validated),
        items: validated.steps.map((step) => step.item),
        model: result.model,
      }
    }

    return this.degrade(offered)
  }

  /** No model, no answer: the catalogue itself, never an error or an empty screen. */
  private degrade(items: IConcierge.GroundingItem[]): IConcierge.Reply {
    return { outcome: 'degraded', text: null, items, model: null }
  }

  private models(): string[] {
    return [env.get('CONCIERGE_PRIMARY_MODEL', ''), env.get('CONCIERGE_FALLBACK_MODEL', '')].filter(
      (model): model is string => model.length > 0
    )
  }

  private provider(): IConcierge.Provider | null {
    const baseUrl = env.get('CONCIERGE_BASE_URL', '')
    const apiKey = env.get('NVIDIA_API_KEY', '')
    if (!baseUrl || !apiKey) return null
    return new NvidiaProvider(baseUrl, apiKey)
  }

  private describe(item: IConcierge.GroundingItem): string {
    const hours = item.opens_at ? ` abre ${item.opens_at}` : ''
    const where = [item.district, item.city].filter(Boolean).join(', ')
    return `- id ${item.id}: ${item.name} — ${item.category ?? 'sem categoria'}, ${where}${hours}`
  }

  private render(answer: IConcierge.GroundedAnswer): string {
    const steps = answer.steps.map((step) => `${step.item.name}: ${step.why}`.trim())
    return [answer.intro, ...steps].filter(Boolean).join('\n')
  }
}
