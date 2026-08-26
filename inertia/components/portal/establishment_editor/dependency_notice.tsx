import { AlertTriangle, ArrowRight } from 'lucide-react'

import { Button } from '~/components/ui/button'

interface EditorDependencyNoticeProps {
  title: string
  description: string
  actionLabel: string
  onAction: () => void
}

export function EditorDependencyNotice({
  title,
  description,
  actionLabel,
  onAction,
}: EditorDependencyNoticeProps) {
  return (
    <div
      role="alert"
      className="flex flex-col gap-4 rounded-xl border border-warning/25 bg-warning/10 px-4 py-4 sm:flex-row sm:items-center sm:justify-between"
    >
      <div className="flex min-w-0 items-start gap-3">
        <AlertTriangle className="mt-0.5 size-5 shrink-0 text-warning-foreground" />
        <div className="min-w-0">
          <p className="font-semibold">{title}</p>
          <p className="mt-1 text-sm leading-5 text-muted-foreground">{description}</p>
        </div>
      </div>
      <Button type="button" variant="outline" onClick={onAction}>
        {actionLabel}
        <ArrowRight />
      </Button>
    </div>
  )
}
