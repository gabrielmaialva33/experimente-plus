import { Loader2 } from 'lucide-react'
import type { ReactNode } from 'react'

import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
  AlertDialogTrigger,
} from '~/components/ui/alert-dialog'

interface ConfirmDialogProps {
  /**
   * Element that opens the dialog; rendered via `AlertDialogTrigger asChild`.
   * Omit it for fully controlled dialogs opened after e.g. native form
   * validation (pass `open`/`onOpenChange` instead).
   */
  trigger?: ReactNode
  title: string
  description: string
  confirmLabel: string
  cancelLabel?: string
  /** Styles the confirm action for irreversible/destructive operations. */
  destructive?: boolean
  /** Disables both actions and shows a spinner while the operation runs. */
  processing?: boolean
  disabled?: boolean
  onConfirm: () => void
  /** Optional controlled state, for callers that keep the dialog open while processing. */
  open?: boolean
  onOpenChange?: (open: boolean) => void
}

/**
 * Thin confirmation dialog over `ui/alert-dialog`. Radix keeps the focus trap
 * and returns focus to the trigger when the dialog closes.
 */
export function ConfirmDialog({
  trigger,
  title,
  description,
  confirmLabel,
  cancelLabel = 'Cancelar',
  destructive = false,
  processing = false,
  disabled = false,
  onConfirm,
  open,
  onOpenChange,
}: ConfirmDialogProps) {
  return (
    <AlertDialog open={open} onOpenChange={onOpenChange}>
      {trigger !== undefined ? <AlertDialogTrigger asChild>{trigger}</AlertDialogTrigger> : null}
      <AlertDialogContent>
        <AlertDialogHeader>
          <AlertDialogTitle>{title}</AlertDialogTitle>
          <AlertDialogDescription>{description}</AlertDialogDescription>
        </AlertDialogHeader>
        <AlertDialogFooter>
          <AlertDialogCancel disabled={processing}>{cancelLabel}</AlertDialogCancel>
          <AlertDialogAction
            variant={destructive ? 'destructive' : 'primary'}
            disabled={processing || disabled}
            onClick={onConfirm}
          >
            {processing && <Loader2 aria-hidden="true" className="size-4 animate-spin" />}
            {confirmLabel}
          </AlertDialogAction>
        </AlertDialogFooter>
      </AlertDialogContent>
    </AlertDialog>
  )
}
