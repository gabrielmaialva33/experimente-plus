/// <reference path="../../config/inertia.ts" />

import '../css/app.css'
import { hydrateRoot } from 'react-dom/client'
import { createInertiaApp, router, type ResolvedComponent } from '@inertiajs/react'
import { resolvePageComponent } from '@adonisjs/inertia/helpers'
import { formatDocumentTitle } from '~/app/document_title'
import { NetworkNotice } from '~/components/network_notice'
import { bindInertiaFailureNotice } from '~/lib/network_notice'
import { ThemeProvider } from '~/providers/theme_provider'
import { QueryProvider } from '~/providers/query_provider'

const appName = import.meta.env.VITE_APP_NAME || 'Experimente+'

bindInertiaFailureNotice(router)

createInertiaApp({
  progress: { color: '#cf4217' },

  title: (title) => formatDocumentTitle(title, appName),

  resolve: async (name) => {
    /**
     * `resolvePageComponent` resolves to the page *module*; Inertia v3's
     * resolver contract wants the component itself.
     */
    const moduloPagina = await resolvePageComponent<{ default: ResolvedComponent }>(
      `../pages/${name}.tsx`,
      import.meta.glob<{ default: ResolvedComponent }>('../pages/**/*.tsx')
    )

    return moduloPagina.default
  },

  setup({ el, App, props }) {
    hydrateRoot(
      el,
      <ThemeProvider attribute="class" defaultTheme="system" enableSystem disableTransitionOnChange>
        <QueryProvider>
          <App {...props} />
          <NetworkNotice />
        </QueryProvider>
      </ThemeProvider>
    )
  },
})
