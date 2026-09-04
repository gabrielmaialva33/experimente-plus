import { test } from '@japa/runner'

import {
  APP_URL_KEY,
  assertBenefitPresentationOriginConfiguration,
  BENEFIT_PRESENTATION_BASE_URL_KEY,
  normalizeHttpOrigin,
  resolveBenefitPresentationOrigin,
} from '#shared/utils/benefit_presentation_origin'

test.group('Benefit presentation origin', () => {
  test('normalizes a configured HTTP(S) origin and gives it precedence', ({ assert }) => {
    assert.equal(
      normalizeHttpOrigin(
        '  HTTPS://Benefits.Example.COM:443/  ',
        BENEFIT_PRESENTATION_BASE_URL_KEY
      ),
      'https://benefits.example.com'
    )
    assert.equal(
      normalizeHttpOrigin('http://localhost:3333/', BENEFIT_PRESENTATION_BASE_URL_KEY),
      'http://localhost:3333'
    )
    assert.equal(
      resolveBenefitPresentationOrigin({
        environment: 'production',
        configuredBaseUrl: 'https://app.experimente.example/',
        appUrl: 'https://fallback.example',
        requestOrigin: 'http://attacker.example',
      }),
      'https://app.experimente.example'
    )
  })

  test('uses the trusted request origin only outside production', ({ assert }) => {
    assert.equal(
      resolveBenefitPresentationOrigin({
        environment: 'development',
        requestOrigin: 'https://tenant.experimente.example',
      }),
      'https://tenant.experimente.example'
    )
    assert.equal(
      resolveBenefitPresentationOrigin({
        environment: 'test',
        configuredBaseUrl: '',
        appUrl: 'https://ignored-in-test.example',
        requestOrigin: 'http://localhost:3333/',
      }),
      'http://localhost:3333'
    )
  })

  test('falls back to the canonical APP_URL in production and ignores the request host', ({
    assert,
  }) => {
    assert.equal(
      resolveBenefitPresentationOrigin({
        environment: 'production',
        appUrl: 'HTTPS://Experimente.Example:443/',
        requestOrigin: 'https://attacker.example',
      }),
      'https://experimente.example'
    )
  })

  test('rejects missing or ambiguous production fallback during configuration validation', ({
    assert,
  }) => {
    assert.throws(
      () =>
        assertBenefitPresentationOriginConfiguration({
          environment: 'production',
        }),
      new RegExp(`${APP_URL_KEY}.*production`)
    )

    for (const appUrl of [
      'ftp://experimente.example',
      'https://user@experimente.example',
      'https://experimente.example/app',
      'https://experimente.example?operation=1',
    ]) {
      assert.throws(
        () =>
          assertBenefitPresentationOriginConfiguration({
            environment: 'production',
            appUrl,
          }),
        new RegExp(APP_URL_KEY)
      )
    }
  })

  test('rejects anything other than an unambiguous absolute HTTP(S) origin', ({ assert }) => {
    const invalidValues = [
      '',
      '/portal/redemptions/validate',
      'ftp://benefits.example.com',
      'https://user@benefits.example.com',
      'https://user:secret@benefits.example.com',
      'https://benefits.example.com/path',
      'https://benefits.example.com/foo/..',
      'https://benefits.example.com?tenant=1',
      'https://benefits.example.com?',
      'https://benefits.example.com#validation',
      'https://benefits.example.com#',
      'https://benefits.example.com\\unexpected',
    ]

    for (const value of invalidValues) {
      assert.throws(
        () => normalizeHttpOrigin(value, BENEFIT_PRESENTATION_BASE_URL_KEY),
        /BENEFIT_PRESENTATION_BASE_URL/
      )
    }
  })
})
