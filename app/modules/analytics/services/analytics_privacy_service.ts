import { createHmac } from 'node:crypto'

import BadRequestException from '#exceptions/bad_request_exception'
import env from '#start/env'

export default class AnalyticsPrivacyService {
  private readonly secret = env.get('ANALYTICS_HASH_SECRET')

  hash(namespace: string, value: string): string {
    return createHmac('sha256', this.secret).update(`${namespace}\u0000${value}`).digest('hex')
  }

  redactSearchTerm(value: string): { redacted: string; hash: string } {
    const normalized = [...value.normalize('NFKC')]
      .filter((character) => {
        const codePoint = character.codePointAt(0) ?? 0
        return codePoint >= 32 && codePoint !== 127
      })
      .join('')
      .toLowerCase()
      .replace(/\b[a-z0-9._%+-]+@[a-z0-9.-]+\.[a-z]{2,}\b/gi, '[email]')
      .replace(/\b(?:https?:\/\/|www\.)\S+/gi, '[link]')
      .replace(/(?:\+?\d[\d\s().-]{7,}\d)/g, '[telefone]')
      .replace(/\b\d{6,}\b/g, '[numero]')
      .replace(/\s+/g, ' ')
      .trim()
      .slice(0, 120)

    if (!normalized) {
      throw new BadRequestException('Search term is empty after privacy normalization')
    }

    return {
      redacted: normalized,
      hash: this.hash('analytics-search-term', normalized),
    }
  }
}
