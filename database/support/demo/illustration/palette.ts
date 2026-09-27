import type { Rgb } from '#database/support/demo/illustration/raster'

/**
 * The palette of the original development illustrations (paper, ink blue,
 * terracotta, gold, leaf green), extended with a few tones the new motifs
 * need. Every demo image draws from here, so a cover of a bakery and one of a
 * yoga studio still read as the same family of artwork.
 */
export const INK = {
  paper: [245, 232, 208],
  paperWarm: [248, 236, 214],
  paperCool: [236, 231, 218],
  ink: [19, 70, 124],
  inkLight: [52, 94, 137],
  inkLine: [72, 110, 148],
  white: [255, 253, 246],
  plateShadow: [218, 199, 168],
  plateRim: [232, 228, 215],
  terracotta: [203, 93, 46],
  terracottaLight: [228, 112, 62],
  gold: [227, 170, 76],
  goldLight: [242, 202, 123],
  green: [55, 98, 70],
  greenLight: [79, 119, 77],
  sage: [143, 170, 130],
  brown: [87, 49, 34],
  brownMid: [171, 109, 58],
  wood: [196, 146, 94],
  woodDark: [150, 103, 62],
  red: [184, 52, 44],
  pink: [226, 140, 150],
  blush: [240, 190, 180],
  lavender: [150, 130, 190],
  teal: [42, 120, 120],
  sky: [150, 196, 220],
  skyLight: [214, 232, 238],
  charcoal: [45, 45, 52],
  grey: [160, 158, 150],
  cream: [250, 243, 225],
} as const satisfies Record<string, Rgb>

/** Accent sets a scene may rotate through, seeded per image. */
export const ACCENTS: ReadonlyArray<{ band: Rgb; stripe: Rgb; line: Rgb; stitch: Rgb }> = [
  { band: INK.ink, stripe: INK.inkLight, line: INK.inkLine, stitch: INK.terracotta },
  { band: INK.terracotta, stripe: [214, 118, 76], line: [222, 138, 98], stitch: INK.ink },
  { band: INK.green, stripe: [72, 118, 88], line: [92, 134, 104], stitch: INK.gold },
  { band: INK.brown, stripe: [112, 70, 52], line: [128, 86, 66], stitch: INK.goldLight },
]

export function mix(a: Rgb, b: Rgb, amount: number): Rgb {
  return [
    Math.round(a[0] + (b[0] - a[0]) * amount),
    Math.round(a[1] + (b[1] - a[1]) * amount),
    Math.round(a[2] + (b[2] - a[2]) * amount),
  ]
}

/** Deterministic PRNG (mulberry32) seeded from a string, so one key always draws one image. */
export function seededRandom(key: string) {
  let hash = 2166136261
  for (let index = 0; index < key.length; index++) {
    hash ^= key.charCodeAt(index)
    hash = Math.imul(hash, 16777619)
  }
  let state = hash >>> 0
  const next = () => {
    state = (state + 0x6d2b79f5) >>> 0
    let t = state
    t = Math.imul(t ^ (t >>> 15), t | 1)
    t ^= t + Math.imul(t ^ (t >>> 7), t | 61)
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296
  }
  return {
    next,
    between: (min: number, max: number) => min + (max - min) * next(),
    int: (min: number, max: number) => Math.floor(min + (max - min + 1) * next()),
    pick: <T>(items: ReadonlyArray<T>): T => items[Math.floor(next() * items.length)],
    chance: (probability: number) => next() < probability,
  }
}

export type Random = ReturnType<typeof seededRandom>
