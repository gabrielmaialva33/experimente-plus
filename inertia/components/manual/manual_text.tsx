import { Link } from '@inertiajs/react'
import { Fragment, type ReactNode } from 'react'

export type ManualTextPart =
  | { kind: 'text'; value: string }
  | { kind: 'bold'; value: string }
  | { kind: 'link'; value: string; href: string }

const MARK = /(\*\*[^*]+\*\*|\[[^\]]+\]\([^)\s]+\))/g
const LINK = /^\[([^\]]+)\]\(([^)\s]+)\)$/

/** Splits the manual's two inline marks, **bold** and [label](href), from plain text. */
export function parseManualText(text: string): ManualTextPart[] {
  return text
    .split(MARK)
    .filter(Boolean)
    .map((piece): ManualTextPart => {
      if (piece.startsWith('**') && piece.endsWith('**') && piece.length > 4) {
        return { kind: 'bold', value: piece.slice(2, -2) }
      }
      const link = piece.match(LINK)
      if (link) return { kind: 'link', value: link[1], href: link[2] }
      return { kind: 'text', value: piece }
    })
}

const linkClass =
  'font-semibold text-primary-accent underline decoration-primary-accent/40 underline-offset-4 outline-none hover:decoration-primary-accent focus-visible:rounded-sm focus-visible:ring-2 focus-visible:ring-ring'

export function ManualText({ text }: { text: string }): ReactNode {
  return parseManualText(text).map((part, index) => {
    if (part.kind === 'bold') {
      return (
        <strong key={index} className="font-semibold text-foreground">
          {part.value}
        </strong>
      )
    }
    if (part.kind === 'link') {
      // Anchors stay on this page; other paths are site pages, visited by Inertia.
      return part.href.startsWith('#') ? (
        <a key={index} href={part.href} className={linkClass}>
          {part.value}
        </a>
      ) : (
        <Link key={index} href={part.href} className={linkClass}>
          {part.value}
        </Link>
      )
    }
    return <Fragment key={index}>{part.value}</Fragment>
  })
}
