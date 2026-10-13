import { test } from '@japa/runner'

import { isCrawlerUserAgent } from '#shared/utils/crawler_user_agent'

/** What people and the Experimente+ app actually send. None may ever be filtered. */
const PEOPLE = {
  'Chrome on Android':
    'Mozilla/5.0 (Linux; Android 10; K) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/129.0.0.0 Mobile Safari/537.36',
  'Chrome on a Cubot phone':
    'Mozilla/5.0 (Linux; Android 12; CUBOT P60) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/128.0.6613.127 Mobile Safari/537.36',
  'Samsung Internet':
    'Mozilla/5.0 (Linux; Android 14; SM-S921B) AppleWebKit/537.36 (KHTML, like Gecko) SamsungBrowser/26.0 Chrome/122.0.0.0 Mobile Safari/537.36',
  'Safari on iOS':
    'Mozilla/5.0 (iPhone; CPU iPhone OS 18_0 like Mac OS X) AppleWebKit/605.1.15 (KHTML, like Gecko) Version/18.0 Mobile/15E148 Safari/604.1',
  'Chrome on iOS':
    'Mozilla/5.0 (iPhone; CPU iPhone OS 17_6 like Mac OS X) AppleWebKit/605.1.15 (KHTML, like Gecko) CriOS/129.0.6668.69 Mobile/15E148 Safari/604.1',
  'Chrome on Windows':
    'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/129.0.0.0 Safari/537.36',
  'Safari on macOS':
    'Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/605.1.15 (KHTML, like Gecko) Version/18.0 Safari/605.1.15',
  'Firefox on Linux': 'Mozilla/5.0 (X11; Linux x86_64; rv:131.0) Gecko/20100101 Firefox/131.0',
  'Firefox on Android': 'Mozilla/5.0 (Android 14; Mobile; rv:131.0) Gecko/131.0 Firefox/131.0',
  'Edge on Windows':
    'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/129.0.0.0 Safari/537.36 Edg/129.0.0.0',
  'Instagram in-app browser':
    'Mozilla/5.0 (Linux; Android 13; SM-A536B Build/TP1A.220624.014; wv) AppleWebKit/537.36 (KHTML, like Gecko) Version/4.0 Chrome/129.0.6668.81 Mobile Safari/537.36 Instagram 350.0.0.42.79 Android',
  'Facebook in-app browser':
    'Mozilla/5.0 (iPhone; CPU iPhone OS 17_6 like Mac OS X) AppleWebKit/605.1.15 (KHTML, like Gecko) Mobile/15E148 [FBAN/FBIOS;FBAV/482.0.0.39.104;FBBV/650000000;FBDV/iPhone15,2;FBMD/iPhone;FBSN/iOS;FBSV/17.6;FBSS/3;FBID/phone;FBLC/pt_BR;FBOP/5]',
  'Experimente+ app on Android (okhttp)': 'okhttp/4.12.0',
  'Experimente+ app on iOS': 'ExperimentePlus/1 CFNetwork/1568.100.1 Darwin/24.0.0',
  'Expo Go on iOS': 'Expo/2.32.10 CFNetwork/1568.100.1 Darwin/24.0.0',
}

/** Crawlers and automated clients as they introduce themselves. */
const CRAWLERS = {
  'GPTBot':
    'Mozilla/5.0 AppleWebKit/537.36 (KHTML, like Gecko); compatible; GPTBot/1.2; +https://openai.com/gptbot',
  'ChatGPT-User':
    'Mozilla/5.0 AppleWebKit/537.36 (KHTML, like Gecko); compatible; ChatGPT-User/1.0; +https://openai.com/bot',
  'OAI-SearchBot':
    'Mozilla/5.0 AppleWebKit/537.36 (KHTML, like Gecko); compatible; OAI-SearchBot/1.0; +https://openai.com/searchbot',
  'ClaudeBot':
    'Mozilla/5.0 AppleWebKit/537.36 (KHTML, like Gecko; compatible; ClaudeBot/1.0; +claudebot@anthropic.com)',
  'Claude-Web': 'Claude-Web/1.0 (web-crawler; +https://www.anthropic.com/)',
  'Claude-User': 'Mozilla/5.0 (compatible; Claude-User/1.0; +Claude-User@anthropic.com)',
  'anthropic-ai': 'anthropic-ai',
  'PerplexityBot':
    'Mozilla/5.0 AppleWebKit/537.36 (KHTML, like Gecko; compatible; PerplexityBot/1.0; +https://perplexity.ai/perplexitybot)',
  'Perplexity-User':
    'Mozilla/5.0 AppleWebKit/537.36 (KHTML, like Gecko; compatible; Perplexity-User/1.0; +https://perplexity.ai/perplexity-user)',
  'Google-Extended': 'Google-Extended',
  'Googlebot smartphone':
    'Mozilla/5.0 (Linux; Android 6.0.1; Nexus 5X Build/MMB29P) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/129.0.6668.70 Mobile Safari/537.36 (compatible; Googlebot/2.1; +http://www.google.com/bot.html)',
  'GoogleOther': 'GoogleOther',
  'Google-InspectionTool': 'Mozilla/5.0 (compatible; Google-InspectionTool/1.0;)',
  'bingbot':
    'Mozilla/5.0 AppleWebKit/537.36 (KHTML, like Gecko; compatible; bingbot/2.0; +http://www.bing.com/bingbot.htm) Chrome/116.0.1938.76 Safari/537.36',
  'Applebot':
    'Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_5) AppleWebKit/605.1.15 (KHTML, like Gecko) Version/13.1.1 Safari/605.1.15 (Applebot/0.1; +http://www.apple.com/go/applebot)',
  'YandexBot': 'Mozilla/5.0 (compatible; YandexBot/3.0; +http://yandex.com/bots)',
  'DuckDuckBot': 'DuckDuckBot/1.1; (+http://duckduckgo.com/duckduckbot.html)',
  'Baiduspider':
    'Mozilla/5.0 (compatible; Baiduspider/2.0; +http://www.baidu.com/search/spider.html)',
  'Yahoo Slurp':
    'Mozilla/5.0 (compatible; Yahoo! Slurp; http://help.yahoo.com/help/us/ysearch/slurp)',
  'facebookexternalhit':
    'facebookexternalhit/1.1 (+http://www.facebook.com/externalhit_uatext.php)',
  'meta-externalagent':
    'meta-externalagent/1.1 (+https://developers.facebook.com/docs/sharing/webmasters/crawler)',
  'Bytespider':
    'Mozilla/5.0 (Linux; Android 5.0) AppleWebKit/537.36 (KHTML, like Gecko) Mobile Safari/537.36 (compatible; Bytespider; spider-feedback@bytedance.com)',
  'AhrefsBot': 'Mozilla/5.0 (compatible; AhrefsBot/7.0; +http://ahrefs.com/robot/)',
  'SemrushBot': 'Mozilla/5.0 (compatible; SemrushBot/7~bl; +http://www.semrush.com/bot.html)',
  'MJ12bot': 'Mozilla/5.0 (compatible; MJ12bot/v1.4.8; http://mj12bot.com/)',
  'DotBot':
    'Mozilla/5.0 (compatible; DotBot/1.2; +https://opensiteexplorer.org/dotbot; help@moz.com)',
  'PetalBot':
    'Mozilla/5.0 (Linux; Android 7.0;) AppleWebKit/537.36 (KHTML, like Gecko) Mobile Safari/537.36 (compatible; PetalBot;+https://webmaster.petalsearch.com/site/petalbot)',
  'CCBot': 'CCBot/2.0 (https://commoncrawl.org/faq/)',
  'a generic crawler': 'Mozilla/5.0 (compatible; ExampleCrawler/2.1)',
  'HeadlessChrome':
    'Mozilla/5.0 (X11; Linux x86_64) AppleWebKit/537.36 (KHTML, like Gecko) HeadlessChrome/129.0.0.0 Safari/537.36',
  'curl': 'curl/8.10.1',
  'wget': 'Wget/1.24.5',
  'python-requests': 'python-requests/2.32.3',
  'Go-http-client': 'Go-http-client/1.1',
  'axios': 'axios/1.7.7',
  'Scrapy': 'Scrapy/2.11.2 (+https://scrapy.org)',
}

test.group('Crawler user agents', () => {
  test('never matches a person in a browser or the Experimente+ app', ({ assert }) => {
    for (const [name, userAgent] of Object.entries(PEOPLE)) {
      assert.isFalse(isCrawlerUserAgent(userAgent), name)
    }
  })

  test('matches named and generic crawlers, headless browsers and HTTP libraries', ({ assert }) => {
    for (const [name, userAgent] of Object.entries(CRAWLERS)) {
      assert.isTrue(isCrawlerUserAgent(userAgent), name)
      assert.isTrue(isCrawlerUserAgent(userAgent.toUpperCase()), `${name} in capitals`)
    }
  })

  test('does not treat a missing or blank user agent as a crawler', ({ assert }) => {
    for (const userAgent of [undefined, null, '', '   ']) {
      assert.isFalse(isCrawlerUserAgent(userAgent))
    }
  })
})
