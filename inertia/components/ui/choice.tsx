import { Check } from 'lucide-react'
import type { ComponentProps, ReactNode } from 'react'

export function ChoiceIndicator() {
  return <Check aria-hidden="true" className="choice-marker size-3.5 shrink-0" />
}

type FilterChipProps = Omit<ComponentProps<'input'>, 'type' | 'checked' | 'className'> & {
  checked: boolean
  children: ReactNode
}

/** A filter is a persistent choice, not a command. Native checkbox semantics remain intact. */
export function FilterChip({ checked, children, ...inputProps }: FilterChipProps) {
  return (
    <label
      className="choice-control min-h-11 cursor-pointer rounded-full px-3 text-sm"
      data-selected={checked}
    >
      <input {...inputProps} type="checkbox" checked={checked} className="sr-only" />
      <ChoiceIndicator />
      {children}
    </label>
  )
}

/** Summary of the applied query; deliberately not an interactive button. */
export function AppliedFilterChip({ children }: { children: ReactNode }) {
  return (
    <span className="choice-control min-h-7 rounded-full px-2.5 text-xs" data-selected="true">
      <ChoiceIndicator />
      {children}
    </span>
  )
}
