import { describe, expect, it } from 'vitest'

import { extractPresentationToken } from '~/lib/presentation_token'

// The shape of a real token: base64url claims, a dot, a 43-character signature.
const TOKEN = `${'a'.repeat(20)}.${'b'.repeat(43)}`

describe('extractPresentationToken', () => {
  it('takes the token out of the validation URL the QR carries', () => {
    expect(
      extractPresentationToken(
        `https://experimente.test/portal/redemptions/validate?token=${TOKEN}`
      )
    ).toBe(TOKEN)
    // The development server issues plain http links; the path and host do not matter.
    expect(extractPresentationToken(`http://localhost:3333/x?utm=1&token=${TOKEN}`)).toBe(TOKEN)
  })

  it('accepts a bare code, so a partner can type or paste one', () => {
    expect(extractPresentationToken(TOKEN)).toBe(TOKEN)
    expect(extractPresentationToken(`  ${TOKEN}\n`)).toBe(TOKEN)
  })

  it('refuses a foreign URL: without a token, or with one of the wrong shape', () => {
    expect(extractPresentationToken('https://example.com/cardapio')).toBeNull()
    expect(extractPresentationToken('https://example.com/?token=promocao')).toBeNull()
    expect(extractPresentationToken(`https://example.com/?token=${'a'.repeat(80)}`)).toBeNull()
    // Only the query string counts, never a fragment.
    expect(extractPresentationToken(`https://example.com/#token=${TOKEN}`)).toBeNull()
  })

  it('refuses a scheme other than http(s), so a QR cannot pick what opens', () => {
    for (const scheme of ['javascript', 'file', 'intent', 'data', 'ftp']) {
      expect(extractPresentationToken(`${scheme}://x/?token=${TOKEN}`)).toBeNull()
    }
  })

  it('refuses arbitrary content instead of guessing', () => {
    for (const garbage of [
      '',
      '   ',
      'hello world',
      '{"token":"x"}',
      'WIFI:S:rede;T:WPA;P:senha;;',
      'BEGIN:VCARD',
      `${TOKEN}.extra`,
      `${'a'.repeat(20)}.${'b'.repeat(42)}`,
    ]) {
      expect(extractPresentationToken(garbage)).toBeNull()
    }
  })
})
