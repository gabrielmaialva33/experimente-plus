import { Head } from '@inertiajs/react'
import type { ReactNode } from 'react'

import { PublicFooter } from '~/components/public/public_footer'
import { PublicHeader } from '~/components/public/public_header'
import { PublicMobileNavigation } from '~/components/public/public_mobile_navigation'
import { MAIN_CONTENT_ID, SkipLink } from '~/components/skip_link'
import { cn } from '~/lib/utils'

interface PublicShellProps {
  title: string
  description: string
  image?: string | null
  indexable?: boolean
  children: ReactNode
  mainClassName?: string
}

export function PublicShell({
  title,
  description,
  image,
  indexable = true,
  children,
  mainClassName,
}: PublicShellProps) {
  return (
    <>
      <Head title={title}>
        <meta name="description" content={description} />
        <meta name="robots" content={indexable ? 'index,follow' : 'noindex,nofollow'} />
        <meta property="og:title" content={title} />
        <meta property="og:description" content={description} />
        <meta property="og:type" content="website" />
        {image ? <meta property="og:image" content={image} /> : null}
      </Head>
      <SkipLink />
      <div
        data-public-shell
        className="flex min-h-screen flex-col overflow-x-clip bg-background pb-[var(--public-mobile-navigation-space)] text-foreground md:pb-0"
      >
        <PublicHeader />
        <main id={MAIN_CONTENT_ID} tabIndex={-1} className={cn('flex-1', mainClassName)}>
          {children}
        </main>
        <PublicFooter />
        <PublicMobileNavigation />
      </div>
    </>
  )
}
