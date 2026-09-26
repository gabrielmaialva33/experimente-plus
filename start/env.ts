/*
|--------------------------------------------------------------------------
| Environment variables service
|--------------------------------------------------------------------------
|
| The `Env.create` method creates an instance of the Env service. The
| service validates the environment variables and also cast values
| to JavaScript data types.
|
*/

import { Env } from '@adonisjs/core/env'
import { deploymentEnvironment } from '#shared/utils/deployment_environment'

import {
  assertBenefitPresentationOriginConfiguration,
  BENEFIT_PRESENTATION_BASE_URL_KEY,
  normalizeHttpOrigin,
} from '#shared/utils/benefit_presentation_origin'

function benefitPresentationBaseUrl(key: string, value?: string): string | undefined {
  if (!value) return undefined

  try {
    return normalizeHttpOrigin(value, BENEFIT_PRESENTATION_BASE_URL_KEY)
  } catch (error) {
    throw new Error(
      error instanceof Error ? error.message : `Invalid environment variable "${key}"`
    )
  }
}

const env = await Env.create(new URL('../', import.meta.url), {
  NODE_ENV: Env.schema.enum(['development', 'production', 'test'] as const),
  DEPLOYMENT_ENV: (_key: string, value?: string) => deploymentEnvironment(value),
  PORT: Env.schema.number(),
  HOST: Env.schema.string({ format: 'host' }),
  LOG_LEVEL: Env.schema.string(),
  APP_LOCALE: Env.schema.enum.optional(['en', 'pt'] as const),

  APP_NAME: Env.schema.string.optional(),
  APP_URL: Env.schema.string.optional(),
  APP_SOURCE_URL: Env.schema.string.optional(),
  BENEFIT_PRESENTATION_BASE_URL: benefitPresentationBaseUrl,
  TRUST_PROXY: Env.schema.string.optional(),
  PUBLIC_TENANT_SLUG: Env.schema.string.optional(),
  APP_KEY: Env.schema.string(),
  ACCESS_TOKEN_SECRET: Env.schema.string.optional(),
  REFRESH_TOKEN_SECRET: Env.schema.string.optional(),
  EMAIL_VERIFICATION_SECRET: Env.schema.string.optional(),
  PASSWORD_RESET_SECRET: Env.schema.string.optional(),
  PASSWORD_RESET_TTL_MINUTES: Env.schema.number.optional(),
  JWT_ISSUER: Env.schema.string.optional(),
  JWT_AUDIENCE: Env.schema.string.optional(),
  JWT_COOKIE_NAME: Env.schema.string.optional(),
  SESSION_COOKIE_NAME: Env.schema.string.optional(),
  REGISTRATION_WORKSPACE_MODE: Env.schema.enum.optional(['none', 'personal', 'operation'] as const),
  ORGANIZATION_INVITATION_SECRET: Env.schema.string.optional(),
  ORGANIZATION_INVITATION_TTL_HOURS: Env.schema.number.optional(),
  ANALYTICS_HASH_SECRET: Env.schema.string(),
  ANALYTICS_RAW_RETENTION_DAYS: Env.schema.number.optional(),
  ANALYTICS_AGGREGATE_RETENTION_MONTHS: Env.schema.number.optional(),
  ANALYTICS_SESSION_COOKIE_DAYS: Env.schema.number.optional(),
  DEMO_PAGES_ENABLED: Env.schema.boolean.optional(),

  PAYMENT_PROVIDER: Env.schema.enum.optional([
    'disabled',
    'fake',
    'mercado_pago',
    'stripe',
  ] as const),
  PAYMENT_METHODS: Env.schema.enum.optional(['none', 'pix', 'card', 'pix,card'] as const),
  PAYMENT_ENVIRONMENT: Env.schema.enum.optional(['test', 'live'] as const),
  PURCHASE_AUTO_REFUND_UNUSED: Env.schema.boolean.optional(),
  PURCHASE_QUOTE_MINUTES: Env.schema.number.optional(),
  MERCADO_PAGO_ACCOUNT_ID: Env.schema.string.optional(),
  MERCADO_PAGO_ACCESS_TOKEN: Env.schema.string.optional(),
  MERCADO_PAGO_WEBHOOK_SECRET: Env.schema.string.optional(),
  STRIPE_ACCOUNT_ID: Env.schema.string.optional(),
  STRIPE_PUBLISHABLE_KEY: Env.schema.string.optional(),
  STRIPE_SECRET_KEY: Env.schema.string.optional(),
  STRIPE_RESTRICTED_KEY: Env.schema.string.optional(),
  STRIPE_ENVIRONMENT: Env.schema.enum.optional(['test', 'live'] as const),
  STRIPE_WEBHOOK_SECRET: Env.schema.string.optional(),

  /*
  |----------------------------------------------------------
  | Concierge IA — ADR-0029
  |----------------------------------------------------------
  | Provider and models are configuration, never constants: the instrument
  | treats a later change of model or provider as a new contract, and a model
  | the catalogue lists can still answer 404.
  */
  CONCIERGE_ENABLED: Env.schema.boolean.optional(),
  CONCIERGE_BASE_URL: Env.schema.string.optional(),
  CONCIERGE_PRIMARY_MODEL: Env.schema.string.optional(),
  CONCIERGE_FALLBACK_MODEL: Env.schema.string.optional(),
  CONCIERGE_TIMEOUT_MS: Env.schema.number.optional(),
  CONCIERGE_MAX_OUTPUT_TOKENS: Env.schema.number.optional(),
  NVIDIA_API_KEY: Env.schema.string.optional(),

  DEV_ADMIN_NAME: Env.schema.string.optional(),
  DEV_ADMIN_USERNAME: Env.schema.string.optional(),
  DEV_ADMIN_EMAIL: Env.schema.string.optional(),
  DEV_ADMIN_PASSWORD: Env.schema.string.optional(),
  DEV_WORKSPACE_NAME: Env.schema.string.optional(),

  /*
  |----------------------------------------------------------
  | Variables for configuring session package
  |----------------------------------------------------------
  */
  SESSION_DRIVER: Env.schema.enum(['cookie', 'memory'] as const),

  /*
  |----------------------------------------------------------
  | Variables for configuring the limiter package
  |----------------------------------------------------------
  */
  LIMITER_STORE: Env.schema.enum(['redis', 'database', 'memory'] as const),

  /*
  |----------------------------------------------------------
  | Variables for configuring the drive package
  |----------------------------------------------------------
  */
  DRIVE_DISK: Env.schema.enum(['fs', 's3', 'spaces', 'r2', 'gcs'] as const),

  /*
  |----------------------------------------------------------
  | Variables for configuring database connection
  |----------------------------------------------------------
  */
  DB_CONNECTION: Env.schema.enum.optional(['postgres', 'sqlite'] as const),
  DB_HOST: Env.schema.string.optional({ format: 'host' }),
  DB_PORT: Env.schema.number.optional(),
  DB_USER: Env.schema.string.optional(),
  DB_PASSWORD: Env.schema.string.optional(),
  DB_DATABASE: Env.schema.string.optional(),
  /*
  |----------------------------------------------------------
  | Variables for configuring the cache package
  |----------------------------------------------------------
  */
  REDIS_HOST: Env.schema.string.optional({ format: 'host' }),
  REDIS_PORT: Env.schema.number.optional(),
  REDIS_PASSWORD: Env.schema.string.optional(),
  REDIS_DB: Env.schema.number.optional(),
  // S3
  AWS_ACCESS_KEY_ID: Env.schema.string.optional(),
  AWS_SECRET_ACCESS_KEY: Env.schema.string.optional(),
  AWS_REGION: Env.schema.string.optional(),
  S3_BUCKET: Env.schema.string.optional(),

  // Spaces
  SPACES_KEY: Env.schema.string.optional(),
  SPACES_SECRET: Env.schema.string.optional(),
  SPACES_REGION: Env.schema.string.optional(),
  SPACES_BUCKET: Env.schema.string.optional(),
  SPACES_ENDPOINT: Env.schema.string.optional(),

  // R2
  R2_KEY: Env.schema.string.optional(),
  R2_SECRET: Env.schema.string.optional(),
  R2_BUCKET: Env.schema.string.optional(),
  R2_ENDPOINT: Env.schema.string.optional(),
  R2_PUBLIC_BASE_URL: Env.schema.string.optional(),

  // GCS
  GCS_KEY: Env.schema.string.optional(),
  GCS_BUCKET: Env.schema.string.optional(),

  /*
  |----------------------------------------------------------
  | Variables for configuring the mail package
  |----------------------------------------------------------
  */
  MAIL_MAILER: Env.schema.enum(['smtp', 'mailgun'] as const),
  MAIL_FROM_ADDRESS: Env.schema.string.optional(),
  MAIL_FROM_NAME: Env.schema.string.optional(),

  // SMTP Configuration
  SMTP_HOST: Env.schema.string.optional(),
  SMTP_PORT: Env.schema.number.optional(),
  SMTP_USER: Env.schema.string.optional(),
  SMTP_PASS: Env.schema.string.optional(),

  // Mailgun Configuration
  MAILGUN_API_KEY: Env.schema.string.optional(),
  MAILGUN_DOMAIN: Env.schema.string.optional(),
  MAILGUN_BASE_URL: Env.schema.string.optional(),
})

assertBenefitPresentationOriginConfiguration({
  environment: env.get('DEPLOYMENT_ENV'),
  configuredBaseUrl: env.get('BENEFIT_PRESENTATION_BASE_URL'),
  appUrl: env.get('APP_URL'),
})

if (
  deploymentEnvironment(env.get('DEPLOYMENT_ENV')) === 'production' &&
  env.get('PAYMENT_PROVIDER') === 'fake'
) {
  throw new Error('Fake payments are forbidden in production')
}

if (env.get('DRIVE_DISK') === 'r2') {
  const publicBase = env.get('R2_PUBLIC_BASE_URL')
  let validBase = false
  try {
    const url = new URL(publicBase ?? '')
    validBase =
      url.protocol === 'https:' && !url.username && !url.password && !url.search && !url.hash
  } catch {
    /* Fail without printing environment values. */
  }
  if (
    !validBase ||
    !env.get('R2_KEY') ||
    !env.get('R2_SECRET') ||
    !env.get('R2_BUCKET') ||
    !env.get('R2_ENDPOINT')
  )
    throw new Error('R2 requires credentials, an endpoint and an HTTPS public base URL')
}

export default env
