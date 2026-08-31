import type { ReactNode } from 'react'

import { ConsumerShell } from '~/components/consumer/consumer_shell'

interface ConsumerFlowShellProps {
  title: string
  description?: string
  actions?: ReactNode
  children: ReactNode
}

export function ConsumerFlowShell({
  title,
  description,
  actions,
  children,
}: ConsumerFlowShellProps) {
  return (
    <ConsumerShell active="wallet">
      <header className="mb-7 flex flex-col gap-4 sm:flex-row sm:items-end sm:justify-between">
        <div className="max-w-3xl">
          <p className="text-xs font-semibold uppercase tracking-[0.14em] text-primary">
            Experimente+
          </p>
          <h1 className="mt-2 text-3xl font-black tracking-[-0.04em] sm:text-4xl">{title}</h1>
          {description ? (
            <p className="mt-3 text-sm leading-6 text-muted-foreground sm:text-base">
              {description}
            </p>
          ) : null}
        </div>
        {actions ? <div className="flex shrink-0 flex-wrap gap-2">{actions}</div> : null}
      </header>
      {children}
    </ConsumerShell>
  )
}
