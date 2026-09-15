import type IConcierge from '#modules/concierge/interfaces/concierge_interface'

/** The provider answered, but not usefully: caller should try the next model. */
export class ConciergeUnavailableException extends Error {
  constructor(
    message: string,
    readonly status: number | null
  ) {
    super(message)
    this.name = 'ConciergeUnavailableException'
  }
}

/**
 * OpenAI-compatible client for the configured provider — ADR-0029.
 *
 * Two behaviours here come from measurement, not documentation. Reasoning is
 * disabled explicitly because one model returns its own deliberation inside the
 * content, and a model the catalogue lists can still answer 404, which is why
 * an unusable response raises rather than propagates.
 */
export default class NvidiaProvider implements IConcierge.Provider {
  readonly name = 'nvidia'

  constructor(
    private baseUrl: string,
    private apiKey: string
  ) {}

  async complete(request: IConcierge.ProviderRequest): Promise<IConcierge.ProviderResult> {
    let response: Response
    try {
      response = await fetch(`${this.baseUrl.replace(/\/+$/, '')}/chat/completions`, {
        method: 'POST',
        headers: {
          'authorization': `Bearer ${this.apiKey}`,
          'content-type': 'application/json',
          'accept': 'application/json',
        },
        body: JSON.stringify({
          model: request.model,
          messages: [
            { role: 'system', content: request.system },
            { role: 'user', content: request.user },
          ],
          max_tokens: request.maxOutputTokens,
          temperature: 0.2,
          stream: false,
          // Measured: without this one model writes "Here's a thinking process"
          // into the content the consumer would read.
          chat_template_kwargs: { enable_thinking: false },
        }),
        signal: AbortSignal.timeout(request.timeoutMs),
      })
    } catch (error) {
      // Timeout and transport failure are the same decision for the caller.
      throw new ConciergeUnavailableException(
        error instanceof Error ? error.message : 'transport failure',
        null
      )
    }

    if (!response.ok) {
      throw new ConciergeUnavailableException(
        `provider responded ${response.status}`,
        response.status
      )
    }

    const payload = (await response.json().catch(() => null)) as Record<string, unknown> | null
    const choices = Array.isArray(payload?.choices) ? payload!.choices : []
    const message = (choices[0] as Record<string, unknown> | undefined)?.message as
      Record<string, unknown> | undefined
    const content = typeof message?.content === 'string' ? message.content : ''

    // Reasoning, where a model exposes it as its own field, is read and dropped
    // rather than concatenated: the consumer receives an answer, never
    // deliberation.
    if (!content.trim()) {
      throw new ConciergeUnavailableException(
        'provider returned no usable content',
        response.status
      )
    }

    return { content, model: request.model }
  }
}
