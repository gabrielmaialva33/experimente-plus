import NvidiaProvider from '#modules/concierge/adapters/nvidia_provider'
import type IConcierge from '#modules/concierge/interfaces/concierge_interface'
import env from '#start/env'

/**
 * The model provider as the deployment configured it — ADR-0029 §5.
 *
 * Provider, models and key are infrastructure: they live in the environment,
 * change without a release, and are never shown or edited on a screen. This is
 * the one place that reads them, so the service asks "is there a provider"
 * instead of reading variables, and a test can swap the provider in the
 * container to prove when a model is — and is not — called.
 */
export default class ConciergeProviderFactory {
  /** Null when the deployment switched the assistant off or left it unconfigured. */
  make(): IConcierge.Provider | null {
    if (!env.get('CONCIERGE_ENABLED', false)) return null

    const baseUrl = env.get('CONCIERGE_BASE_URL', '')
    const apiKey = env.get('NVIDIA_API_KEY', '')
    if (!baseUrl || !apiKey) return null
    return new NvidiaProvider(baseUrl, apiKey)
  }

  /** Primary first, then the reserve; an empty name is not a model. */
  models(): string[] {
    return [env.get('CONCIERGE_PRIMARY_MODEL', ''), env.get('CONCIERGE_FALLBACK_MODEL', '')].filter(
      (model): model is string => model.length > 0
    )
  }

  /** What the administration screen may say about the infrastructure. */
  status(): IConcierge.InfrastructureStatus {
    return {
      globally_enabled: env.get('CONCIERGE_ENABLED', false),
      provider_configured:
        env.get('CONCIERGE_BASE_URL', '').length > 0 && env.get('NVIDIA_API_KEY', '').length > 0,
      primary_model: env.get('CONCIERGE_PRIMARY_MODEL', '') || null,
      fallback_model: env.get('CONCIERGE_FALLBACK_MODEL', '') || null,
    }
  }
}
