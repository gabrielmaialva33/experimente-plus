import { useId } from 'react'

import { organizationRoleDescription, organizationRoleLabel } from '~/lib/labels'
import { cn } from '~/lib/utils'

interface OrganizationRolePickerProps {
  legend: string
  /** Only the roles the server says the viewer may grant. */
  roles: readonly string[]
  value: string
  onChange: (role: string) => void
  disabled?: boolean
  error?: string
}

/**
 * Native radios, one per grantable role, each with what the role can do: the
 * choice is explained where it is made, not in a separate help page.
 */
export function OrganizationRolePicker({
  legend,
  roles,
  value,
  onChange,
  disabled = false,
  error,
}: OrganizationRolePickerProps) {
  const id = useId()
  const errorId = `${id}-error`

  return (
    <fieldset
      className="flex flex-col gap-2"
      aria-describedby={error ? errorId : undefined}
      data-invalid={error ? 'true' : undefined}
    >
      <legend className="mb-2 text-[0.9375rem] font-bold">{legend}</legend>
      {roles.map((role) => {
        const checked = value === role
        const descriptionId = `${id}-${role}-description`

        return (
          <label
            key={role}
            className={cn(
              'flex min-h-11 cursor-pointer items-start gap-3 rounded-2xl border px-4 py-3 transition-colors motion-reduce:transition-none',
              checked ? 'border-primary bg-primary-soft' : 'border-input hover:bg-accent',
              disabled && 'cursor-not-allowed opacity-70'
            )}
          >
            <input
              type="radio"
              name={`${id}-role`}
              value={role}
              checked={checked}
              disabled={disabled}
              onChange={() => onChange(role)}
              aria-describedby={descriptionId}
              className="mt-1 size-4 shrink-0 accent-primary"
            />
            <span className="min-w-0">
              <span
                className={cn(
                  'block text-[0.9375rem] font-semibold',
                  checked && 'text-primary-accent'
                )}
              >
                {organizationRoleLabel(role)}
              </span>
              <span
                id={descriptionId}
                className="mt-0.5 block text-sm leading-5 text-muted-foreground"
              >
                {organizationRoleDescription(role)}
              </span>
            </span>
          </label>
        )
      })}
      {error ? (
        <p id={errorId} role="alert" className="text-sm font-semibold text-destructive-accent">
          {error}
        </p>
      ) : null}
    </fieldset>
  )
}
