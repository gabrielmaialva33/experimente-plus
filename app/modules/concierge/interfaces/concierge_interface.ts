/**
 * Concierge IA — ADR-0029.
 *
 * The model composes language and is never a source of fact. Everything it may
 * mention arrives as a closed set of catalogue items, and it answers by citing
 * their references. Prose that names nothing is safe; a citation that names
 * something absent from the set is removed before the consumer sees it.
 */
namespace IConcierge {
  /**
   * What may be grounded on: a place, something it offers, something it hosts.
   *
   * Showcase items of ADR-0028 are deliberately absent. A showcase item is a
   * displayed product with an informational price and no availability of its
   * own, so citing one would invite the answer to talk about what is on sale
   * right now, which nothing in the data supports.
   */
  export const GROUNDING_KINDS = ['establishment', 'experience', 'event'] as const
  export type GroundingKind = (typeof GROUNDING_KINDS)[number]

  /**
   * The identity a citation is made of.
   *
   * It has to be composite. Establishments, experiences and events number their
   * rows independently, so a bare `7` belongs to three different things at once:
   * the model citing experience 7 would have validated as establishment 7 and
   * the consumer would have received a verified-looking reference to the wrong
   * place. That is worse than invention, because invention can be spotted.
   *
   * It is a citation token, not an address. Nothing public is addressable by it:
   * a link is built from `city_slug` and `establishment_slug` (ADR-0016 §6), and
   * a client that parses this string is reading an internal detail it was not
   * given a contract for.
   */
  export const refOf = (kind: GroundingKind, id: number): string => `${kind}:${id}`

  /** A catalogue item handed to the model. Nothing else may be referenced. */
  export interface GroundingItem {
    /** `<kind>:<id>` — the only identity the model cites and we validate. */
    ref: string
    kind: GroundingKind
    /** The establishment's public name, or the approved title of the content. */
    name: string
    city_slug: string
    /** With `city_slug`, the deterministic public link of the establishment. */
    establishment_slug: string
    establishment_name: string
    district: string | null
    category: string | null
    /** Events only, from the approved snapshot — never the live column. */
    starts_at: string | null
    ends_at: string | null
  }

  /** The shape the model is required to answer in, so citations are checkable. */
  export interface ModelAnswer {
    intro: string
    steps: { ref: string; why: string }[]
  }

  export interface GroundedAnswer {
    intro: string
    steps: { item: GroundingItem; why: string }[]
    /** References the model produced for items it was never given. */
    discarded: string[]
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

  /**
   * What the routes answer. `personalized` says whether the caller's interests
   * chose which places entered the prompt — never whether the model saw them:
   * interests do not leave the server (ADR-0029, revision of 23/09/2026).
   */
  export type RouteReply = Reply & { personalized: boolean }

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

  /**
   * What an operation decides about its assistant — ADR-0029, revision of
   * 26/09/2026. Provider, models and key are infrastructure and stay in the
   * environment; these are the operation's own choices.
   */
  export type PolicyValues = {
    /** Off answers like the infrastructure-off path: the catalogue, no model. */
    enabled: boolean
    /** The single prompt budget `splitGroundingBudget` divides. */
    max_catalog_items: number
    /** Model calls one signed-in person may cause per day (see `ConciergeQuotaService`). */
    daily_questions_per_person: number
  }

  export type UpdatePolicyPayload = Partial<PolicyValues>

  /**
   * The table and the validator hold the same ranges. Eight is the smallest
   * budget that still gives events and experiences two slots each and
   * establishments four — the most steps an answer may have. Forty is twice
   * the measured default: past it the prompt grows while an answer of at most
   * four steps uses none of the extra, and latency and cost grow with it.
   * One question a day is the least that is still an assistant (switching it
   * off is `enabled`), and two hundred caps what a single account can spend.
   */
  export const POLICY_RANGES = {
    max_catalog_items: { min: 8, max: 40 },
    daily_questions_per_person: { min: 1, max: 200 },
  } as const

  /** The values ADR-0029 proposed; provisional until Anexo I item 15 is decided. */
  export const DEFAULT_POLICY: PolicyValues = {
    enabled: true,
    max_catalog_items: 20,
    daily_questions_per_person: 20,
  }

  /**
   * What the screen shows about the infrastructure. Never a key. A type alias,
   * not an interface: Inertia props must be assignable to a JSON record, and an
   * interface has no implicit index signature.
   */
  export type InfrastructureStatus = {
    /** `CONCIERGE_ENABLED`: the deployment's own switch. */
    globally_enabled: boolean
    /** Base URL and key both present — a boolean, the key is never read out. */
    provider_configured: boolean
    primary_model: string | null
    fallback_model: string | null
  }
}

export default IConcierge
