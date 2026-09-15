import type IConcierge from '#modules/concierge/interfaces/concierge_interface'

/**
 * The deterministic safeguard of ADR-0029.
 *
 * A first attempt at this check hunted for capitalised words in free prose and
 * flagged "Você" and "Depois" as invented places, which is why the model is
 * required to cite items by identifier instead: an identifier either belongs to
 * the set that was handed over or it does not, and no heuristic is involved.
 *
 * Prose still receives a narrower check. The model cannot be stopped from
 * writing a name, but it can be caught naming an item of the catalogue that was
 * deliberately withheld — another city, an archived place — which is the
 * failure that would mislead a consumer.
 */
export default class GroundingService {
  /** Parses the model's answer, tolerating the fences models like to add. */
  parse(content: string): IConcierge.ModelAnswer | null {
    const fenced = content.match(/```(?:json)?\s*([\s\S]*?)```/)
    const candidate = (fenced ? fenced[1] : content).trim()
    const start = candidate.indexOf('{')
    const end = candidate.lastIndexOf('}')
    if (start === -1 || end <= start) return null

    let parsed: unknown
    try {
      parsed = JSON.parse(candidate.slice(start, end + 1))
    } catch {
      return null
    }
    if (typeof parsed !== 'object' || parsed === null) return null

    const record = parsed as Record<string, unknown>
    const steps = Array.isArray(record.steps) ? record.steps : []
    return {
      intro: typeof record.intro === 'string' ? record.intro.trim() : '',
      steps: steps.flatMap((step) => {
        if (typeof step !== 'object' || step === null) return []
        const entry = step as Record<string, unknown>
        const id = Number(entry.id)
        if (!Number.isInteger(id)) return []
        return [{ id, why: typeof entry.why === 'string' ? entry.why.trim() : '' }]
      }),
    }
  }

  /**
   * Keeps only what the model was actually given. `withheld` are catalogue
   * items the request deliberately excluded; naming one of those in prose is
   * treated as invention, because the consumer cannot tell the difference.
   */
  validate(
    answer: IConcierge.ModelAnswer,
    offered: IConcierge.GroundingItem[],
    withheld: readonly string[] = []
  ): IConcierge.GroundedAnswer {
    const byId = new Map(offered.map((item) => [item.id, item]))
    const steps: IConcierge.GroundedAnswer['steps'] = []
    const discarded: number[] = []
    const seen = new Set<number>()

    for (const step of answer.steps) {
      const item = byId.get(step.id)
      if (!item) {
        discarded.push(step.id)
        continue
      }
      // A repeated citation is not invention, but it is not a step either.
      if (seen.has(step.id)) continue
      seen.add(step.id)
      steps.push({ item, why: this.clean(step.why, withheld) })
    }

    const intro = this.clean(answer.intro, withheld)
    return { intro, steps, discarded, empty: steps.length === 0 }
  }

  /** Drops a sentence that names a catalogue item the model was not given. */
  private clean(text: string, withheld: readonly string[]): string {
    if (!text || withheld.length === 0) return text
    const lowered = withheld.map((name) => name.toLowerCase())
    return text
      .split(/(?<=[.!?])\s+/)
      .filter((sentence) => !lowered.some((name) => sentence.toLowerCase().includes(name)))
      .join(' ')
      .trim()
  }
}
