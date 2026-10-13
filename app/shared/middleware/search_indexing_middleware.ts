import type { HttpContext } from '@adonisjs/core/http'
import type { NextFn } from '@adonisjs/core/types/http'

import { NOINDEX_ROBOTS_TAG, searchIndexingAllowed } from '#shared/utils/search_indexing'
import env from '#start/env'

/**
 * Outside production every response, static files and error pages included,
 * tells search engines not to index it nor follow its links: `robots.txt`
 * asks crawlers to stay away, this keeps anything they reach anyway out of
 * search results. It runs before the static middleware, which copies the
 * headers already set onto the files it serves.
 */
export default class SearchIndexingMiddleware {
  handle({ response }: HttpContext, next: NextFn) {
    if (!searchIndexingAllowed(env.get('DEPLOYMENT_ENV'))) {
      response.header('X-Robots-Tag', NOINDEX_ROBOTS_TAG)
    }

    return next()
  }
}
