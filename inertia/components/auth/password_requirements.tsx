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
        'flex items-center gap-2',
        met ? 'text-emerald-700 dark:text-emerald-400' : 'text-muted-foreground'
      )}
    >
      <Icon className="size-3.5 shrink-0" /> {children}
    </li>
  )
}

export function PasswordRequirements({ password, confirmation }: PasswordRequirementsProps) {
  const hasConfirmation = confirmation !== undefined
  const matches = hasConfirmation && confirmation.length > 0 && password === confirmation

  return (
    <div className="rounded-xl border bg-muted/35 px-4 py-3" aria-live="polite">
      <p className="text-xs font-semibold text-foreground">Para continuar</p>
      <ul className="mt-2 grid gap-1.5 text-xs sm:grid-cols-2">
        <Requirement met={password.length >= 8}>Use ao menos 8 caracteres</Requirement>
        {hasConfirmation ? (
          <Requirement met={matches}>As duas senhas devem coincidir</Requirement>
        ) : null}
      </ul>
    </div>
  )
}
