import type IConcierge from '#modules/concierge/interfaces/concierge_interface'

/**
 * The deterministic safeguard of ADR-0029.
 *
 * A first attempt at this check hunted for capitalised words in free prose and
 * flagged "Você" and "Depois" as invented places, which is why the model is
 * required to cite items by reference instead: a reference either belongs to the
 * set that was handed over or it does not, and no heuristic is involved.
 *
 * The reference is composite (`<kind>:<id>`) and that is not cosmetic. While it
 * was a bare number, the three species numbered their rows independently, so
 * experience 7 validated as establishment 7: the check approved a citation that
 * pointed at the wrong thing, which is worse than invention because it looks
 * verified. Matching is therefore exact on the whole reference.
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
        const ref = this.normalize(entry.ref ?? entry.id)
        if (!ref) return []
        return [{ ref, why: typeof entry.why === 'string' ? entry.why.trim() : '' }]
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
    const byRef = new Map(offered.map((item) => [this.normalize(item.ref), item]))
    const steps: IConcierge.GroundedAnswer['steps'] = []
    const discarded: string[] = []
    const seen = new Set<string>()

    for (const step of answer.steps) {
      const ref = this.normalize(step.ref)
      const item = ref ? byRef.get(ref) : null
      if (!ref || !item) {
        discarded.push(step.ref)
        continue
      }
      // A repeated citation is not invention, but it is not a step either.
      if (seen.has(ref)) continue
      seen.add(ref)
      steps.push({ item, why: this.clean(step.why, withheld) })
    }

    const intro = this.clean(answer.intro, withheld)
    return { intro, steps, discarded, empty: steps.length === 0 }
  }

  /**
   * One spelling for one reference.
   *
   * A model that answers `"Event:7"` cited an item it was given, and losing the
   * whole answer over a capital letter would degrade a reply that was in fact
   * grounded. Matching stays exact after this: only case and surrounding space
   * are forgiven, never the species or the number.
   */
  private normalize(value: unknown): string | null {
    if (typeof value !== 'string') return null
    const normalized = value.trim().toLowerCase()
    return normalized.length > 0 ? normalized : null
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
