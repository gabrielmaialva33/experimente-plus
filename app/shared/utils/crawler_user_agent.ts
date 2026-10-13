/**
 * Tokens that only automated clients put in their user agent. The list is
 * deliberately conservative: no browser a person uses (Chrome on Android,
 * Safari on iOS, desktop Chrome, Firefox, Edge, in-app browsers) and not the
 * Experimente+ app (okhttp on Android, CFNetwork on iOS) carries any of them.
 */
const CRAWLER_TOKENS = [
  // Generic self-descriptions. "Cubot" is an Android phone brand, not a bot.
  '(?<!cu)bot(?:\\b|_)',
  'crawl',
  'spider',
  'slurp',
  // AI assistants and their search crawlers.
  'chatgpt-user',
  'claude-web',
  'claude-user',
  'anthropic-ai',
  'perplexity-user',
  // Search engines, previews and data collectors without "bot" in the name.
  'google-extended',
  'googleother',
  'google-inspectiontool',
  'mediapartners-google',
  'facebookexternalhit',
  'meta-externalagent',
  'meta-externalfetcher',
  'ia_archiver',
  // Headless browsers, command-line tools and HTTP libraries.
  'headlesschrome',
  '\\bcurl/',
  '\\bwget/',
  'python-requests',
  'python-urllib',
  'python-httpx',
  'aiohttp',
  'scrapy',
  'go-http-client',
  '\\baxios/',
  'node-fetch',
  'apache-httpclient',
  'libwww-perl',
]

const CRAWLER_USER_AGENT = new RegExp(CRAWLER_TOKENS.join('|'), 'i')

/**
 * Whether a request comes from a known crawler, scraper or HTTP library. A
 * missing user agent is not treated as one: the filter only drops traffic that
 * names itself. Anyone can forge a user agent, so this keeps automated visits
 * out of metrics; it is not an access control.
 */
export function isCrawlerUserAgent(userAgent: string | null | undefined): boolean {
  const value = userAgent?.trim()
  if (!value) return false

  return CRAWLER_USER_AGENT.test(value)
}
