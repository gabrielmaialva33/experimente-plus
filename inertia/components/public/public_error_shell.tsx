import { Head } from '@inertiajs/react'
import type { ReactNode } from 'react'

import { AppBrand } from '~/components/app_brand'
import { PublicFooter } from '~/components/public/public_footer'
import { MAIN_CONTENT_ID, SkipLink } from '~/components/skip_link'
import { ThemeToggle } from '~/components/theme/theme_toggle'

interface PublicErrorShellProps {
  title: string
  description: string
  children: ReactNode
}

/**
 * Error routes can be rendered before router middleware initializes auth.
 * Keep this frame deliberately neutral so it never presents guest actions to
 * an authenticated visitor or exposes personalized navigation by accident.
 */
export function PublicErrorShell({ title, description, children }: PublicErrorShellProps) {
  return (
    <>
      <Head title={title}>
        <meta name="description" content={description} />
        <meta name="robots" content="noindex,nofollow" />
      </Head>
      <SkipLink />
      <div className="flex min-h-screen flex-col overflow-x-clip bg-background text-foreground">
        <header className="border-b bg-background">
          <div className="app-container flex min-h-16 items-center justify-between gap-4 py-2">
            <AppBrand href="/" />
            <ThemeToggle />
          </div>
        </header>
        <main id={MAIN_CONTENT_ID} tabIndex={-1} className="flex-1">
          {children}
        </main>
        <PublicFooter />
      </div>
    </>
  )
}
