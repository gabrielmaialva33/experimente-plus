import { usePage } from '@inertiajs/react'
import { BookOpen, CircleHelp, Download, LifeBuoy } from 'lucide-react'

import { Button } from '~/components/ui/button'
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuLabel,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from '~/components/ui/dropdown-menu'
import { MANUAL_PATH, MANUAL_PDF_PATH, pageHelp } from '~/config/help'
import type { NavigationSurface } from '~/config/navigation'

/**
 * The "?" in the portal and back-office header. The manual opens in a new tab, so
 * a form half filled in this one is still there when the reader comes back.
 */
export function HelpMenu({ surface }: { surface: NavigationSurface }) {
  const { component } = usePage()
  const help = pageHelp(component, surface)

  return (
    <DropdownMenu>
      <DropdownMenuTrigger asChild>
        <Button variant="ghost" size="icon" mode="icon" aria-label="Ajuda" title="Ajuda">
          <CircleHelp className="size-5" />
        </Button>
      </DropdownMenuTrigger>
      <DropdownMenuContent align="end" className="w-64">
        <DropdownMenuLabel>
          <span className="block text-xs font-semibold text-foreground">Ajuda</span>
          <span className="mt-0.5 block font-normal">O manual abre em uma nova aba.</span>
        </DropdownMenuLabel>
        <DropdownMenuSeparator />
        <DropdownMenuItem asChild>
          <a href={help.href} target="_blank" rel="noopener noreferrer">
            <LifeBuoy className="size-4" />
            Ajuda desta página
            <span className="sr-only"> (abre em nova aba)</span>
          </a>
        </DropdownMenuItem>
        <DropdownMenuItem asChild>
          <a href={MANUAL_PATH} target="_blank" rel="noopener noreferrer">
            <BookOpen className="size-4" />
            Manual completo
            <span className="sr-only"> (abre em nova aba)</span>
          </a>
        </DropdownMenuItem>
        <DropdownMenuItem asChild>
          <a href={MANUAL_PDF_PATH} download>
            <Download className="size-4" />
            Baixar manual em PDF
          </a>
        </DropdownMenuItem>
      </DropdownMenuContent>
    </DropdownMenu>
  )
}
