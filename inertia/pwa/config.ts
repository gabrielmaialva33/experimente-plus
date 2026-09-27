/**
 * Kill switch for the service worker. With `false`, the next build ships a
 * `/sw.js` that deletes its caches and unregisters itself as soon as a browser
 * checks for updates, and every page that loads also unregisters it. Keep the
 * tombstone deployed for a while: a browser only learns about it on a visit.
 */
export const SERVICE_WORKER_ENABLED = true

/** Served from the site root so its scope covers every page. */
export const SERVICE_WORKER_URL = '/sw.js'
