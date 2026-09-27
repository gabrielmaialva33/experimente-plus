import { CircleCheck, LifeBuoy, ListChecks } from 'lucide-react'

import { ManualBlocks } from '~/components/manual/manual_blocks'
import { ManualText } from '~/components/manual/manual_text'
import type { ManualSection as Section } from '~/content/manual'

/** One task: what it is for, what it needs, the steps, what the reader should see, what can go wrong. */
export function ManualSection({ section }: { section: Section }) {
  const titleId = `${section.id}-titulo`

  return (
    <section id={section.id} aria-labelledby={titleId} className="scroll-mt-24">
      <h3
        id={titleId}
        className="font-display text-[1.3125rem] font-extrabold leading-tight tracking-[-0.01em] print:break-after-avoid"
      >
        {section.title}
      </h3>
      <p className="mt-2 text-base leading-7 text-muted-foreground">
        <ManualText text={section.intro} />
      </p>

      {section.needs?.length ? (
        <div className="mt-4 flex gap-3 rounded-card border border-border-subtle bg-card px-4 py-3 break-inside-avoid">
          <ListChecks aria-hidden="true" className="mt-1 size-4 shrink-0 text-primary-accent" />
          <div className="min-w-0 text-sm leading-6">
            <p className="font-semibold">Você vai precisar de:</p>
            <ul className="mt-1 list-disc space-y-0.5 pl-5">
              {section.needs.map((need) => (
                <li key={need}>
                  <ManualText text={need} />
                </li>
              ))}
            </ul>
          </div>
        </div>
      ) : null}

      <div className="mt-5">
        <ManualBlocks blocks={section.blocks} />
      </div>

      {section.result ? (
        <p className="mt-5 flex gap-3 rounded-card border border-success/30 bg-success-soft px-4 py-3 text-sm leading-6 break-inside-avoid sm:text-[0.9375rem]">
          <CircleCheck aria-hidden="true" className="mt-0.5 size-5 shrink-0 text-success-accent" />
          <span>
            <strong className="font-semibold text-foreground">Pronto: </strong>
            <ManualText text={section.result} />
          </span>
        </p>
      ) : null}

      {section.troubleshooting?.length ? (
        <div className="mt-4 rounded-card border border-border-subtle bg-muted/50 px-4 py-3 break-inside-avoid">
          <p className="flex items-center gap-2 text-sm font-semibold">
            <LifeBuoy aria-hidden="true" className="size-4 text-primary-accent" /> Se algo der
            errado
          </p>
          <ul className="mt-2 list-disc space-y-1.5 pl-5 text-sm leading-6">
            {section.troubleshooting.map((item) => (
              <li key={item}>
                <ManualText text={item} />
              </li>
            ))}
          </ul>
        </div>
      ) : null}
    </section>
  )
}
