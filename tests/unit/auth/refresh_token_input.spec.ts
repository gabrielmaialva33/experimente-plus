import type { HttpRequest } from '@adonisjs/core/http'
import testUtils from '@adonisjs/core/services/test_utils'
import { test } from '@japa/runner'

import { refreshTokenFromRawBody } from '#modules/auth/utils/refresh_token_input'

type BodyType = 'json' | 'multipart' | 'raw' | 'unknown' | 'urlencoded'

async function createRequest(options: {
  bodyType: BodyType
  contentType: string
  rawBody?: string
}): Promise<HttpRequest> {
  const { request } = await testUtils.createHttpContext()
  request.bodyType = options.bodyType
  request.request.headers['content-type'] = options.contentType
  if (options.rawBody !== undefined) request.updateRawBody(options.rawBody)
  return request
}

test.group('Refresh token HTTP input', () => {
  const refreshToken = 'A'.repeat(43)

  test('reads the unmodified token from canonical JSON with media type parameters', async ({
    assert,
  }) => {
    const request = await createRequest({
      bodyType: 'json',
      contentType: 'Application/JSON; charset=utf-8',
      rawBody: JSON.stringify({ refresh_token: ` ${refreshToken} ` }),
    })

    assert.equal(refreshTokenFromRawBody(request), ` ${refreshToken} `)
  })

  test('rejects non-canonical JSON aliases and every non-JSON body type', async ({ assert }) => {
    const cases: Array<{ bodyType: BodyType; contentType: string; rawBody: string }> = [
      {
        bodyType: 'json',
        contentType: 'application/json-patch+json',
        rawBody: JSON.stringify({ refresh_token: refreshToken }),
      },
      {
        bodyType: 'json',
        contentType: 'application/vnd.api+json',
        rawBody: JSON.stringify({ refresh_token: refreshToken }),
      },
      {
        bodyType: 'json',
        contentType: 'application/csp-report',
        rawBody: JSON.stringify({ refresh_token: refreshToken }),
      },
      {
        bodyType: 'urlencoded',
        contentType: 'application/x-www-form-urlencoded',
        rawBody: `refresh_token=${refreshToken}`,
      },
      {
        bodyType: 'multipart',
        contentType: 'multipart/form-data; boundary=test',
        rawBody: refreshToken,
      },
      { bodyType: 'raw', contentType: 'text/plain', rawBody: refreshToken },
      { bodyType: 'unknown', contentType: 'application/octet-stream', rawBody: refreshToken },
    ]

    for (const input of cases) {
      const request = await createRequest(input)
      assert.isUndefined(refreshTokenFromRawBody(request))
    }
  })

  test('does not fall back to parsed input when raw JSON is absent or invalid', async ({
    assert,
  }) => {
    const noRawBody = await createRequest({
      bodyType: 'json',
      contentType: 'application/json',
    })
    const malformedJson = await createRequest({
      bodyType: 'json',
      contentType: 'application/json',
      rawBody: `{"refresh_token":"${refreshToken}"`,
    })

    assert.isUndefined(refreshTokenFromRawBody(noRawBody))
    assert.isUndefined(refreshTokenFromRawBody(malformedJson))
  })
})
