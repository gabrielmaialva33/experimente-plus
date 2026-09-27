import { CheckCircle2, Circle } from 'lucide-react'

import { cn } from '~/lib/utils'

interface PasswordRequirementsProps {
  password: string
  confirmation?: string
}

function Requirement({ met, children }: { met: boolean; children: string }) {
  const Icon = met ? CheckCircle2 : Circle
  return (
    <li
      className={cn(
        'flex items-start gap-2 leading-5',
        met ? 'font-semibold text-success-accent' : 'text-muted-foreground'
      )}
    >
      <Icon aria-hidden="true" className="mt-0.5 size-3.5 shrink-0" /> {children}
    </li>
  )
}

export function PasswordRequirements({ password, confirmation }: PasswordRequirementsProps) {
  const hasConfirmation = confirmation !== undefined
  const matches = hasConfirmation && confirmation.length > 0 && password === confirmation

  return (
    <div
      className="rounded-2xl border border-border-subtle bg-background px-4 py-3"
      aria-live="polite"
    >
      <p className="text-xs font-semibold text-foreground">Para continuar</p>
      {/* One rule per line: side by side, a narrow card wrapped one rule and not the other. */}
      <ul className="mt-2 grid gap-1.5 text-xs">
        <Requirement met={password.length >= 8}>Use ao menos 8 caracteres</Requirement>
        {hasConfirmation ? (
          <Requirement met={matches}>As duas senhas devem coincidir</Requirement>
        ) : null}
      </ul>
    </div>
  )
}
