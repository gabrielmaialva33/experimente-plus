type SetCookieHeader = string | number | string[]

type InfrastructureCookieNames = {
  session: string
  csrf: string
  sessionData?: string
}

function getCookieName(setCookie: string): string | null {
  const separatorIndex = setCookie.indexOf('=')
  if (separatorIndex <= 0) {
    return null
  }

  const name = setCookie.slice(0, separatorIndex).trim()
  return name.length > 0 ? name : null
}

/**
 * Returns Set-Cookie lines that do not belong to the request's session/CSRF
 * infrastructure. Cookie names are compared exactly: an arbitrary UUID must
 * never be treated as session data just because it looks like a session id.
 */
export function findApplicationSetCookies(
  setCookie: SetCookieHeader,
  infrastructure: InfrastructureCookieNames
): string[] {
  const infrastructureNames = new Set(
    [infrastructure.session, infrastructure.csrf, infrastructure.sessionData].filter(
      (name): name is string => typeof name === 'string' && name.length > 0
    )
  )

  return (Array.isArray(setCookie) ? setCookie : [setCookie]).map(String).filter((cookie) => {
    const cookieName = getCookieName(cookie)
    return cookieName === null || !infrastructureNames.has(cookieName)
  })
}
