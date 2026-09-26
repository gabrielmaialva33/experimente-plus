import { Check } from 'lucide-react'
import type { ComponentProps, ReactNode } from 'react'

import { cn } from '~/lib/utils'

export function ChoiceIndicator() {
  return <Check aria-hidden="true" className="choice-marker size-3.5 shrink-0" />
}

type FilterChipProps = Omit<ComponentProps<'input'>, 'type' | 'checked' | 'className'> & {
  checked: boolean
  children: ReactNode
  /** Sizes the chip to its row, e.g. the 52 px fields of a search bar. */
  className?: string
}

/** A filter is a persistent choice, not a command. Native checkbox semantics remain intact. */
export function FilterChip({ checked, children, className, ...inputProps }: FilterChipProps) {
  return (
    <label
      className={cn('choice-control min-h-11 cursor-pointer rounded-full px-3 text-sm', className)}
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
