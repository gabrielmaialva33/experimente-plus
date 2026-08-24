import { createHash } from 'node:crypto'

import logger from '@adonisjs/core/services/logger'
import redis from '@adonisjs/redis/services/main'

export default class CatalogCacheService {
  private readonly prefix = 'catalog:v1'

  key(parts: Array<string | number | boolean | null | undefined>): string {
    const serialized = JSON.stringify(parts)
    const digest = createHash('sha256').update(serialized).digest('hex').slice(0, 32)
    return `${this.prefix}:${digest}`
  }

  async remember<T>(key: string, ttlSeconds: number, factory: () => Promise<T>): Promise<T> {
    try {
      const cached = await redis.get(key)
      if (cached) {
        return JSON.parse(cached) as T
      }
    } catch (error) {
      logger.warn({ err: error, cache_key: key }, 'Catalog cache read failed; using PostgreSQL')
    }

    const value = await factory()

    try {
      await redis.setex(key, ttlSeconds, JSON.stringify(value))
    } catch (error) {
      logger.warn(
        { err: error, cache_key: key },
        'Catalog cache write failed; response remains valid'
      )
    }

    return value
  }
}
