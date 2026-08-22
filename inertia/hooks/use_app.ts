import { usePage } from '@inertiajs/react'

import type { AppSharedProps } from '~/types'

const fallback: AppSharedProps = {
  name: 'Experimente+',
  url: 'http://localhost:3333',
  sourceUrl: null,
  environment: 'development',
  demoPagesEnabled: false,
}

export function useApp(): AppSharedProps {
  const { app } = usePage().props as { app?: AppSharedProps }
  return app ?? fallback
}
