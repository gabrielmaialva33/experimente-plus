import { usePage } from '@inertiajs/react'
import { AlertCircle, CheckCircle2, Info, TriangleAlert, type LucideIcon } from 'lucide-react'
import { useEffect, useState, type ReactNode } from 'react'

import { MAIN_CONTENT_ID, SkipLink } from '~/components/skip_link'
import { cn } from '~/lib/utils'
import { Header } from './main/components/header'
import { Sidebar } from './main/components/sidebar'

interface MainLayoutProps {
  children: ReactNode
}

interface FlashMessage {
  key: string
  message: string | null | undefined
  icon: LucideIcon
  className: string
}

export function MainLayout({ children }: MainLayoutProps) {
  const [collapsed, setCollapsed] = useState(false)
  const { flash } = usePage().props as {
    flash?: {
      success?: string | null
      error?: string | null
      warning?: string | null
      info?: string | null
    }
  }

  useEffect(() => {
    setCollapsed(window.localStorage.getItem('experimente.sidebar.collapsed') === 'true')
  }, [])

  const toggleSidebar = () => {
    setCollapsed((current) => {
      const next = !current
      window.localStorage.setItem('experimente.sidebar.collapsed', String(next))
      return next
    })
  }

  const messages: FlashMessage[] = [
    {
      key: 'success',
      message: flash?.success,
      icon: CheckCircle2,
      className: 'border-success/25 bg-success/10 text-success',
    },
    {
      key: 'error',
      message: flash?.error,
      icon: AlertCircle,
      className: 'border-destructive/25 bg-destructive/10 text-destructive',
    },
    {
      key: 'warning',
      message: flash?.warning,
      icon: TriangleAlert,
      className: 'border-warning/30 bg-warning/10 text-warning-foreground',
    },
    {
      key: 'info',
      message: flash?.info,
      icon: Info,
      className: 'border-info/25 bg-info/10 text-info',
    },
  ]

  return (
    <div className="min-h-screen bg-muted/35">
      <SkipLink />
      <Sidebar isCollapsed={collapsed} onToggle={toggleSidebar} />

      <div
        className={cn(
          'flex min-h-screen flex-col transition-[padding] duration-300',
          collapsed ? 'lg:ps-[84px]' : 'lg:ps-[272px]'
        )}
      >
        <Header />

        <main id={MAIN_CONTENT_ID} tabIndex={-1} className="flex-1 outline-none" role="main">
          <div className="app-container py-6 sm:py-8">
            {messages.map(({ key, message, icon: Icon, className }) =>
              message ? (
                <div
                  key={key}
                  role={key === 'error' ? 'alert' : 'status'}
                  className={cn(
                    'mb-4 flex items-start gap-3 rounded-xl border px-4 py-3 text-sm shadow-xs',
                    className
                  )}
                >
                  <Icon className="mt-0.5 size-4 shrink-0" />
                  <span className="leading-5">{message}</span>
                </div>
              ) : null
            )}

            {children}
          </div>
        </main>

        <footer className="border-t border-border/60 bg-background/50 py-4 text-xs text-muted-foreground">
          <div className="app-container flex flex-col gap-1 sm:flex-row sm:items-center sm:justify-between">
            <span>© {new Date().getFullYear()} Experimente+</span>
            <span>Descoberta local com contexto, confiança e identidade regional.</span>
          </div>
        </footer>
      </div>
    </div>
  )
}
