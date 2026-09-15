import { defineConfig } from '@adonisjs/redis'
import { type InferConnections } from '@adonisjs/redis/types'
import env from '#start/env'

const redisConfig = defineConfig({
  connection: 'main',

  connections: {
    /*
    |--------------------------------------------------------------------------
    | The default connection
    |--------------------------------------------------------------------------
    |
    | The main connection you want to use to execute redis commands. The same
    | connection will be used by the session provider, if you rely on the
    | redis driver.
    |
    */
    main: {
      host: env.get('REDIS_HOST'),
      port: env.get('REDIS_PORT'),
      password: env.get('REDIS_PASSWORD') || undefined,
      db: env.get('REDIS_DB', 0),
      keyPrefix: '',
      /*
      |------------------------------------------------------------------------
      | Reconnection must never give up
      |------------------------------------------------------------------------
      |
      | Returning null here tells ioredis to stop reconnecting for good. With
      | ten attempts of a few dozen milliseconds, the client surrendered in
      | under three seconds and the process stayed dead until someone restarted
      | it by hand — which is exactly what happened on 15/09/2026, when the
      | Redis this deployment shares with another service was recreated and
      | every rate-limited route answered 500 for the best part of an hour.
      |
      | Backoff grows to a five second ceiling and then keeps trying, so the
      | same event costs seconds instead of an outage nobody is paged about.
      */
      retryStrategy(times) {
        return Math.min(times * 200, 5000)
      },
      /*
      | A command must not hang forever while the client reconnects: failing a
      | request quickly is recoverable, a stuck request is not.
      */
      maxRetriesPerRequest: 3,
    },
  },
})

export default redisConfig

declare module '@adonisjs/redis/types' {
  export interface RedisConnections extends InferConnections<typeof redisConfig> {}
}
