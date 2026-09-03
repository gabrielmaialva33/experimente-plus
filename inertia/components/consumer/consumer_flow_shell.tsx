import type { ReactNode } from 'react'

import { ConsumerShell } from '~/components/consumer/consumer_shell'
import { PageHeader } from '~/components/page_header'

interface ConsumerFlowShellProps {
  title: string
  description?: string
  actions?: ReactNode
  meta?: ReactNode
  children: ReactNode
}

export function ConsumerFlowShell({
  title,
  description,
  actions,
  meta,
  children,
}: ConsumerFlowShellProps) {
  return (
    <ConsumerShell>
      <PageHeader
        title={title}
        description={description}
        eyebrow="Conta pessoal"
        actions={actions}
        meta={meta}
        className="mb-7"
      />
      {children}
    </ConsumerShell>
  )
}
