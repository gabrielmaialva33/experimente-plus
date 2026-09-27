import { CircleAlert, Info, Lightbulb, type LucideIcon } from 'lucide-react'

import { ManualText } from '~/components/manual/manual_text'
import type { ManualBlock, ManualImage } from '~/content/manual'
import { cn } from '~/lib/utils'

const NOTE_TONES: Record<
  Extract<ManualBlock, { kind: 'note' }>['tone'],
  { icon: LucideIcon; className: string; iconClassName: string }
> = {
  info: {
    icon: Info,
    className: 'border-info/30 bg-info-soft',
    iconClassName: 'text-info-accent',
  },
  tip: {
    icon: Lightbulb,
    className: 'border-success/30 bg-success-soft',
    iconClassName: 'text-success-accent',
  },
  warning: {
    icon: CircleAlert,
    className: 'border-warning/40 bg-warning-soft',
    iconClassName: 'text-warning-accent',
  },
}

function ManualFigure({ image }: { image: ManualImage }) {
  const phone = image.frame === 'phone'
  return (
    <figure
      className={cn(
        'break-inside-avoid',
        // On paper three phone screens share a row, so a short task does not leave a
        // page almost empty waiting for a tall picture.
        phone
          ? 'w-full max-w-[17rem] min-[400px]:w-[calc(50%-0.5rem)] print:w-[calc(33%-0.75rem)]'
          : 'w-full'
      )}
      // A detail crop narrower than the column keeps its own size instead of blurring.
      style={phone ? undefined : { maxWidth: image.width }}
    >
      <div
        className={cn(
          'overflow-hidden border border-border-subtle bg-card',
          phone ? 'rounded-[1.25rem]' : 'rounded-card'
        )}
      >
        {/* The column shows a reduced screenshot; the link opens it at full size. */}
        <a
          href={image.src}
          target="_blank"
          rel="noopener noreferrer"
          title="Abrir a imagem em tamanho real"
          className="block outline-none focus-visible:ring-2 focus-visible:ring-inset focus-visible:ring-ring"
        >
          <img
            src={image.src}
            alt={image.alt}
            width={image.width}
            height={image.height}
            loading="lazy"
            decoding="async"
            className={cn(
              'block h-auto w-full',
              phone ? 'print:max-h-[8.5cm] print:w-auto' : 'print:max-h-[9cm] print:w-auto'
            )}
          />
          <span className="sr-only"> (abre a imagem em tamanho real em nova aba)</span>
        </a>
      </div>
      {image.caption ? (
        <figcaption className="mt-2 text-sm leading-6 text-muted-foreground">
          {image.caption}
        </figcaption>
      ) : null}
    </figure>
  )
}

export function ManualBlocks({ blocks }: { blocks: readonly ManualBlock[] }) {
  return (
    <div className="space-y-5 text-base leading-7 text-foreground/90">
      {blocks.map((block, index) => {
        switch (block.kind) {
          case 'paragraph':
            return (
              <p key={index}>
                <ManualText text={block.text} />
              </p>
            )
          case 'steps':
            return (
              <ol key={index} className="space-y-3">
                {block.items.map((item, step) => (
                  <li key={step} className="flex gap-3">
                    <span
                      aria-hidden="true"
                      className="mt-0.5 flex size-7 shrink-0 items-center justify-center rounded-full bg-primary text-sm font-extrabold text-primary-foreground print:border print:border-primary print:bg-transparent print:text-primary-accent"
                    >
                      {step + 1}
                    </span>
                    <span className="min-w-0 pt-0.5">
                      <span className="sr-only">Passo {step + 1}: </span>
                      <ManualText text={item} />
                    </span>
                  </li>
                ))}
              </ol>
            )
          case 'list':
            return (
              <ul key={index} className="list-disc space-y-2 pl-5 marker:text-primary-accent">
                {block.items.map((item, position) => (
                  <li key={position}>
                    <ManualText text={item} />
                  </li>
                ))}
              </ul>
            )
          case 'note': {
            const tone = NOTE_TONES[block.tone]
            const Icon = tone.icon
            return (
              <aside
                key={index}
                aria-label={block.title}
                className={cn(
                  'flex break-inside-avoid gap-3 rounded-card border p-4 sm:p-5',
                  tone.className
                )}
              >
                <Icon
                  aria-hidden="true"
                  className={cn('mt-0.5 size-5 shrink-0', tone.iconClassName)}
                />
                <div className="min-w-0">
                  <p className="font-display font-extrabold leading-tight text-foreground">
                    {block.title}
                  </p>
                  <p className="mt-1.5 text-sm leading-6 sm:text-[0.9375rem]">
                    <ManualText text={block.text} />
                  </p>
                </div>
              </aside>
            )
          }
          case 'figures':
            return (
              <div key={index} className="flex flex-wrap gap-4">
                {block.images.map((image) => (
                  <ManualFigure key={image.id} image={image} />
                ))}
              </div>
            )
          case 'table':
            return <ManualTable key={index} block={block} />
        }
      })}
    </div>
  )
}

/**
 * A comparison table on wide screens; on a phone (and in print, where columns get
 * too narrow) each row becomes a card with its labels, so nothing scrolls sideways.
 */
function ManualTable({ block }: { block: Extract<ManualBlock, { kind: 'table' }> }) {
  const [first, ...rest] = block.columns
  return (
    <figure>
      <figcaption className="mb-2 text-sm font-semibold text-muted-foreground print:break-after-avoid">
        {block.caption}
      </figcaption>
      <div className="hidden overflow-hidden rounded-card border border-border-subtle md:block print:hidden">
        <table className="w-full border-collapse text-left text-sm leading-6">
          <thead className="bg-muted/60">
            <tr>
              {block.columns.map((column) => (
                <th key={column} scope="col" className="px-4 py-3 align-bottom font-semibold">
                  {column}
                </th>
              ))}
            </tr>
          </thead>
          <tbody className="divide-y divide-border-subtle bg-card">
            {block.rows.map((row) => (
              <tr key={row[0]}>
                {row.map((cell, index) =>
                  index === 0 ? (
                    <th key={index} scope="row" className="px-4 py-3 align-top font-semibold">
                      <ManualText text={cell} />
                    </th>
                  ) : (
                    <td key={index} className="px-4 py-3 align-top text-foreground/90">
                      <ManualText text={cell} />
                    </td>
                  )
                )}
              </tr>
            ))}
          </tbody>
        </table>
      </div>
      <ul className="space-y-3 md:hidden print:block">
        {block.rows.map((row) => (
          <li
            key={row[0]}
            className="break-inside-avoid rounded-card border border-border-subtle bg-card p-4"
          >
            <p className="font-display font-extrabold leading-tight">
              <span className="sr-only">{first}: </span>
              <ManualText text={row[0]} />
            </p>
            <dl className="mt-2 space-y-2 text-sm leading-6">
              {rest.map((column, index) => (
                <div key={column}>
                  <dt className="font-semibold text-muted-foreground">{column}</dt>
                  <dd>
                    <ManualText text={row[index + 1]} />
                  </dd>
                </div>
              ))}
            </dl>
          </li>
        ))}
      </ul>
    </figure>
  )
}
