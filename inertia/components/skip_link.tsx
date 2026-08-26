export const MAIN_CONTENT_ID = 'conteudo-principal'

/**
 * Visually hidden link that appears on keyboard focus and jumps straight to
 * the main content landmark. Must be the first focusable element in a layout.
 */
export function SkipLink({ targetId = MAIN_CONTENT_ID }: { targetId?: string }) {
  return (
    <a
      href={`#${targetId}`}
      className="sr-only focus:not-sr-only focus:fixed focus:start-4 focus:top-4 focus:z-[100] focus:rounded-lg focus:bg-primary focus:px-4 focus:py-2.5 focus:text-sm focus:font-semibold focus:text-primary-foreground focus:shadow-lg focus:outline-none focus:ring-2 focus:ring-ring focus:ring-offset-2"
    >
      Pular para o conteúdo principal
    </a>
  )
}
