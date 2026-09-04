import { FilePenLine, LoaderCircle } from 'lucide-react'

import { Button } from '~/components/ui/button'

export type EstablishmentRevisionCreationSource = 'published' | 'latest_terminal'

interface EstablishmentRevisionActionProps {
  allowed: boolean
  source: EstablishmentRevisionCreationSource | null
  processing?: boolean
  onCreate: (source: EstablishmentRevisionCreationSource) => void
}

/**
 * Keeps the terminal-revision action explicit: absence of a server-selected
 * clone source means absence of the CTA, never a guessed browser fallback.
 */
export function EstablishmentRevisionAction({
  allowed,
  source,
  processing = false,
  onCreate,
}: EstablishmentRevisionActionProps) {
  if (!allowed || source === null) {
    return null
  }

  return (
    <Button
      type="button"
      variant="outline"
      size="lg"
      disabled={processing}
      onClick={() => onCreate(source)}
    >
      {processing ? (
        <LoaderCircle aria-hidden="true" className="animate-spin" />
      ) : (
        <FilePenLine aria-hidden="true" />
      )}
      Criar nova revisão
    </Button>
  )
}

export default EstablishmentRevisionAction
