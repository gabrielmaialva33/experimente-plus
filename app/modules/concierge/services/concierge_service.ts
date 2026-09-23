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
  'Você é o concierge do Experimente+, um app de descoberta de lugares, experiências e eventos.',
  'Use EXCLUSIVAMENTE os itens da lista fornecida. Nunca cite item que não esteja nela.',
  'Nunca afirme disponibilidade, vaga, horário, data ou preço que não esteja escrito na lista.',
  'Não converta nem reescreva datas e horários: repita exatamente como aparecem, ou não os cite.',
  'Responda em português do Brasil e APENAS com JSON válido, sem texto fora do JSON, no formato:',
  '{"intro":"uma frase curta","steps":[{"ref":"<ref da lista>","why":"uma frase curta"}]}',
  'O ref é a string exata da lista, como "establishment:12" ou "event:7".',
  'Use no máximo 4 steps. Não invente ref. Não faça reservas, compras nem confirmações.',
].join(' ')

/** How each species is named for the model, in the language of the answer. */
const KIND_LABEL: Record<IConcierge.GroundingKind, string> = {
  establishment: 'lugar',
  experience: 'experiência',
  event: 'evento',
}

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
      'Itens disponíveis:',
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

  /**
   * One line per item, and every fact in it came from the catalogue.
   *
   * The event window travels verbatim from the approved snapshot. Turning it
   * into words here would mean choosing a timezone on the model's behalf, and an
   * hour invented by rounding is still an invented hour; the consumer surface
   * formats it from `starts_at`, which travels in the reply.
   */
  private describe(item: IConcierge.GroundingItem): string {
    const where = [item.district, item.city_slug].filter(Boolean).join(', ')
    const at = item.kind === 'establishment' ? '' : ` em ${item.establishment_name}`
    const when = item.starts_at ? ` — de ${item.starts_at} a ${item.ends_at ?? item.starts_at}` : ''

    return `- ${item.ref} (${KIND_LABEL[item.kind]}): ${item.name}${at} — ${item.category ?? 'sem categoria'}, ${where}${when}`
  }

  private render(answer: IConcierge.GroundedAnswer): string {
    const steps = answer.steps.map((step) => {
      const where = step.item.kind === 'establishment' ? '' : ` (${step.item.establishment_name})`
      return `${step.item.name}${where}: ${step.why}`.trim()
    })

    return [answer.intro, ...steps].filter(Boolean).join('\n')
  }
}
