import { Eye, EyeOff, Lock } from 'lucide-react'
import { useState } from 'react'

import { Field, type FieldProps } from '~/components/forms/field'

export type PasswordFieldProps = Omit<FieldProps, 'type' | 'trailingAction'>

export function PasswordField({ leftIcon, ...props }: PasswordFieldProps) {
  const [visible, setVisible] = useState(false)
  const actionLabel = visible ? 'Ocultar senha' : 'Mostrar senha'

  return (
    <Field
      {...props}
      type={visible ? 'text' : 'password'}
      leftIcon={leftIcon ?? <Lock className="size-4" />}
      trailingAction={
        <button
          type="button"
          aria-label={actionLabel}
          aria-pressed={visible}
          title={actionLabel}
          onClick={() => setVisible((current) => !current)}
          className="inline-flex size-7 shrink-0 items-center justify-center rounded-md text-muted-foreground transition-colors hover:bg-muted hover:text-foreground focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring"
        >
          {visible ? <EyeOff className="size-4" /> : <Eye className="size-4" />}
        </button>
      }
    />
  )
}
