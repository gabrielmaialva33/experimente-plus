import { test } from '@japa/runner'

import { findApplicationSetCookies } from '#shared/utils/public_response_cookies'

const sessionCookie = 'experimente-plus-session=session-id; Path=/; HttpOnly'
const csrfCookie = 'XSRF-TOKEN=csrf-token; Path=/; SameSite=Lax'
const currentSessionId = '6d5c4d15-cb47-4f06-928f-5fbe099b2463'
const currentSessionDataCookie = `${currentSessionId}=encrypted-data; Path=/; HttpOnly`

test.group('Public response cookie policy', () => {
  test('removes only the session and CSRF cookies for a non-cookie store', ({ assert }) => {
    const applicationCookies = findApplicationSetCookies([sessionCookie, csrfCookie], {
      session: 'experimente-plus-session',
      csrf: 'XSRF-TOKEN',
    })

    assert.deepEqual(applicationCookies, [])
  })

  test('recognizes the cookie store data cookie by the current session id', ({ assert }) => {
    const applicationCookies = findApplicationSetCookies(
      [sessionCookie, csrfCookie, currentSessionDataCookie],
      {
        session: 'experimente-plus-session',
        csrf: 'XSRF-TOKEN',
        sessionData: currentSessionId,
      }
    )

    assert.deepEqual(applicationCookies, [])
  })

  test('preserves an unrelated UUID cookie instead of treating it as session data', ({
    assert,
  }) => {
    const unrelatedUuidCookie =
      'f88c68d1-aad2-40bb-b619-402a7c1f5521=application-data; Path=/; HttpOnly'
    const applicationCookies = findApplicationSetCookies(
      [sessionCookie, csrfCookie, currentSessionDataCookie, unrelatedUuidCookie],
      {
        session: 'experimente-plus-session',
        csrf: 'XSRF-TOKEN',
        sessionData: currentSessionId,
      }
    )

    assert.deepEqual(applicationCookies, [unrelatedUuidCookie])
  })

  test('compares technical cookie names exactly', ({ assert }) => {
    const similarlyNamedCookie = 'experimente-plus-session-extra=value; Path=/'
    const applicationCookies = findApplicationSetCookies(
      [sessionCookie, csrfCookie, similarlyNamedCookie],
      {
        session: 'experimente-plus-session',
        csrf: 'XSRF-TOKEN',
      }
    )

    assert.deepEqual(applicationCookies, [similarlyNamedCookie])
  })
})
