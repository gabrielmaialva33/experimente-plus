import {
  ACCENTS,
  INK,
  mix,
  seededRandom,
  type Random,
} from '#database/support/demo/illustration/palette'
import {
  arcPoints,
  leafPoints,
  quadraticPoints,
  Raster,
  rotatePoints,
  type Point,
  type Rgb,
} from '#database/support/demo/illustration/raster'

export const DEMO_IMAGE_WIDTH = 1200
export const DEMO_IMAGE_HEIGHT = 800

/**
 * Every motif the demo can draw. A motif is a subject, not a place: a place
 * picks one for its cover, and experiences, events, showcase items and review
 * photos pick their own (often the same subject framed closer).
 */
export const DEMO_MOTIFS = [
  'coffee',
  'pasta',
  'grill',
  'homestyle',
  'bar',
  'bakery',
  'sweets',
  'burger',
  'pizza',
  'sushi',
  'icecream',
  'deli',
  'cinema',
  'music',
  'gallery',
  'books',
  'bowling',
  'heritage',
  'park',
  'trail',
  'farm',
  'lake',
  'lookout',
  'yoga',
  'spa',
  'tattoo',
  'barber',
  'flowers',
  'pet',
  'bike',
  'ceramics',
  'sewing',
] as const

export type DemoMotif = (typeof DEMO_MOTIFS)[number]

/** `cover` is the establishment's main image; `detail` frames the subject closer; `wide` farther. */
export type DemoFraming = 'cover' | 'detail' | 'wide'

export interface DemoImageRequest {
  motif: DemoMotif
  /** Stable identity of the image; the same seed always draws the same bytes. */
  seed: string
  framing?: DemoFraming
}

interface Stage {
  r: Raster
  rng: Random
  cx: number
  cy: number
  s: number
  accent: (typeof ACCENTS)[number]
}

const at = (st: Stage, dx: number, dy: number): Point => [st.cx + dx * st.s, st.cy + dy * st.s]
const u = (st: Stage, value: number) => value * st.s

function pts(st: Stage, points: ReadonlyArray<readonly [number, number]>): Point[] {
  return points.map(([x, y]) => at(st, x, y))
}

function ellipse(
  st: Stage,
  dx: number,
  dy: number,
  rx: number,
  ry: number,
  color: Rgb,
  opacity = 1,
  rotation = 0
) {
  const [x, y] = at(st, dx, dy)
  st.r.fillEllipse(x, y, u(st, rx), u(st, ry), color, opacity, rotation)
}

function circle(st: Stage, dx: number, dy: number, radius: number, color: Rgb, opacity = 1) {
  ellipse(st, dx, dy, radius, radius, color, opacity)
}

function ring(
  st: Stage,
  dx: number,
  dy: number,
  outer: number,
  inner: number,
  color: Rgb,
  from?: number,
  to?: number
) {
  const [x, y] = at(st, dx, dy)
  st.r.fillRing(x, y, u(st, outer), u(st, inner), color, 1, from, to)
}

function rect(
  st: Stage,
  dx: number,
  dy: number,
  width: number,
  height: number,
  color: Rgb,
  radius = 0,
  rotation = 0,
  opacity = 1
) {
  const [x, y] = at(st, dx, dy)
  st.r.fillRoundRect(x, y, u(st, width), u(st, height), u(st, radius), color, opacity, rotation)
}

function poly(
  st: Stage,
  points: ReadonlyArray<readonly [number, number]>,
  color: Rgb,
  opacity = 1
) {
  st.r.fillPolygon(pts(st, points), color, opacity)
}

function stroke(
  st: Stage,
  points: ReadonlyArray<readonly [number, number]>,
  width: number,
  color: Rgb
) {
  st.r.polyline(pts(st, points), u(st, width), color)
}

function leaf(
  st: Stage,
  from: readonly [number, number],
  to: readonly [number, number],
  width: number,
  color: Rgb
) {
  st.r.fillPolygon(leafPoints(at(st, from[0], from[1]), at(st, to[0], to[1]), u(st, width)), color)
}

// ---------------------------------------------------------------------------
// Backdrops
// ---------------------------------------------------------------------------

/** The tablescape of the original illustrations: paper, a woven runner and stitches. */
function tableBackdrop(r: Raster, rng: Random, accent: Stage['accent'], side: 'left' | 'right') {
  const x = side === 'left' ? 70 : DEMO_IMAGE_WIDTH - 285
  r.fillRect(x, 0, 215, DEMO_IMAGE_HEIGHT, accent.band)
  for (let y = 0; y < DEMO_IMAGE_HEIGHT; y += 36) r.fillRect(x, y, 215, 4, accent.stripe)
  for (let lineX = x + 12; lineX < x + 210; lineX += 28)
    r.fillRect(lineX, 0, 2, DEMO_IMAGE_HEIGHT, accent.line)
  const stitchFrom = side === 'left' ? 310 : 60
  const stitchTo = side === 'left' ? 1140 : DEMO_IMAGE_WIDTH - 310
  const stitchY = rng.chance(0.5) ? 756 : 40
  for (let stitchX = stitchFrom; stitchX < stitchTo; stitchX += 24)
    r.fillRect(stitchX, stitchY, 12, 3, accent.stitch)
}

/** A front view: a wall with a subtle pattern and a counter the subject stands on. */
function wallBackdrop(r: Raster, rng: Random, wall: Rgb, counter: Rgb, counterTop = 600) {
  r.fillRect(0, 0, DEMO_IMAGE_WIDTH, counterTop, wall)
  const pattern = rng.int(0, 2)
  const line = mix(wall, INK.white, 0.18)
  if (pattern === 0) {
    for (let x = 0; x < DEMO_IMAGE_WIDTH; x += 80) r.fillRect(x, 0, 3, counterTop, line)
    for (let y = 0; y < counterTop; y += 80) r.fillRect(0, y, DEMO_IMAGE_WIDTH, 3, line)
  } else if (pattern === 1) {
    for (let x = 30; x < DEMO_IMAGE_WIDTH; x += 60) r.fillRect(x, 0, 18, counterTop, line, 0.55)
  } else {
    for (let y = 40; y < counterTop; y += 70)
      for (let x = (y / 70) % 2 ? 40 : 75; x < DEMO_IMAGE_WIDTH; x += 70)
        r.fillCircle(x, y, 5, line)
  }
  r.fillRect(0, counterTop, DEMO_IMAGE_WIDTH, DEMO_IMAGE_HEIGHT - counterTop, counter)
  r.fillRect(0, counterTop, DEMO_IMAGE_WIDTH, 16, mix(counter, INK.white, 0.25))
  r.fillRect(0, counterTop + 16, DEMO_IMAGE_WIDTH, 6, mix(counter, INK.charcoal, 0.25))
}

/** Sky, distant hills and ground for the outdoor subjects. */
function landscapeBackdrop(r: Raster, rng: Random, skyTop: Rgb, skyBottom: Rgb, horizon = 470) {
  r.fillVerticalGradient(0, horizon + 60, skyTop, skyBottom)
  const hill = mix(INK.sage, INK.skyLight, 0.35)
  r.fillEllipse(rng.between(150, 350), horizon + 40, 520, 150, hill)
  r.fillEllipse(rng.between(850, 1100), horizon + 60, 600, 170, mix(hill, INK.green, 0.15))
  r.fillRect(0, horizon + 40, DEMO_IMAGE_WIDTH, DEMO_IMAGE_HEIGHT, INK.sage)
  r.fillEllipse(600, horizon + 160, 900, 140, mix(INK.sage, INK.greenLight, 0.4))
}

function sprig(r: Raster, x: number, y: number, scale: number, color: Rgb = INK.green) {
  r.polyline(
    [
      [x, y],
      [x + 60 * scale, y - 150 * scale],
      [x + 110 * scale, y - 300 * scale],
    ],
    6 * scale,
    color
  )
  for (let index = 0; index < 6; index++) {
    const t = index / 6
    const bx = x + 110 * scale * t
    const by = y - 300 * scale * t
    r.fillPolygon(leafPoints([bx, by], [bx - 70 * scale, by - 20 * scale], 12 * scale), color)
    r.fillPolygon(
      leafPoints([bx, by], [bx + 55 * scale, by + 10 * scale], 11 * scale),
      mix(color, INK.sage, 0.35)
    )
  }
}

function sun(r: Raster, x: number, y: number, radius: number, color: Rgb = INK.gold) {
  r.fillCircle(x, y, radius * 1.35, mix(color, INK.white, 0.6), 0.5)
  r.fillCircle(x, y, radius, color)
}

function birds(r: Raster, rng: Random, count: number) {
  for (let index = 0; index < count; index++) {
    const x = rng.between(150, 1050)
    const y = rng.between(70, 220)
    const w = rng.between(14, 24)
    r.polyline(
      [
        [x - w, y - w * 0.4],
        [x, y],
        [x + w, y - w * 0.4],
      ],
      4,
      INK.charcoal
    )
  }
}

function tree(r: Raster, x: number, ground: number, height: number, canopy: Rgb) {
  r.fillRect(x - height * 0.05, ground - height * 0.55, height * 0.1, height * 0.55, INK.brown)
  r.fillCircle(x, ground - height * 0.7, height * 0.33, canopy)
  r.fillCircle(x - height * 0.2, ground - height * 0.58, height * 0.22, mix(canopy, INK.green, 0.3))
  r.fillCircle(x + height * 0.2, ground - height * 0.6, height * 0.24, mix(canopy, INK.sage, 0.25))
}

/** The araucária, the pine of Paraná: a bare trunk and stacked umbrella-shaped crowns. */
function araucaria(r: Raster, x: number, ground: number, height: number, color: Rgb) {
  r.fillRect(x - height * 0.025, ground - height, height * 0.05, height, INK.brown)
  const tiers = 3
  for (let index = 0; index < tiers; index++) {
    const y = ground - height * (0.72 + index * 0.1)
    const w = height * (0.42 - index * 0.1)
    r.fillPolygon(
      [
        ...quadraticPoints(
          [x - w, y + height * 0.03],
          [x, y - height * 0.14],
          [x + w, y + height * 0.03],
          20
        ),
        [x + w * 0.8, y + height * 0.06],
        [x - w * 0.8, y + height * 0.06],
      ],
      mix(color, INK.charcoal, index * 0.08)
    )
  }
}

/** A path that narrows with distance, drawn through the given points from near to far. */
function winding(
  st: Stage,
  through: ReadonlyArray<readonly [number, number]>,
  nearWidth: number,
  farWidth: number,
  color: Rgb
) {
  const left: Array<[number, number]> = []
  const right: Array<[number, number]> = []
  const samples = 40
  for (let index = 0; index <= samples; index++) {
    const t = index / samples
    const position = t * (through.length - 1)
    const segment = Math.min(through.length - 2, Math.floor(position))
    const local = position - segment
    const [x0, y0] = through[segment]
    const [x1, y1] = through[segment + 1]
    const eased = local * local * (3 - 2 * local)
    const x = x0 + (x1 - x0) * eased
    const y = y0 + (y1 - y0) * local
    const half = (nearWidth + (farWidth - nearWidth) * t) / 2
    left.push([x - half, y])
    right.push([x + half, y])
  }
  poly(st, [...left, ...right.reverse()], color)
}

// ---------------------------------------------------------------------------
// Shared objects
// ---------------------------------------------------------------------------

function plate(st: Stage, dx: number, dy: number, radius: number) {
  ellipse(st, dx + 10, dy + 20, radius * 1.03, radius * 0.98, INK.plateShadow)
  circle(st, dx, dy, radius, INK.white)
  ring(st, dx, dy, radius * 0.9, radius * 0.87, INK.plateRim)
}

function fork(st: Stage, dx: number, dy: number, length: number) {
  rect(st, dx - 9, dy, 18, length * 0.62, INK.grey, 9)
  rect(st, dx - 24, dy - length * 0.12, 48, length * 0.16, INK.grey, 12)
  for (let tine = 0; tine < 4; tine++)
    rect(st, dx - 22 + tine * 13, dy - length * 0.36, 8, length * 0.28, INK.grey, 4)
}

function knife(st: Stage, dx: number, dy: number, length: number) {
  rect(st, dx - 10, dy + length * 0.1, 20, length * 0.55, INK.woodDark, 10)
  poly(
    st,
    [
      [dx - 11, dy + length * 0.12],
      [dx + 11, dy + length * 0.12],
      [dx + 14, dy - length * 0.32],
      [dx - 8, dy - length * 0.4],
    ],
    INK.grey
  )
}

function leafSpray(st: Stage, dx: number, dy: number, size: number, color: Rgb = INK.green) {
  for (let index = 0; index < 5; index++) {
    const angle = st.rng.between(0, Math.PI * 2)
    leaf(
      st,
      [dx, dy],
      [dx + Math.cos(angle) * size, dy + Math.sin(angle) * size],
      size * 0.18,
      index % 2 ? color : INK.greenLight
    )
  }
}

function bowl(st: Stage, dx: number, dy: number, radius: number, rim: Rgb, inside: Rgb) {
  ellipse(st, dx + 6, dy + 12, radius, radius * 0.95, INK.plateShadow)
  circle(st, dx, dy, radius, rim)
  circle(st, dx, dy, radius * 0.8, inside)
}

function croissant(st: Stage, dx: number, dy: number, size: number, rotation: number) {
  for (let index = -3; index <= 3; index++) {
    const angle = rotation + index * 0.28
    const radius = size * (1 - Math.abs(index) * 0.13)
    const x = dx + Math.sin(angle) * size * 1.1
    const y = dy - Math.cos(angle) * size * 0.6 + Math.abs(index) * size * 0.12
    ellipse(st, x, y, radius * 0.42, radius * 0.62, index % 2 ? INK.gold : INK.goldLight, 1, angle)
    ellipse(st, x, y, radius * 0.42, radius * 0.08, INK.brownMid, 1, angle)
  }
}

function coffeeBeans(st: Stage, positions: ReadonlyArray<readonly [number, number]>) {
  for (const [x, y] of positions) {
    const rotation = st.rng.between(0, Math.PI)
    ellipse(st, x, y, 30, 21, INK.brown, 1, rotation)
    const [px, py] = at(st, x, y)
    st.r.fillPolygon(
      rotatePoints(
        [
          [px - u(st, 22), py - u(st, 2)],
          [px + u(st, 22), py - u(st, 2)],
          [px + u(st, 22), py + u(st, 3)],
          [px - u(st, 22), py + u(st, 3)],
        ],
        px,
        py,
        rotation
      ),
      INK.gold
    )
  }
}

function glass(st: Stage, dx: number, bottom: number, width: number, height: number, drink: Rgb) {
  poly(
    st,
    [
      [dx - width / 2, bottom - height],
      [dx + width / 2, bottom - height],
      [dx + width * 0.42, bottom],
      [dx - width * 0.42, bottom],
    ],
    mix(INK.skyLight, INK.white, 0.4)
  )
  poly(
    st,
    [
      [dx - width * 0.47, bottom - height * 0.8],
      [dx + width * 0.47, bottom - height * 0.8],
      [dx + width * 0.4, bottom - 6],
      [dx - width * 0.4, bottom - 6],
    ],
    drink
  )
  rect(
    st,
    dx - width * 0.36,
    bottom - height * 0.75,
    width * 0.08,
    height * 0.6,
    INK.white,
    4,
    0,
    0.45
  )
}

function flower(
  st: Stage,
  dx: number,
  dy: number,
  radius: number,
  petal: Rgb,
  heart: Rgb = INK.gold
) {
  const petals = st.rng.int(5, 8)
  const offset = st.rng.between(0, Math.PI)
  for (let index = 0; index < petals; index++) {
    const angle = offset + (index / petals) * Math.PI * 2
    ellipse(
      st,
      dx + Math.cos(angle) * radius * 0.6,
      dy + Math.sin(angle) * radius * 0.6,
      radius * 0.55,
      radius * 0.3,
      petal,
      1,
      angle
    )
  }
  circle(st, dx, dy, radius * 0.32, heart)
}

function book(
  st: Stage,
  dx: number,
  dy: number,
  width: number,
  height: number,
  cover: Rgb,
  rotation = 0
) {
  rect(st, dx + 8, dy + 10, width, height, INK.plateShadow, 8, rotation)
  rect(st, dx, dy, width, height, cover, 8, rotation)
  rect(st, dx + width * 0.08, dy, width * 0.06, height, mix(cover, INK.charcoal, 0.25), 0, rotation)
}

// ---------------------------------------------------------------------------
// Motifs
// ---------------------------------------------------------------------------

type Painter = (st: Stage) => void
type Backdrop = 'table' | 'wall' | 'landscape' | 'dark'

const MOTIFS: Record<DemoMotif, { backdrop: Backdrop; paint: Painter }> = {
  coffee: {
    backdrop: 'table',
    paint(st) {
      plate(st, 0, 0, 300)
      ring(st, 218, 8, 98, 66, INK.terracotta)
      circle(st, -25, -10, 206, INK.terracotta)
      circle(st, -25, -15, 180, INK.gold)
      circle(st, -25, -15, 164, INK.brown)
      circle(st, -25, -5, 104, INK.brownMid)
      // Latte heart.
      circle(st, -55, -25, 36, INK.white)
      circle(st, 5, -25, 36, INK.white)
      poly(
        st,
        [
          [-88, -12],
          [38, -12],
          [-25, 60],
        ],
        INK.white
      )
      if (st.rng.chance(0.6)) croissant(st, -300, 250, 70, -0.6)
      coffeeBeans(st, [
        [250, -250],
        [300, -200],
        [320, -270],
      ])
    },
  },
  pasta: {
    backdrop: 'table',
    paint(st) {
      plate(st, 0, 0, 300)
      circle(st, 0, 0, 220, mix(INK.white, INK.plateRim, 0.5))
      for (let index = 0; index < 14; index++) {
        const radius = st.rng.between(40, 190)
        const from = st.rng.between(0, Math.PI * 2)
        ring(
          st,
          st.rng.between(-25, 25),
          st.rng.between(-25, 25),
          radius,
          radius - 11,
          index % 2 ? INK.gold : INK.goldLight,
          from,
          from + st.rng.between(2, 4.5)
        )
      }
      for (let index = 0; index < 5; index++)
        circle(
          st,
          st.rng.between(-45, 45),
          st.rng.between(-45, 45),
          st.rng.between(35, 55),
          INK.red
        )
      circle(st, 0, 0, 55, INK.terracotta)
      leaf(st, [10, -20], [80, -70], 16, INK.green)
      leaf(st, [0, -10], [-60, -80], 14, INK.greenLight)
      for (let index = 0; index < 12; index++)
        circle(st, st.rng.between(-120, 120), st.rng.between(-120, 120), 5, INK.white)
      fork(st, 380, 20, 330)
    },
  },
  grill: {
    backdrop: 'table',
    paint(st) {
      rect(st, -330, -230, 660, 460, INK.woodDark, 60, -0.08)
      rect(st, -310, -210, 620, 420, INK.wood, 50, -0.08)
      poly(
        st,
        [
          [-200, -120],
          [120, -150],
          [190, -20],
          [140, 120],
          [-150, 140],
          [-230, 20],
        ],
        INK.brown
      )
      poly(
        st,
        [
          [-185, -105],
          [110, -132],
          [170, -20],
          [125, 105],
          [-138, 124],
          [-210, 20],
        ],
        INK.brownMid
      )
      for (let index = 0; index < 5; index++)
        stroke(
          st,
          [
            [-170 + index * 70, -110],
            [-120 + index * 70, 110],
          ],
          12,
          INK.brown
        )
      for (const [x, y] of [
        [230, 120],
        [260, -60],
        [200, 170],
        [-250, 170],
      ] as const) {
        circle(st, x, y, 42, INK.gold)
        circle(st, x - 8, y - 8, 30, INK.goldLight)
      }
      leafSpray(st, -250, -150, 70)
      bowl(st, 360, -200, 70, INK.terracotta, INK.greenLight)
      for (let index = 0; index < 10; index++)
        circle(st, 360 + st.rng.between(-40, 40), -200 + st.rng.between(-40, 40), 6, INK.green)
    },
  },
  homestyle: {
    backdrop: 'table',
    paint(st) {
      plate(st, 0, 0, 310)
      for (let index = 0; index < 9; index++)
        circle(st, -90 + st.rng.between(-50, 50), -70 + st.rng.between(-45, 45), 70, INK.cream)
      ellipse(st, 100, -60, 115, 95, INK.brown)
      for (let index = 0; index < 18; index++)
        ellipse(
          st,
          100 + st.rng.between(-85, 85),
          -60 + st.rng.between(-65, 65),
          12,
          8,
          INK.brownMid,
          1,
          st.rng.between(0, 3)
        )
      ellipse(st, -60, 130, 110, 70, INK.goldLight)
      for (let index = 0; index < 20; index++)
        circle(st, -60 + st.rng.between(-90, 90), 130 + st.rng.between(-50, 50), 4, INK.gold)
      leafSpray(st, 120, 130, 80, INK.greenLight)
      for (const [x, y] of [
        [170, 100],
        [90, 160],
      ] as const) {
        circle(st, x, y, 32, INK.red)
        circle(st, x, y, 20, mix(INK.red, INK.pink, 0.4))
      }
      fork(st, -390, 10, 320)
      knife(st, 390, 10, 320)
    },
  },
  bar: {
    backdrop: 'dark',
    paint(st) {
      for (let index = 0; index < 12; index++) {
        const x = -540 + index * 95
        const y = -330 + Math.sin(index * 0.9) * 18
        circle(st, x, y, 14, INK.goldLight)
        circle(st, x, y, 26, INK.gold, 0.25)
      }
      stroke(
        st,
        [
          [-560, -345],
          [-300, -320],
          [0, -350],
          [300, -320],
          [560, -345],
        ],
        3,
        INK.grey
      )
      // A mug of beer.
      rect(st, -310, -60, 190, 250, mix(INK.gold, INK.goldLight, 0.3), 24)
      ring(st, -110, 60, 70, 42, mix(INK.skyLight, INK.white, 0.3), -Math.PI / 2, Math.PI / 2)
      for (let index = 0; index < 5; index++) circle(st, -290 + index * 38, -65, 40, INK.white)
      for (let index = 0; index < 8; index++)
        circle(st, -270 + st.rng.between(0, 150), st.rng.between(0, 170), 5, INK.goldLight)
      // A caipirinha and a bottle.
      glass(st, 60, 190, 150, 180, mix(INK.skyLight, INK.greenLight, 0.25))
      for (const [x, y] of [
        [35, 110],
        [85, 150],
      ] as const) {
        circle(st, x, y, 26, INK.greenLight)
        circle(st, x, y, 18, INK.sage)
      }
      rect(st, 200, -150, 90, 340, INK.green, 30)
      rect(st, 225, -240, 40, 110, INK.green, 12)
      rect(st, 205, -30, 80, 90, INK.cream, 8)
      rect(st, 225, -5, 40, 12, INK.terracotta, 4)
      // Snacks.
      ellipse(st, 420, 170, 140, 40, INK.terracotta)
      for (let index = 0; index < 14; index++)
        ellipse(
          st,
          420 + st.rng.between(-100, 100),
          140 + st.rng.between(-25, 15),
          18,
          12,
          INK.goldLight,
          1,
          st.rng.between(0, 3)
        )
    },
  },
  bakery: {
    backdrop: 'table',
    paint(st) {
      rect(st, -360, -250, 720, 500, INK.woodDark, 40, 0.05)
      rect(st, -340, -230, 680, 460, INK.wood, 36, 0.05)
      ellipse(st, -40, -40, 210, 140, INK.brown)
      ellipse(st, -45, -52, 200, 130, INK.terracotta)
      ellipse(st, -60, -68, 176, 108, INK.gold)
      for (let index = 0; index < 5; index++)
        poly(
          st,
          [
            [-190 + index * 60, -80],
            [-163 + index * 60, -120],
            [-133 + index * 60, -20],
            [-154 + index * 60, 7],
          ],
          INK.goldLight
        )
      for (const [y, rotation] of [
        [150, -0.12],
        [210, -0.08],
      ] as const) {
        ellipse(st, 30, y, 290, 40, INK.brownMid, 1, rotation)
        ellipse(st, 30, y - 6, 280, 32, INK.gold, 1, rotation)
        for (let index = 0; index < 6; index++)
          ellipse(
            st,
            -180 + index * 80,
            y - 10 - (index * 80 - 200) * rotation,
            26,
            8,
            INK.goldLight,
            1,
            rotation - 0.6
          )
      }
      for (const [x, y] of [
        [240, -150],
        [280, -40],
      ] as const) {
        circle(st, x, y, 60, INK.brownMid)
        circle(st, x - 6, y - 6, 50, INK.gold)
        stroke(
          st,
          [
            [x - 30, y],
            [x + 25, y - 10],
          ],
          7,
          INK.goldLight
        )
      }
    },
  },
  sweets: {
    backdrop: 'wall',
    paint(st) {
      // Cake on a stand.
      rect(st, -320, 160, 260, 26, INK.white, 12)
      rect(st, -200, 110, 20, 60, INK.plateRim, 4)
      rect(st, -300, -60, 220, 180, INK.pink, 20)
      rect(st, -300, -5, 220, 22, INK.brown)
      rect(st, -300, 55, 220, 22, INK.brown)
      for (let index = 0; index < 6; index++) circle(st, -285 + index * 38, -62, 22, INK.cream)
      circle(st, -190, -95, 22, INK.red)
      // Cupcakes.
      for (const [x, color] of [
        [20, INK.lavender],
        [150, INK.cream],
        [280, INK.pink],
      ] as const) {
        poly(
          st,
          [
            [x - 55, 90],
            [x + 55, 90],
            [x + 42, 180],
            [x - 42, 180],
          ],
          INK.terracotta
        )
        for (let index = 0; index < 4; index++)
          rect(st, x - 40 + index * 24, 95, 8, 80, INK.terracottaLight)
        circle(st, x - 30, 70, 38, color)
        circle(st, x + 30, 70, 38, color)
        circle(st, x, 40, 42, mix(color, INK.white, 0.25))
        circle(st, x, 5, 14, INK.red)
      }
      // Brigadeiros.
      for (let index = 0; index < 5; index++) {
        const x = -250 + index * 120
        rect(st, x - 34, 250, 68, 34, INK.goldLight, 8)
        circle(st, x, 240, 30, INK.brown)
        for (let dot = 0; dot < 6; dot++)
          circle(st, x + st.rng.between(-18, 18), 240 + st.rng.between(-18, 18), 3, INK.gold)
      }
    },
  },
  burger: {
    backdrop: 'wall',
    paint(st) {
      rect(st, -380, 170, 520, 40, INK.woodDark, 16)
      // The stack.
      rect(st, -300, 110, 300, 60, INK.gold, 28)
      rect(st, -310, 60, 320, 60, INK.brown, 26)
      poly(
        st,
        [
          [-320, 60],
          [20, 60],
          [-10, 100],
          [-80, 70],
          [-160, 105],
          [-240, 70],
          [-300, 100],
        ],
        INK.goldLight
      )
      for (let index = 0; index < 8; index++) circle(st, -300 + index * 42, 45, 26, INK.greenLight)
      rect(st, -300, 20, 300, 26, INK.red, 12)
      poly(
        st,
        [
          [-300, -150],
          [0, -150],
          [20, 20],
          [-320, 20],
        ],
        INK.gold
      )
      ellipse(st, -150, -90, 170, 110, INK.gold)
      for (let index = 0; index < 12; index++)
        ellipse(
          st,
          -150 + st.rng.between(-120, 120),
          -120 + st.rng.between(-60, 50),
          9,
          5,
          INK.cream,
          1,
          st.rng.between(0, 3)
        )
      // Fries.
      for (let index = 0; index < 9; index++)
        rect(
          st,
          150 + index * 20,
          -40 - (index % 3) * 30,
          16,
          170,
          INK.goldLight,
          4,
          (index - 4) * 0.05
        )
      poly(
        st,
        [
          [130, 30],
          [330, 30],
          [310, 170],
          [150, 170],
        ],
        INK.red
      )
      rect(st, 185, 70, 90, 50, INK.white, 25)
      // A soda.
      rect(st, 380, -40, 120, 210, INK.terracotta, 14)
      rect(st, 380, 30, 120, 50, INK.white, 0)
      rect(st, 430, -120, 14, 90, INK.cream, 6, 0.2)
    },
  },
  pizza: {
    backdrop: 'table',
    paint(st) {
      circle(st, 10, 16, 320, INK.plateShadow)
      circle(st, 0, 0, 320, INK.woodDark)
      circle(st, 0, 0, 300, INK.wood)
      circle(st, 0, 0, 270, INK.gold)
      circle(st, 0, 0, 238, INK.red)
      for (let index = 0; index < 16; index++)
        circle(
          st,
          st.rng.between(-170, 170),
          st.rng.between(-170, 170),
          st.rng.between(35, 60),
          INK.goldLight
        )
      for (let index = 0; index < 9; index++) {
        const angle = st.rng.between(0, Math.PI * 2)
        const distance = st.rng.between(40, 190)
        circle(st, Math.cos(angle) * distance, Math.sin(angle) * distance, 26, INK.terracotta)
      }
      for (let index = 0; index < 7; index++)
        ring(st, st.rng.between(-170, 170), st.rng.between(-170, 170), 12, 6, INK.charcoal)
      for (let index = 0; index < 5; index++) {
        const x = st.rng.between(-150, 150)
        const y = st.rng.between(-150, 150)
        leaf(st, [x, y], [x + 40, y - 30], 12, INK.green)
      }
      for (let index = 0; index < 4; index++) {
        const angle = (index / 4) * Math.PI * 2 + 0.3
        stroke(
          st,
          [
            [0, 0],
            [Math.cos(angle) * 270, Math.sin(angle) * 270],
          ],
          4,
          INK.brownMid
        )
      }
      rect(st, 300, -40, 190, 70, INK.woodDark, 30)
    },
  },
  sushi: {
    backdrop: 'table',
    paint(st) {
      rect(st, -360, -170, 720, 340, INK.charcoal, 30, -0.06)
      for (let index = 0; index < 4; index++) {
        const x = -270 + index * 110
        circle(st, x, -40, 50, INK.ink)
        circle(st, x, -40, 42, INK.white)
        circle(st, x, -40, 18, index % 2 ? INK.terracottaLight : INK.greenLight)
      }
      for (let index = 0; index < 3; index++) {
        const x = 170 + index * 0
        const y = -90 + index * 95
        ellipse(st, x, y, 95, 40, INK.white)
        ellipse(st, x, y - 8, 100, 36, INK.terracottaLight)
        for (let line = 0; line < 4; line++)
          stroke(
            st,
            [
              [x - 60 + line * 35, y - 30],
              [x - 40 + line * 35, y + 14],
            ],
            5,
            INK.blush
          )
      }
      ellipse(st, -150, 90, 60, 36, INK.pink)
      ellipse(st, -110, 100, 50, 30, INK.blush)
      stroke(
        st,
        [
          [-420, 250],
          [120, 190],
        ],
        14,
        INK.wood
      )
      stroke(
        st,
        [
          [-420, 280],
          [120, 225],
        ],
        14,
        INK.woodDark
      )
      bowl(st, 360, 230, 70, INK.white, INK.brown)
    },
  },
  icecream: {
    backdrop: 'wall',
    paint(st) {
      for (const [x, colors] of [
        [-260, [INK.pink, INK.cream]],
        [-40, [INK.brown, INK.sage]],
        [180, [INK.gold, INK.lavender]],
      ] as const) {
        poly(
          st,
          [
            [x - 70, -20],
            [x + 70, -20],
            [x, 190],
          ],
          INK.gold
        )
        for (let line = 0; line < 4; line++) {
          stroke(
            st,
            [
              [x - 60 + line * 30, -15],
              [x - 10 + line * 18, 140],
            ],
            4,
            INK.brownMid
          )
        }
        circle(st, x, -60, 80, colors[0])
        circle(st, x, -160, 66, colors[1])
        circle(st, x + 30, -30, 20, colors[0])
        circle(st, x - 40, -25, 16, colors[0])
      }
      for (const [x, color] of [
        [380, INK.terracottaLight],
        [470, INK.greenLight],
      ] as const) {
        rect(st, x - 40, -170, 80, 200, color, 38)
        rect(st, x - 8, 20, 16, 110, INK.wood, 6)
      }
    },
  },
  deli: {
    backdrop: 'wall',
    paint(st) {
      for (const shelf of [-230, -20]) rect(st, -520, shelf, 1040, 22, INK.woodDark)
      for (let index = 0; index < 7; index++) {
        const x = -480 + index * 140
        const content = st.rng.pick([
          INK.terracotta,
          INK.gold,
          INK.red,
          INK.greenLight,
          INK.brownMid,
        ])
        rect(st, x, -370, 100, 140, mix(INK.skyLight, INK.white, 0.5), 18)
        rect(st, x + 8, -330, 84, 96, content, 12)
        rect(st, x - 4, -390, 108, 30, st.rng.pick([INK.ink, INK.terracotta, INK.gold]), 8)
        rect(st, x + 18, -300, 64, 36, INK.cream, 4)
      }
      for (let index = 0; index < 6; index++) {
        const x = -470 + index * 170
        const tall = st.rng.chance(0.5)
        rect(
          st,
          x,
          tall ? -200 : -160,
          60,
          tall ? 180 : 140,
          st.rng.pick([INK.green, INK.brown, INK.red]),
          18
        )
        rect(st, x + 18, tall ? -250 : -200, 24, 60, INK.charcoal, 6)
        rect(st, x + 6, -110, 48, 40, INK.cream, 4)
      }
      // Cheese and grapes on the counter.
      circle(st, -220, 160, 110, INK.goldLight)
      circle(st, -220, 160, 90, INK.gold)
      poly(
        st,
        [
          [-60, 200],
          [140, 200],
          [140, 100],
        ],
        INK.goldLight
      )
      for (let index = 0; index < 6; index++)
        circle(st, 60 + st.rng.between(0, 60), 150 + st.rng.between(0, 40), 10, INK.cream)
      for (let index = 0; index < 14; index++)
        circle(
          st,
          300 + (index % 4) * 34 + (Math.floor(index / 4) % 2) * 17,
          110 + Math.floor(index / 4) * 30,
          20,
          INK.lavender
        )
      stroke(
        st,
        [
          [350, 110],
          [360, 60],
        ],
        8,
        INK.greenLight
      )
    },
  },
  cinema: {
    backdrop: 'dark',
    paint(st) {
      poly(
        st,
        [
          [-200, -400],
          [-120, -400],
          [-10, 200],
          [-330, 200],
        ],
        INK.goldLight,
        0.18
      )
      // Clapperboard.
      rect(st, -440, -60, 360, 250, INK.charcoal, 12)
      for (let line = 0; line < 3; line++) rect(st, -410, 10 + line * 50, 300, 10, INK.grey, 4)
      const board = rotatePoints(
        pts(st, [
          [-440, -130],
          [-80, -130],
          [-80, -70],
          [-440, -70],
        ]),
        ...at(st, -440, -70),
        -0.22
      )
      st.r.fillPolygon(board, INK.white)
      for (let index = 0; index < 5; index++) {
        const stripe = rotatePoints(
          pts(st, [
            [-430 + index * 72, -130],
            [-395 + index * 72, -130],
            [-425 + index * 72, -70],
            [-460 + index * 72, -70],
          ]),
          ...at(st, -440, -70),
          -0.22
        )
        st.r.fillPolygon(stripe, INK.charcoal)
      }
      // Popcorn.
      poly(
        st,
        [
          [20, -40],
          [260, -40],
          [230, 230],
          [50, 230],
        ],
        INK.white
      )
      for (let index = 0; index < 4; index++)
        poly(
          st,
          [
            [40 + index * 60, -40],
            [70 + index * 60, -40],
            [78 + index * 50, 230],
            [58 + index * 50, 230],
          ],
          INK.red
        )
      for (let index = 0; index < 16; index++)
        circle(
          st,
          30 + st.rng.between(0, 220),
          -60 - st.rng.between(0, 70),
          st.rng.between(22, 34),
          index % 3 ? INK.cream : INK.goldLight
        )
      // A film reel.
      circle(st, 400, 20, 150, INK.grey)
      circle(st, 400, 20, 36, INK.charcoal)
      for (let index = 0; index < 6; index++) {
        const angle = (index / 6) * Math.PI * 2
        circle(st, 400 + Math.cos(angle) * 90, 20 + Math.sin(angle) * 90, 34, INK.charcoal)
      }
      for (let index = 0; index < 3; index++)
        rect(st, 200 + index * 40, 200 - index * 12, 150, 60, INK.gold, 8, -0.2 + index * 0.12)
    },
  },
  music: {
    backdrop: 'dark',
    paint(st) {
      for (const [x, color] of [
        [-360, INK.gold],
        [0, INK.pink],
        [360, INK.sky],
      ] as const)
        poly(
          st,
          [
            [x - 30, -400],
            [x + 30, -400],
            [x + 190, 250],
            [x - 190, 250],
          ],
          color,
          0.16
        )
      rect(st, -600, 220, 1200, 200, INK.brown)
      rect(st, -600, 220, 1200, 14, INK.woodDark)
      // Guitar.
      const angle = -0.5
      const neck = rotatePoints(
        pts(st, [
          [-120, -330],
          [-90, -330],
          [-90, 40],
          [-120, 40],
        ]),
        ...at(st, -105, 60),
        angle
      )
      st.r.fillPolygon(neck, INK.woodDark)
      ellipse(st, -60, 110, 150, 130, INK.terracotta, 1, angle)
      ellipse(st, -150, -20, 115, 100, INK.terracotta, 1, angle)
      circle(st, -100, 50, 42, INK.charcoal)
      ellipse(st, -30, 140, 50, 16, INK.brown, 1, angle)
      // Microphone.
      stroke(
        st,
        [
          [300, 230],
          [300, -60],
        ],
        10,
        INK.grey
      )
      stroke(
        st,
        [
          [240, 230],
          [360, 230],
        ],
        10,
        INK.grey
      )
      ellipse(st, 300, -110, 42, 56, INK.charcoal)
      for (const [x, y] of [
        [120, -260],
        [200, -300],
        [430, -220],
      ] as const) {
        ellipse(st, x, y, 26, 20, INK.goldLight, 1, -0.4)
        stroke(
          st,
          [
            [x + 22, y - 6],
            [x + 22, y - 110],
          ],
          7,
          INK.goldLight
        )
      }
    },
  },
  gallery: {
    backdrop: 'wall',
    paint(st) {
      const frames = [
        [-470, -330, 300, 380],
        [-110, -300, 260, 200],
        [220, -360, 260, 330],
      ] as const
      for (const [x, y, w, h] of frames) {
        rect(st, x + 10, y + 14, w, h, mix(INK.paperCool, INK.charcoal, 0.2))
        rect(st, x, y, w, h, st.rng.pick([INK.gold, INK.charcoal, INK.woodDark]))
        rect(st, x + 18, y + 18, w - 36, h - 36, INK.cream)
        const accents = [INK.terracotta, INK.ink, INK.gold, INK.greenLight, INK.pink]
        for (let index = 0; index < 4; index++) {
          const color = st.rng.pick(accents)
          const shape = st.rng.int(0, 2)
          const sx = x + 40 + st.rng.between(0, w - 120)
          const sy = y + 40 + st.rng.between(0, h - 120)
          if (shape === 0) circle(st, sx + 30, sy + 30, st.rng.between(20, 45), color)
          else if (shape === 1)
            rect(st, sx, sy, st.rng.between(40, 80), st.rng.between(40, 80), color)
          else
            poly(
              st,
              [
                [sx, sy + 70],
                [sx + 40, sy],
                [sx + 80, sy + 70],
              ],
              color
            )
        }
      }
      rect(st, -200, 110, 340, 36, INK.woodDark, 8)
      rect(st, -180, 146, 20, 70, INK.woodDark)
      rect(st, 100, 146, 20, 70, INK.woodDark)
      circle(st, 380, 90, 60, INK.greenLight)
      rect(st, 350, 120, 60, 100, INK.terracotta, 10)
    },
  },
  books: {
    backdrop: 'table',
    paint(st) {
      const colors = [INK.terracotta, INK.ink, INK.green, INK.gold, INK.brownMid]
      for (let index = 0; index < 5; index++)
        book(
          st,
          -330 + index * 6,
          -230 + index * 44,
          300,
          44,
          colors[index % colors.length],
          st.rng.between(-0.05, 0.05)
        )
      // An open book.
      poly(
        st,
        [
          [-40, 60],
          [180, 40],
          [190, 290],
          [-30, 300],
        ],
        INK.white
      )
      poly(
        st,
        [
          [180, 40],
          [400, 60],
          [390, 300],
          [190, 290],
        ],
        INK.cream
      )
      stroke(
        st,
        [
          [183, 42],
          [190, 292],
        ],
        4,
        INK.plateShadow
      )
      for (let line = 0; line < 7; line++) {
        stroke(
          st,
          [
            [-10, 100 + line * 26],
            [160, 90 + line * 26],
          ],
          5,
          INK.grey
        )
        stroke(
          st,
          [
            [210, 90 + line * 26],
            [370, 100 + line * 26],
          ],
          5,
          INK.grey
        )
      }
      // Reading glasses.
      ring(st, 200, -120, 60, 48, INK.charcoal)
      ring(st, 340, -120, 60, 48, INK.charcoal)
      stroke(
        st,
        [
          [258, -128],
          [282, -128],
        ],
        8,
        INK.charcoal
      )
      circle(st, -300, 250, 70, INK.terracotta)
      circle(st, -300, 250, 55, INK.brown)
    },
  },
  bowling: {
    backdrop: 'wall',
    paint(st) {
      for (let index = 0; index < 7; index++)
        stroke(
          st,
          [
            [-520 + index * 170, 400],
            [-160 + index * 55, 110],
          ],
          3,
          INK.woodDark
        )
      const pins = [
        [0, -40],
        [-70, -10],
        [70, -10],
        [-140, 20],
        [0, 20],
        [140, 20],
      ] as const
      for (const [x, y] of pins) {
        ellipse(st, x, y + 60, 34, 56, INK.white)
        ellipse(st, x, y - 20, 20, 30, INK.white)
        rect(st, x - 20, y + 5, 40, 12, INK.red)
        rect(st, x - 22, y + 24, 44, 8, INK.red)
      }
      circle(st, 330, 180, 110, INK.ink)
      circle(st, 300, 140, 16, INK.charcoal)
      circle(st, 345, 130, 16, INK.charcoal)
      circle(st, 330, 175, 16, INK.charcoal)
      circle(st, -360, 170, 90, INK.terracotta)
      circle(st, -385, 140, 12, INK.brown)
      circle(st, -345, 135, 12, INK.brown)
    },
  },
  heritage: {
    backdrop: 'landscape',
    paint(st) {
      rect(st, -330, 150, 660, 40, INK.cream)
      rect(st, -300, 120, 600, 40, INK.paperWarm)
      rect(st, -270, -120, 540, 250, INK.paperWarm)
      poly(
        st,
        [
          [-310, -120],
          [310, -120],
          [0, -270],
        ],
        INK.terracotta
      )
      poly(
        st,
        [
          [-250, -135],
          [250, -135],
          [0, -250],
        ],
        INK.cream
      )
      for (let index = 0; index < 5; index++)
        rect(st, -240 + index * 110, -110, 40, 230, INK.white, 6)
      rect(st, -40, 10, 80, 110, INK.brown, 40)
      tree(st.r, ...at(st, -440, 190), u(st, 280), INK.green)
      tree(st.r, ...at(st, 450, 190), u(st, 240), INK.greenLight)
    },
  },
  park: {
    backdrop: 'landscape',
    paint(st) {
      winding(
        st,
        [
          [-40, 400],
          [120, 300],
          [-60, 220],
          [40, 150],
        ],
        150,
        30,
        INK.cream
      )
      for (let index = 0; index < 5; index++) {
        const x = -480 + index * 240 + st.rng.between(-40, 40)
        tree(
          st.r,
          ...at(st, x, 150 + st.rng.between(-20, 40)),
          u(st, st.rng.between(220, 320)),
          st.rng.pick([INK.green, INK.greenLight, INK.sage])
        )
      }
      rect(st, 170, 190, 190, 22, INK.woodDark, 6)
      rect(st, 170, 150, 190, 18, INK.wood, 6)
      rect(st, 185, 212, 14, 50, INK.charcoal)
      rect(st, 330, 212, 14, 50, INK.charcoal)
      for (let index = 0; index < 10; index++)
        flower(
          st,
          st.rng.between(-560, 560),
          st.rng.between(230, 380),
          14,
          st.rng.pick([INK.pink, INK.white, INK.gold])
        )
    },
  },
  trail: {
    backdrop: 'landscape',
    paint(st) {
      poly(
        st,
        [
          [-600, 150],
          [-250, -250],
          [60, 150],
        ],
        mix(INK.brownMid, INK.sage, 0.3)
      )
      poly(
        st,
        [
          [-250, -250],
          [-170, -150],
          [-230, -140],
          [-300, -180],
        ],
        mix(INK.brownMid, INK.cream, 0.45)
      )
      poly(
        st,
        [
          [-50, 150],
          [260, -180],
          [600, 150],
        ],
        mix(INK.brownMid, INK.green, 0.25)
      )
      winding(
        st,
        [
          [-160, 400],
          [80, 290],
          [-40, 190],
          [110, 100],
        ],
        110,
        16,
        mix(INK.cream, INK.wood, 0.3)
      )
      for (let index = 0; index < 4; index++)
        araucaria(
          st.r,
          ...at(st, -520 + index * 330 + st.rng.between(-30, 30), 330),
          u(st, st.rng.between(280, 360)),
          INK.green
        )
      stroke(
        st,
        [
          [260, -180],
          [260, -260],
        ],
        6,
        INK.charcoal
      )
      poly(
        st,
        [
          [260, -260],
          [330, -238],
          [260, -215],
        ],
        INK.terracotta
      )
    },
  },
  farm: {
    backdrop: 'landscape',
    paint(st) {
      for (let row = 0; row < 6; row++) {
        const y = 170 + row * 42
        stroke(
          st,
          [
            [-600, y + 20],
            [-200, y - 10],
            [200, y + 10],
            [600, y - 15],
          ],
          16,
          row % 2 ? INK.green : INK.greenLight
        )
      }
      rect(st, 150, -80, 260, 200, INK.red)
      poly(
        st,
        [
          [130, -80],
          [430, -80],
          [280, -200],
        ],
        INK.brown
      )
      rect(st, 240, 20, 80, 100, INK.cream)
      stroke(
        st,
        [
          [240, 20],
          [320, 120],
        ],
        6,
        INK.red
      )
      stroke(
        st,
        [
          [320, 20],
          [240, 120],
        ],
        6,
        INK.red
      )
      for (let post = 0; post < 9; post++) rect(st, -560 + post * 70, 90, 14, 70, INK.wood)
      stroke(
        st,
        [
          [-570, 105],
          [0, 105],
        ],
        6,
        INK.wood
      )
      stroke(
        st,
        [
          [-570, 135],
          [0, 135],
        ],
        6,
        INK.wood
      )
      tree(st.r, ...at(st, -260, 100), u(st, 260), INK.green)
      for (let index = 0; index < 9; index++)
        circle(st, -330 + st.rng.between(0, 150), -60 + st.rng.between(0, 110), 10, INK.red)
    },
  },
  lake: {
    backdrop: 'landscape',
    paint(st) {
      ellipse(st, 0, 200, 640, 180, INK.teal)
      ellipse(st, 0, 190, 600, 150, mix(INK.teal, INK.sky, 0.35))
      for (let index = 0; index < 8; index++) {
        const x = st.rng.between(-420, 420)
        const y = st.rng.between(130, 280)
        ring(st, x, y, 60, 54, INK.white, Math.PI * 1.1, Math.PI * 1.9)
      }
      poly(
        st,
        [
          [200, 200],
          [620, 170],
          [620, 260],
          [240, 260],
        ],
        INK.woodDark
      )
      for (let plank = 0; plank < 8; plank++)
        stroke(
          st,
          [
            [250 + plank * 48, 205],
            [260 + plank * 48, 255],
          ],
          4,
          INK.brown
        )
      stroke(
        st,
        [
          [330, 200],
          [60, -80],
        ],
        5,
        INK.charcoal
      )
      stroke(
        st,
        [
          [60, -80],
          [30, 160],
        ],
        2,
        INK.grey
      )
      ellipse(st, -200, 110, 60, 26, INK.goldLight, 1, -0.5)
      poly(
        st,
        [
          [-250, 140],
          [-290, 120],
          [-280, 170],
        ],
        INK.goldLight
      )
      for (let index = 0; index < 4; index++)
        tree(st.r, ...at(st, -560 + index * 90, 60), u(st, 180), INK.green)
    },
  },
  lookout: {
    backdrop: 'landscape',
    paint(st) {
      sun(st.r, ...at(st, 160, -80), u(st, 90), INK.goldLight)
      for (const [y, color] of [
        [40, mix(INK.ink, INK.lavender, 0.5)],
        [110, mix(INK.ink, INK.green, 0.4)],
        [190, INK.ink],
      ] as const) {
        const points: Array<[number, number]> = [[-620, 420]]
        for (let x = -620; x <= 620; x += 80)
          points.push([x, y + Math.sin(x * 0.01 + y) * 40 + st.rng.between(-15, 15)])
        points.push([620, 420])
        poly(st, points, color)
      }
      for (let index = 0; index < 3; index++)
        araucaria(
          st.r,
          ...at(st, -500 + index * 90, 200),
          u(st, 260 + index * 30),
          mix(INK.charcoal, INK.green, 0.3)
        )
      rect(st, -620, 300, 1240, 16, INK.woodDark)
      rect(st, -620, 250, 1240, 12, INK.woodDark)
      for (let post = 0; post < 10; post++) rect(st, -600 + post * 130, 240, 18, 160, INK.woodDark)
    },
  },
  yoga: {
    backdrop: 'table',
    paint(st) {
      const mat = st.rng.pick([INK.teal, INK.lavender, INK.sage])
      rect(st, -250, -330, 300, 660, mix(mat, INK.charcoal, 0.2), 30)
      rect(st, -240, -320, 280, 640, mat, 26)
      for (let line = 0; line < 2; line++)
        rect(st, -240, -300 + line * 590, 280, 14, mix(mat, INK.white, 0.3))
      // Rolled mat.
      rect(st, 150, -260, 120, 360, mix(mat, INK.terracotta, 0.5), 60, 0.12)
      ring(st, 210, 110, 60, 45, mix(mat, INK.charcoal, 0.2))
      circle(st, 210, 110, 45, mix(mat, INK.terracotta, 0.5))
      ring(st, 210, 110, 30, 22, mix(mat, INK.charcoal, 0.2))
      // Plant, stones and a candle.
      circle(st, 330, 260, 80, INK.terracotta)
      circle(st, 330, 260, 64, INK.brown)
      for (let index = 0; index < 7; index++) {
        const angle = (index / 7) * Math.PI * 2
        leaf(
          st,
          [330, 260],
          [330 + Math.cos(angle) * 140, 260 + Math.sin(angle) * 140],
          26,
          index % 2 ? INK.green : INK.greenLight
        )
      }
      for (const [x, y, r] of [
        [-360, 200, 50],
        [-400, 260, 38],
        [-330, 280, 30],
      ] as const)
        ellipse(st, x, y, r * 1.2, r, INK.grey)
      circle(st, -360, -230, 44, INK.cream)
      ellipse(st, -360, -236, 10, 18, INK.gold)
    },
  },
  spa: {
    backdrop: 'table',
    paint(st) {
      for (const [x, y, color] of [
        [-220, -120, INK.white],
        [-80, -140, INK.blush],
        [-150, 10, INK.cream],
      ] as const) {
        circle(st, x + 6, y + 10, 82, INK.plateShadow)
        circle(st, x, y, 82, color)
        for (let line = 1; line < 4; line++)
          ring(st, x, y, 82 - line * 18, 78 - line * 18, mix(color, INK.plateShadow, 0.6))
      }
      bowl(st, 190, -40, 150, INK.white, mix(INK.teal, INK.skyLight, 0.5))
      for (let index = 0; index < 5; index++)
        flower(
          st,
          150 + st.rng.between(0, 90),
          -80 + st.rng.between(0, 90),
          34,
          st.rng.pick([INK.pink, INK.blush, INK.white])
        )
      for (const [x, y, r] of [
        [-250, 230, 60],
        [-150, 250, 48],
        [-60, 240, 38],
      ] as const)
        ellipse(st, x, y, r * 1.3, r, st.rng.pick([INK.charcoal, INK.grey]))
      for (const [x, y] of [
        [250, 250],
        [360, 200],
      ] as const) {
        circle(st, x, y, 40, INK.cream)
        ellipse(st, x, y - 4, 9, 16, INK.gold)
      }
      leafSpray(st, 380, -250, 110)
    },
  },
  tattoo: {
    backdrop: 'table',
    paint(st) {
      rect(st, -330, -290, 460, 580, INK.plateShadow, 6, -0.06)
      rect(st, -340, -300, 460, 580, INK.white, 6, -0.06)
      // A rose, an anchor and a swallow drawn as flash.
      ring(st, -210, -160, 60, 50, INK.charcoal)
      ring(st, -210, -160, 34, 26, INK.red)
      leaf(st, [-210, -100], [-280, -50], 20, INK.green)
      leaf(st, [-210, -100], [-140, -50], 20, INK.green)
      stroke(
        st,
        [
          [-20, -230],
          [-20, -80],
        ],
        12,
        INK.charcoal
      )
      stroke(
        st,
        [
          [-70, -200],
          [30, -200],
        ],
        10,
        INK.charcoal
      )
      st.r.polyline(
        arcPoints(...at(st, -20, -120), u(st, 60), Math.PI * 0.1, Math.PI * 0.9),
        u(st, 12),
        INK.charcoal
      )
      poly(
        st,
        [
          [-260, 100],
          [-120, 40],
          [-40, 120],
          [-120, 90],
          [-200, 180],
        ],
        INK.ink
      )
      poly(
        st,
        [
          [-120, 40],
          [-60, -10],
          [-80, 70],
        ],
        INK.ink
      )
      circle(st, -60, 170, 50, INK.red)
      circle(st, -10, 170, 50, INK.red)
      poly(
        st,
        [
          [-108, 185],
          [38, 185],
          [-35, 260],
        ],
        INK.red
      )
      // Ink caps.
      for (let index = 0; index < 5; index++) {
        const color = [INK.charcoal, INK.red, INK.ink, INK.gold, INK.green][index]
        rect(
          st,
          230 + (index % 3) * 90,
          -220 + Math.floor(index / 3) * 150,
          70,
          110,
          INK.charcoal,
          12
        )
        circle(st, 265 + (index % 3) * 90, -225 + Math.floor(index / 3) * 150, 30, color)
      }
      stroke(
        st,
        [
          [210, 180],
          [440, 280],
        ],
        18,
        INK.charcoal
      )
      stroke(
        st,
        [
          [440, 280],
          [480, 297],
        ],
        6,
        INK.grey
      )
    },
  },
  barber: {
    backdrop: 'wall',
    paint(st) {
      circle(st, -60, -170, 190, INK.gold)
      circle(st, -60, -170, 170, mix(INK.skyLight, INK.white, 0.3))
      poly(
        st,
        [
          [-150, -280],
          [-110, -300],
          [20, -60],
          [-20, -40],
        ],
        INK.white,
        0.5
      )
      // Barber pole.
      rect(st, 330, -380, 110, 470, INK.white, 20)
      for (let index = 0; index < 7; index++) {
        const y = -370 + index * 66
        poly(
          st,
          [
            [330, y + 30],
            [440, y - 10],
            [440, y + 16],
            [330, y + 56],
          ],
          index % 2 ? INK.ink : INK.red
        )
      }
      rect(st, 320, -410, 130, 40, INK.grey, 12)
      rect(st, 320, 80, 130, 40, INK.grey, 12)
      // Scissors and comb on the counter.
      ring(st, -330, 170, 46, 30, INK.charcoal)
      ring(st, -250, 190, 46, 30, INK.charcoal)
      poly(
        st,
        [
          [-300, 150],
          [-80, 90],
          [-290, 175],
        ],
        INK.grey
      )
      poly(
        st,
        [
          [-230, 170],
          [-80, 90],
          [-250, 195],
        ],
        mix(INK.grey, INK.white, 0.3)
      )
      rect(st, 20, 150, 280, 40, INK.charcoal, 8)
      for (let tooth = 0; tooth < 16; tooth++)
        rect(st, 30 + tooth * 17, 185, 8, 44, INK.charcoal, 3)
    },
  },
  flowers: {
    backdrop: 'wall',
    paint(st) {
      poly(
        st,
        [
          [-180, 30],
          [180, 30],
          [20, 330],
          [-20, 330],
        ],
        mix(INK.wood, INK.cream, 0.4)
      )
      poly(
        st,
        [
          [-180, 30],
          [0, 30],
          [0, 330],
          [-20, 330],
        ],
        mix(INK.wood, INK.cream, 0.2)
      )
      for (let index = 0; index < 8; index++) {
        const angle = -Math.PI / 2 + st.rng.between(-1.1, 1.1)
        leaf(
          st,
          [0, 60],
          [Math.cos(angle) * 300, 60 + Math.sin(angle) * 280],
          30,
          index % 2 ? INK.green : INK.greenLight
        )
      }
      for (let index = 0; index < 11; index++) {
        flower(
          st,
          st.rng.between(-190, 190),
          st.rng.between(-260, 20),
          st.rng.between(40, 62),
          st.rng.pick([INK.pink, INK.white, INK.gold, INK.lavender, INK.terracottaLight]),
          st.rng.pick([INK.gold, INK.brown])
        )
      }
      rect(st, -60, 170, 120, 40, INK.terracotta, 10)
      for (const x of [-420, 400]) {
        poly(
          st,
          [
            [x - 70, 120],
            [x + 70, 120],
            [x + 50, 250],
            [x - 50, 250],
          ],
          INK.terracotta
        )
        for (let index = 0; index < 5; index++)
          leaf(
            st,
            [x, 120],
            [x + st.rng.between(-120, 120), st.rng.between(-100, 20)],
            22,
            INK.green
          )
        flower(st, x, -40, 40, st.rng.pick([INK.pink, INK.gold]))
      }
    },
  },
  pet: {
    backdrop: 'table',
    paint(st) {
      circle(st, 10, 20, 190, INK.plateShadow)
      ring(st, 0, 0, 190, 140, INK.terracotta)
      circle(st, 0, 0, 140, mix(INK.terracotta, INK.charcoal, 0.3))
      for (let index = 0; index < 40; index++)
        ellipse(
          st,
          st.rng.between(-100, 100),
          st.rng.between(-100, 100),
          16,
          12,
          INK.brownMid,
          1,
          st.rng.between(0, 3)
        )
      // A bone and a ball.
      rect(st, 200, -300, 220, 50, INK.cream, 24, 0.4)
      for (const [x, y] of [
        [190, -330],
        [215, -275],
        [405, -250],
        [380, -195],
      ] as const)
        circle(st, x, y, 34, INK.cream)
      circle(st, -320, 220, 90, INK.gold)
      ring(st, -320, 220, 90, 78, INK.white, -0.3, 1.6)
      // Paw prints.
      for (let index = 0; index < 4; index++) {
        const x = 150 + index * 90
        const y = 250 - index * 70
        ellipse(st, x, y, 30, 26, INK.brown)
        for (let toe = 0; toe < 4; toe++)
          circle(st, x - 30 + toe * 20, y - 36 + (toe % 3 === 0 ? 8 : 0), 11, INK.brown)
      }
      st.r.polyline(
        quadraticPoints(at(st, -420, -300), at(st, -150, -150), at(st, -330, 60)),
        u(st, 12),
        INK.red
      )
    },
  },
  bike: {
    backdrop: 'wall',
    paint(st) {
      for (let x = -540; x <= 540; x += 60)
        for (let y = -380; y <= -160; y += 60) circle(st, x, y, 5, INK.woodDark)
      stroke(
        st,
        [
          [-480, -330],
          [-420, -250],
        ],
        14,
        INK.grey
      )
      circle(st, -400, -230, 26, INK.grey)
      stroke(
        st,
        [
          [-300, -330],
          [-300, -220],
        ],
        10,
        INK.charcoal
      )
      rect(st, -320, -230, 40, 50, INK.charcoal, 6)
      // The bicycle.
      const frame = st.rng.pick([INK.terracotta, INK.ink, INK.green, INK.gold])
      for (const x of [-230, 230]) {
        ring(st, x, 160, 170, 150, INK.charcoal)
        for (let spoke = 0; spoke < 12; spoke++) {
          const angle = (spoke / 12) * Math.PI
          stroke(
            st,
            [
              [x - Math.cos(angle) * 148, 160 - Math.sin(angle) * 148],
              [x + Math.cos(angle) * 148, 160 + Math.sin(angle) * 148],
            ],
            3,
            INK.grey
          )
        }
        circle(st, x, 160, 18, INK.grey)
      }
      stroke(
        st,
        [
          [-230, 160],
          [-40, 160],
          [150, -40],
          [-100, -40],
          [-230, 160],
        ],
        18,
        frame
      )
      stroke(
        st,
        [
          [-40, 160],
          [-100, -40],
        ],
        18,
        frame
      )
      stroke(
        st,
        [
          [150, -40],
          [230, 160],
        ],
        18,
        frame
      )
      stroke(
        st,
        [
          [-100, -40],
          [-120, -100],
        ],
        14,
        INK.charcoal
      )
      rect(st, -190, -125, 140, 32, INK.brown, 14)
      stroke(
        st,
        [
          [150, -40],
          [130, -120],
          [200, -130],
        ],
        12,
        INK.charcoal
      )
      circle(st, -40, 160, 34, INK.grey)
    },
  },
  ceramics: {
    backdrop: 'wall',
    paint(st) {
      rect(st, -520, -140, 1040, 22, INK.woodDark)
      const glazes = [INK.teal, INK.terracotta, INK.cream, INK.ink, INK.sage, INK.gold]
      for (let index = 0; index < 5; index++) {
        const x = -440 + index * 210
        const height = st.rng.between(130, 220)
        const belly = st.rng.between(55, 85)
        const neck = st.rng.between(20, 40)
        const color = st.rng.pick(glazes)
        const profile: Array<[number, number]> = []
        for (let step = 0; step <= 12; step++) {
          const t = step / 12
          const width = neck + (belly - neck) * Math.sin(Math.PI * (0.15 + t * 0.85))
          profile.push([x + width, -140 - t * height])
        }
        poly(
          st,
          [
            ...profile,
            ...profile
              .slice()
              .reverse()
              .map(([px, py]) => [2 * x - px, py] as [number, number]),
          ],
          color
        )
        rect(
          st,
          x - neck - 6,
          -140 - height - 12,
          (neck + 6) * 2,
          16,
          mix(color, INK.charcoal, 0.2),
          6
        )
      }
      // A wheel with a bowl in progress and brushes.
      ellipse(st, -150, 190, 260, 60, INK.charcoal)
      ellipse(st, -150, 175, 230, 48, INK.grey)
      poly(
        st,
        [
          [-270, 170],
          [-30, 170],
          [-70, 90],
          [-230, 90],
        ],
        INK.brownMid
      )
      ellipse(st, -150, 92, 80, 18, mix(INK.brownMid, INK.white, 0.2))
      for (let index = 0; index < 4; index++) {
        const x = 230 + index * 70
        stroke(
          st,
          [
            [x, 250],
            [x + 20, 60],
          ],
          12,
          INK.wood
        )
        rect(st, x + 8, 30, 26, 40, st.rng.pick([INK.terracotta, INK.ink, INK.gold]), 10, 0.1)
      }
    },
  },
  sewing: {
    backdrop: 'table',
    paint(st) {
      for (let index = 0; index < 3; index++) {
        const color = [INK.lavender, INK.terracottaLight, INK.sage][index]
        rect(st, -380 + index * 120, -300 + index * 60, 300, 260, color, 4, -0.1 + index * 0.12)
        for (let dot = 0; dot < 12; dot++)
          circle(
            st,
            -330 + index * 120 + (dot % 4) * 60,
            -250 + index * 60 + Math.floor(dot / 4) * 70,
            8,
            mix(color, INK.white, 0.45)
          )
      }
      for (let index = 0; index < 3; index++) {
        const x = 180 + index * 110
        const color = [INK.red, INK.gold, INK.ink][index]
        rect(st, x - 40, -260, 80, 22, INK.wood, 6)
        rect(st, x - 32, -240, 64, 110, color, 8)
        rect(st, x - 40, -130, 80, 22, INK.wood, 6)
      }
      st.r.polyline(
        quadraticPoints(at(st, -300, 180), at(st, 0, 60), at(st, 380, 250)),
        u(st, 34),
        INK.goldLight
      )
      for (let tick = 0; tick < 18; tick++) {
        const t = tick / 18
        const [x, y] = quadraticPoints(at(st, -300, 180), at(st, 0, 60), at(st, 380, 250), 18)[tick]
        void t
        st.r.fillRect(x - 1.5, y - u(st, 14), 3, u(st, 12), INK.charcoal)
      }
      for (const [x, y, color] of [
        [40, 0, INK.terracotta],
        [130, 40, INK.ink],
        [90, 110, INK.green],
      ] as const) {
        circle(st, x, y, 34, color)
        for (const [hx, hy] of [
          [-9, -9],
          [9, -9],
          [-9, 9],
          [9, 9],
        ] as const)
          circle(st, x + hx, y + hy, 5, mix(color, INK.charcoal, 0.4))
      }
      ring(st, -380, 280, 40, 26, INK.grey)
      ring(st, -300, 300, 40, 26, INK.grey)
      poly(
        st,
        [
          [-350, 270],
          [-120, 180],
          [-330, 300],
        ],
        INK.grey
      )
    },
  },
}

// ---------------------------------------------------------------------------
// Composition
// ---------------------------------------------------------------------------

const cache = new Map<string, Buffer>()

/**
 * An original PNG illustration for the demo: a motif, framed and varied by a
 * seed. Deterministic — the same request always returns the same bytes, which
 * keeps storage keys content-addressed and reruns free of new uploads.
 */
export function demoIllustration(request: DemoImageRequest): Buffer {
  const framing = request.framing ?? 'cover'
  const cacheKey = `${request.motif}|${framing}|${request.seed}`
  const cached = cache.get(cacheKey)
  if (cached) return cached

  const rng = seededRandom(cacheKey)
  const motif = MOTIFS[request.motif]
  const accent = rng.pick(ACCENTS)
  const background =
    motif.backdrop === 'table' ? rng.pick([INK.paper, INK.paperWarm, INK.paperCool]) : INK.paper
  const r = new Raster(DEMO_IMAGE_WIDTH, DEMO_IMAGE_HEIGHT, background)

  const side = rng.chance(0.5) ? 'left' : 'right'
  let cx = DEMO_IMAGE_WIDTH / 2
  let cy = 410
  if (motif.backdrop === 'table') {
    tableBackdrop(r, rng, accent, side)
    cx = side === 'left' ? 700 : 500
  } else if (motif.backdrop === 'wall') {
    const wall = rng.pick([
      mix(INK.skyLight, INK.paper, 0.4),
      mix(INK.blush, INK.paper, 0.5),
      mix(INK.sage, INK.paper, 0.55),
      INK.paperWarm,
    ])
    wallBackdrop(
      r,
      rng,
      wall,
      rng.pick([INK.wood, INK.woodDark, mix(INK.terracotta, INK.wood, 0.4)])
    )
    cy = 400
  } else if (motif.backdrop === 'dark') {
    r.fillVerticalGradient(0, DEMO_IMAGE_HEIGHT, mix(INK.ink, INK.charcoal, 0.55), INK.charcoal)
    cy = 420
  } else {
    const dusk = request.motif === 'lookout' || rng.chance(0.25)
    landscapeBackdrop(
      r,
      rng,
      dusk ? INK.terracottaLight : INK.sky,
      dusk ? INK.goldLight : INK.skyLight
    )
    if (!dusk && request.motif !== 'heritage')
      sun(r, rng.between(150, 1050), rng.between(90, 170), 55)
    if (rng.chance(0.7)) birds(r, rng, rng.int(2, 5))
    cy = 400
  }

  const scale = framing === 'detail' ? 1.3 : framing === 'wide' ? 0.82 : 1
  if (framing === 'detail') {
    cx += rng.between(-60, 60)
    cy += rng.between(-40, 40)
  }
  const stage: Stage = { r, rng, cx, cy, s: scale, accent }
  motif.paint(stage)

  if (motif.backdrop === 'table' && framing !== 'detail') {
    const sprigX = side === 'left' ? 1000 : 60
    sprig(r, sprigX, 760, rng.between(0.8, 1.1))
  }

  const png = r.png()
  cache.set(cacheKey, png)
  return png
}
