import { Head } from '@inertiajs/react'
import type { ReactNode } from 'react'

import { MAIN_CONTENT_ID, SkipLink } from '~/components/skip_link'
import { PublicFooter } from '~/components/public/public_footer'
import { PublicHeader } from '~/components/public/public_header'

interface PublicShellProps {
  title: string
  description: string
  image?: string | null
  children: ReactNode
  mainClassName?: string
}

export function PublicShell({
  title,
  description,
  image,
  children,
  mainClassName,
}: PublicShellProps) {
  return (
    <>
      <Head title={title}>
        <meta name="description" content={description} />
        <meta name="robots" content="index,follow" />
        <meta property="og:title" content={title} />
        <meta property="og:description" content={description} />
        <meta property="og:type" content="website" />
        {image ? <meta property="og:image" content={image} /> : null}
      </Head>
      <SkipLink />
      <div className="flex min-h-screen flex-col overflow-x-clip bg-background text-foreground">
        <PublicHeader />
        <main id={MAIN_CONTENT_ID} tabIndex={-1} className={mainClassName}>
          {children}
        </main>
        <PublicFooter />
      </div>
    </>
  )
}
