import { describe, expect, it } from 'vitest'

import { reportStatusMeta } from '~/lib/content_reports'
import { partnerContentStatusMeta } from '~/lib/partner_content'
import { partnerContentMediaStatusMeta } from '~/lib/partner_content_media'

/**
 * `*-foreground` status tokens are made for the solid status colour. On a soft
 * tint in the dark theme `warning-foreground` is dark text on a dark surface, so
 * every status chip pairs its `*-soft` fill with its `*-accent` text instead.
 */
describe('status chips read in both themes', () => {
  const maps = {
    reportStatusMeta,
    partnerContentStatusMeta,
    partnerContentMediaStatusMeta,
  } as Record<string, Record<string, { className: string }>>

  for (const [name, meta] of Object.entries(maps)) {
    it(`${name} pairs a soft fill with its accent text`, () => {
      for (const [status, { className }] of Object.entries(meta)) {
        expect(className, `${name}.${status}`).not.toMatch(
          /text-(warning|success|info|destructive)-foreground/
        )
        expect(className, `${name}.${status}`).toMatch(
          /bg-(warning|success|info|destructive|primary)-soft text-\1-accent|bg-muted(\/\d+)? text-muted-foreground/
        )
      }
    })
  }
})
