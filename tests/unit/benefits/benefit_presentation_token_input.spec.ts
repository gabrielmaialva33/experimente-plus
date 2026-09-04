import testUtils from '@adonisjs/core/services/test_utils'
import type { HttpRequest } from '@adonisjs/core/http'
import { test } from '@japa/runner'

import { validateBenefitPresentationTokenInput } from '#modules/benefits/utils/benefit_presentation_token_input'

type BodyType = 'json' | 'multipart' | 'raw' | 'unknown' | 'urlencoded'

async function createRequest(options: {
  body: Record<string, unknown>
  bodyType: BodyType
  contentType?: string
  rawBody?: string
}): Promise<HttpRequest> {
  const { request } = await testUtils.createHttpContext()
  request.bodyType = options.bodyType
  request.request.headers['content-type'] =
    options.contentType ??
    {
      json: 'application/json',
      multipart: 'multipart/form-data; boundary=test',
      raw: 'text/plain',
      unknown: 'application/octet-stream',
      urlencoded: 'application/x-www-form-urlencoded',
    }[options.bodyType]
  request.updateBody(options.body)
  if (options.rawBody !== undefined) {
    request.updateRawBody(options.rawBody)
  }
  return request
}

async function captureFailure(callback: () => Promise<unknown>): Promise<unknown> {
  try {
    await callback()
    return null
  } catch (error) {
    return error
  }
}

function assertValidationRule(
  assert: { deepInclude(actual: unknown, expected: unknown): void },
  failure: unknown,
  rule: string
): void {
  assert.deepInclude((failure as { messages?: unknown[] }).messages?.[0], {
    field: 'token',
    rule,
  })
}

test.group('Benefit presentation token HTTP input', () => {
  const canonicalToken = `AQ.${'A'.repeat(43)}`

  test('reads JSON wire data and bounds it before whitespace normalization', async ({ assert }) => {
    const paddedToken = ` ${canonicalToken} `
    const paddedRequest = await createRequest({
      bodyType: 'json',
      contentType: 'application/json; charset=utf-8',
      body: { token: canonicalToken },
      rawBody: JSON.stringify({ token: paddedToken }),
    })

    assert.deepEqual(await validateBenefitPresentationTokenInput(paddedRequest, ['json']), {
      token: canonicalToken,
    })

    const oversizedToken = `${' '.repeat(513 - canonicalToken.length)}${canonicalToken}`
    const oversizedRequest = await createRequest({
      bodyType: 'json',
      body: { token: canonicalToken },
      rawBody: JSON.stringify({ token: oversizedToken }),
    })
    const failure = await captureFailure(() =>
      validateBenefitPresentationTokenInput(oversizedRequest, ['json'])
    )

    assertValidationRule(assert, failure, 'maxLength')
  })

  test('maps empty, non-object, and absent raw JSON to required', async ({ assert }) => {
    for (const rawBody of ['', JSON.stringify([canonicalToken])]) {
      const request = await createRequest({ bodyType: 'json', body: {}, rawBody })
      const failure = await captureFailure(() =>
        validateBenefitPresentationTokenInput(request, ['json'])
      )
      assertValidationRule(assert, failure, 'required')
    }

    const noRawFallback = await createRequest({
      bodyType: 'json',
      body: { token: canonicalToken },
    })
    const noRawFailure = await captureFailure(() =>
      validateBenefitPresentationTokenInput(noRawFallback, ['json'])
    )
    assertValidationRule(assert, noRawFailure, 'required')
  })

  test('accepts one raw form token and rejects duplicate or nested token structures', async ({
    assert,
  }) => {
    const paddedToken = ` ${canonicalToken} `
    const request = await createRequest({
      bodyType: 'urlencoded',
      contentType: 'application/x-www-form-urlencoded; charset=utf-8',
      body: { token: canonicalToken },
      rawBody: `token=${encodeURIComponent(paddedToken)}`,
    })
    assert.deepEqual(await validateBenefitPresentationTokenInput(request, ['json', 'urlencoded']), {
      token: canonicalToken,
    })

    for (const rawBody of [
      `token=${canonicalToken}&token=${canonicalToken}`,
      `token=${canonicalToken}&token%5B%5D=${canonicalToken}`,
      `token=${canonicalToken}&token%5Bnested%5D=${canonicalToken}`,
    ]) {
      const collision = await createRequest({
        bodyType: 'urlencoded',
        body: { token: canonicalToken },
        rawBody,
      })
      const failure = await captureFailure(() =>
        validateBenefitPresentationTokenInput(collision, ['json', 'urlencoded'])
      )
      assertValidationRule(assert, failure, 'string')
    }
  })

  test('rejects every non-JSON body type at the API boundary', async ({ assert }) => {
    for (const bodyType of ['urlencoded', 'multipart', 'raw', 'unknown'] as const) {
      const request = await createRequest({
        bodyType,
        body: { token: canonicalToken },
        rawBody: `token=${encodeURIComponent(canonicalToken)}`,
      })
      const failure = await captureFailure(() =>
        validateBenefitPresentationTokenInput(request, ['json'])
      )
      assertValidationRule(assert, failure, 'required')
    }
  })

  test('rejects configured JSON-family aliases that are not application/json', async ({
    assert,
  }) => {
    for (const contentType of [
      'application/json-patch+json',
      'application/vnd.api+json',
      'application/csp-report',
    ]) {
      const request = await createRequest({
        bodyType: 'json',
        contentType,
        body: { token: canonicalToken },
        rawBody: JSON.stringify({ token: canonicalToken }),
      })
      const failure = await captureFailure(() =>
        validateBenefitPresentationTokenInput(request, ['json'])
      )
      assertValidationRule(assert, failure, 'required')
    }
  })
})
