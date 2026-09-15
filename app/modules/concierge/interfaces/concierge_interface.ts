/**
 * Concierge IA — ADR-0029.
 *
 * The model composes language and is never a source of fact. Everything it may
 * mention arrives as a closed set of catalogue items, and it answers by citing
 * their identifiers. Prose that names nothing is safe; a citation that names
 * something absent from the set is removed before the consumer sees it.
 */
namespace IConcierge {
  /** A catalogue item handed to the model. Nothing else may be referenced. */
  export interface GroundingItem {
    id: number
    kind: 'establishment'
    name: string
    city: string
    district: string | null
    category: string | null
    opens_at: string | null
    closes_at: string | null
  }

  /** The shape the model is required to answer in, so citations are checkable. */
  export interface ModelAnswer {
    intro: string
    steps: { id: number; why: string }[]
  }

  export interface GroundedAnswer {
    intro: string
    steps: { item: GroundingItem; why: string }[]
    /** Citations the model produced for items it was never given. */
    discarded: number[]
    /** True when nothing survived validation and the caller must degrade. */
    empty: boolean
  }

  export type Outcome = 'grounded' | 'degraded' | 'refused'

  export interface Reply {
    outcome: Outcome
    /** Present for a grounded answer; absent when degraded or refused. */
    text: string | null
    /** Always the catalogue items that back the reply, in order. */
    items: GroundingItem[]
    /** Which model produced it, or null when no model was called. */
    model: string | null
  }

  export interface ProviderRequest {
    model: string
    system: string
    user: string
    maxOutputTokens: number
    timeoutMs: number
  }

  export interface ProviderResult {
    /** Raw assistant content. Reasoning, when the model emits it, is dropped. */
    content: string
    model: string
  }

  export interface Provider {
    readonly name: string
    complete(request: ProviderRequest): Promise<ProviderResult>
  }
}

export default IConcierge
