import { useForm } from '@inertiajs/react'
import type { LucideIcon } from 'lucide-react'
import { useId, useState } from 'react'

import { ConfirmDialog } from '~/components/confirm_dialog'
import { Button } from '~/components/ui/button'
import { Label } from '~/components/ui/label'
import { Textarea } from '~/components/ui/textarea'

/** The services refuse a decision reason shorter than this. */
export const MIN_REASON_LENGTH = 3

interface ReasonDecisionProps {
  /** Where the decision is posted, as `{ reason }`. */
  action: string
  label: string
  icon: LucideIcon
  variant?: 'primary' | 'outline' | 'destructive'
  title: string
  description: string
  reasonLabel: string
  reasonHint: string
  placeholder?: string
  /** Text the field starts with, for a decision whose note is usually the same. */
  defaultReason?: string
  confirmLabel: string
  destructive?: boolean
  disabled?: boolean
  className?: string
}

/**
 * One moderation decision that needs a written reason: a button that opens a
 * confirmation with the reason field. The reason is required by the service
 * behind the action; the dialog only keeps an empty one from being sent.
 */
export function ReasonDecision({
  action,
  label,
  icon: Icon,
  variant = 'outline',
  title,
  description,
  reasonLabel,
  reasonHint,
  placeholder,
  defaultReason = '',
  confirmLabel,
  destructive = false,
  disabled = false,
  className,
}: ReasonDecisionProps) {
  const id = useId()
  const [open, setOpen] = useState(false)
  const form = useForm({ reason: defaultReason })
  const reason = form.data.reason.trim()

  function submit() {
    form.transform((data) => ({ reason: data.reason.trim() }))
    form.post(action, {
      preserveScroll: true,
      onSuccess: () => setOpen(false),
    })
  }

  return (
    <ConfirmDialog
      open={open}
      onOpenChange={(next) => {
        if (form.processing) return
        setOpen(next)
        if (!next) form.clearErrors()
      }}
      title={title}
      description={description}
      confirmLabel={confirmLabel}
      destructive={destructive}
      processing={form.processing}
      disabled={reason.length < MIN_REASON_LENGTH}
      onConfirm={submit}
      trigger={
        <Button
          type="button"
          variant={variant}
          size="lg"
          shape="pill"
          disabled={disabled || form.processing}
          className={className}
        >
          <Icon aria-hidden="true" className="size-4" />
          {label}
        </Button>
      }
    >
      <div className="space-y-2">
        <Label htmlFor={`${id}-reason`}>{reasonLabel}</Label>
        <Textarea
          id={`${id}-reason`}
          value={form.data.reason}
          onChange={(event) => form.setData('reason', event.target.value.slice(0, 4000))}
          rows={4}
          required
          minLength={MIN_REASON_LENGTH}
          maxLength={4000}
          aria-describedby={`${id}-hint`}
          aria-invalid={form.errors.reason ? true : undefined}
          placeholder={placeholder}
        />
        <p id={`${id}-hint`} className="text-xs text-muted-foreground">
          {reasonHint}
        </p>
        {form.errors.reason ? (
          <p role="alert" className="text-sm font-semibold text-destructive-accent">
            {form.errors.reason}
          </p>
        ) : null}
      </div>
    </ConfirmDialog>
  )
}
