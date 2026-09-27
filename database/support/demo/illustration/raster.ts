import { deflateSync } from 'node:zlib'

export type Rgb = readonly [number, number, number]
export type Point = readonly [number, number]

/** Vertical sub-scanlines per pixel row. Horizontal coverage is computed exactly. */
const SUBSAMPLES = 4

const CRC_TABLE = (() => {
  const table = new Uint32Array(256)
  for (let n = 0; n < 256; n++) {
    let c = n
    for (let bit = 0; bit < 8; bit++) c = c & 1 ? 0xedb88320 ^ (c >>> 1) : c >>> 1
    table[n] = c >>> 0
  }
  return table
})()

function crc32(bytes: Buffer): number {
  let crc = 0xffffffff
  for (const byte of bytes) crc = CRC_TABLE[(crc ^ byte) & 0xff] ^ (crc >>> 8)
  return (crc ^ 0xffffffff) >>> 0
}

/**
 * A tiny anti-aliased vector rasterizer for the demonstration illustrations.
 *
 * It exists so the demo can ship original artwork generated from code, with no
 * binary assets, fonts or native image libraries in the dependency tree: shapes
 * are flattened to polygons and filled scanline by scanline with exact
 * horizontal coverage, which gives clean edges at a fraction of the cost of
 * brute-force supersampling. The output is a plain 8-bit RGB PNG, the format
 * the media pipeline already accepts.
 */
export class Raster {
  readonly width: number
  readonly height: number
  private readonly pixels: Uint8Array
  private readonly coverage: Float32Array

  constructor(width: number, height: number, background: Rgb) {
    this.width = width
    this.height = height
    this.pixels = new Uint8Array(width * height * 3)
    this.coverage = new Float32Array(width + 2)
    for (let offset = 0; offset < this.pixels.length; offset += 3) {
      this.pixels[offset] = background[0]
      this.pixels[offset + 1] = background[1]
      this.pixels[offset + 2] = background[2]
    }
  }

  /** Fills closed subpaths with the even-odd rule, so an inner subpath punches a hole. */
  fillPath(subpaths: ReadonlyArray<ReadonlyArray<Point>>, color: Rgb, opacity = 1): void {
    const edges: number[] = []
    let minY = Infinity
    let maxY = -Infinity
    for (const path of subpaths) {
      if (path.length < 3) continue
      for (let index = 0; index < path.length; index++) {
        const [x0, y0] = path[index]
        const [x1, y1] = path[(index + 1) % path.length]
        if (y0 < minY) minY = y0
        if (y0 > maxY) maxY = y0
        if (y0 === y1) continue
        if (y0 < y1) edges.push(x0, y0, x1, y1)
        else edges.push(x1, y1, x0, y0)
      }
    }
    if (edges.length === 0) return

    const rowStart = Math.max(0, Math.floor(minY))
    const rowEnd = Math.min(this.height, Math.ceil(maxY))
    const crossings: number[] = []
    const weight = 1 / SUBSAMPLES
    for (let row = rowStart; row < rowEnd; row++) {
      let touchedMin = Infinity
      let touchedMax = -Infinity
      for (let sample = 0; sample < SUBSAMPLES; sample++) {
        const y = row + (sample + 0.5) * weight
        crossings.length = 0
        for (let edge = 0; edge < edges.length; edge += 4) {
          const y0 = edges[edge + 1]
          const y1 = edges[edge + 3]
          if (y < y0 || y >= y1) continue
          const x0 = edges[edge]
          const x1 = edges[edge + 2]
          crossings.push(x0 + ((y - y0) * (x1 - x0)) / (y1 - y0))
        }
        if (crossings.length < 2) continue
        crossings.sort((a, b) => a - b)
        for (let index = 0; index + 1 < crossings.length; index += 2) {
          const span = this.addSpan(crossings[index], crossings[index + 1], weight)
          if (span) {
            if (span[0] < touchedMin) touchedMin = span[0]
            if (span[1] > touchedMax) touchedMax = span[1]
          }
        }
      }
      if (touchedMin <= touchedMax) this.blendRow(row, touchedMin, touchedMax, color, opacity)
    }
  }

  fillPolygon(points: ReadonlyArray<Point>, color: Rgb, opacity = 1): void {
    this.fillPath([points], color, opacity)
  }

  fillEllipse(
    cx: number,
    cy: number,
    rx: number,
    ry: number,
    color: Rgb,
    opacity = 1,
    rotation = 0
  ): void {
    this.fillPolygon(ellipsePoints(cx, cy, rx, ry, rotation), color, opacity)
  }

  fillCircle(cx: number, cy: number, radius: number, color: Rgb, opacity = 1): void {
    this.fillEllipse(cx, cy, radius, radius, color, opacity)
  }

  /** A ring (annulus); with start/end angles it becomes an arc band. */
  fillRing(
    cx: number,
    cy: number,
    outer: number,
    inner: number,
    color: Rgb,
    opacity = 1,
    from = 0,
    to = Math.PI * 2
  ): void {
    if (to - from >= Math.PI * 2 - 1e-6) {
      this.fillPath(
        [ellipsePoints(cx, cy, outer, outer), ellipsePoints(cx, cy, inner, inner)],
        color,
        opacity
      )
      return
    }
    const outerArc = arcPoints(cx, cy, outer, from, to)
    const innerArc = arcPoints(cx, cy, inner, from, to).reverse()
    this.fillPolygon([...outerArc, ...innerArc], color, opacity)
  }

  fillRect(x: number, y: number, width: number, height: number, color: Rgb, opacity = 1): void {
    this.fillPolygon(
      [
        [x, y],
        [x + width, y],
        [x + width, y + height],
        [x, y + height],
      ],
      color,
      opacity
    )
  }

  fillRoundRect(
    x: number,
    y: number,
    width: number,
    height: number,
    radius: number,
    color: Rgb,
    opacity = 1,
    rotation = 0
  ): void {
    const points = roundRectPoints(x, y, width, height, radius)
    this.fillPolygon(
      rotation ? rotatePoints(points, x + width / 2, y + height / 2, rotation) : points,
      color,
      opacity
    )
  }

  /** A smooth top-to-bottom gradient over whole pixel rows, for skies and walls. */
  fillVerticalGradient(top: number, bottom: number, from: Rgb, to: Rgb): void {
    const start = Math.max(0, Math.floor(top))
    const end = Math.min(this.height, Math.ceil(bottom))
    const span = Math.max(1, end - start - 1)
    for (let row = start; row < end; row++) {
      const t = (row - start) / span
      const red = Math.round(from[0] + (to[0] - from[0]) * t)
      const green = Math.round(from[1] + (to[1] - from[1]) * t)
      const blue = Math.round(from[2] + (to[2] - from[2]) * t)
      for (let offset = row * this.width * 3; offset < (row + 1) * this.width * 3; offset += 3) {
        this.pixels[offset] = red
        this.pixels[offset + 1] = green
        this.pixels[offset + 2] = blue
      }
    }
  }

  /** A thick segment with round caps. */
  line(x0: number, y0: number, x1: number, y1: number, width: number, color: Rgb, opacity = 1) {
    this.polyline(
      [
        [x0, y0],
        [x1, y1],
      ],
      width,
      color,
      opacity
    )
  }

  /**
   * A thick open polyline with round joins, filled as one path per segment so
   * opaque strokes look continuous. Use opaque colours: overlapping joins of a
   * translucent stroke would double the alpha.
   */
  polyline(points: ReadonlyArray<Point>, width: number, color: Rgb, opacity = 1): void {
    const half = width / 2
    for (let index = 0; index + 1 < points.length; index++) {
      const [x0, y0] = points[index]
      const [x1, y1] = points[index + 1]
      const length = Math.hypot(x1 - x0, y1 - y0)
      if (length === 0) continue
      const nx = (-(y1 - y0) / length) * half
      const ny = ((x1 - x0) / length) * half
      this.fillPolygon(
        [
          [x0 + nx, y0 + ny],
          [x1 + nx, y1 + ny],
          [x1 - nx, y1 - ny],
          [x0 - nx, y0 - ny],
        ],
        color,
        opacity
      )
    }
    for (const [x, y] of points) this.fillCircle(x, y, half, color, opacity)
  }

  /** 8-bit RGB PNG without ancillary chunks: no metadata to strip, deterministic bytes. */
  png(): Buffer {
    const stride = this.width * 3
    const scanlines = Buffer.alloc(this.height * (stride + 1))
    for (let row = 0; row < this.height; row++) {
      // Filter 1 (Sub): flat illustration rows collapse to runs of zeros.
      const out = row * (stride + 1)
      scanlines[out] = 1
      const base = row * stride
      for (let index = 0; index < stride; index++) {
        const left = index >= 3 ? this.pixels[base + index - 3] : 0
        scanlines[out + 1 + index] = (this.pixels[base + index] - left) & 0xff
      }
    }
    const header = Buffer.alloc(13)
    header.writeUInt32BE(this.width, 0)
    header.writeUInt32BE(this.height, 4)
    header[8] = 8
    header[9] = 2
    return Buffer.concat([
      Buffer.from([137, 80, 78, 71, 13, 10, 26, 10]),
      chunk('IHDR', header),
      chunk('IDAT', deflateSync(scanlines, { level: 9 })),
      chunk('IEND', Buffer.alloc(0)),
    ])
  }

  private addSpan(from: number, to: number, weight: number): [number, number] | null {
    const a = Math.max(0, from)
    const b = Math.min(this.width, to)
    if (b <= a) return null
    const first = Math.floor(a)
    const last = Math.floor(b)
    const coverage = this.coverage
    if (first === last) {
      coverage[first] += (b - a) * weight
      return [first, first]
    }
    coverage[first] += (first + 1 - a) * weight
    for (let x = first + 1; x < last; x++) coverage[x] += weight
    if (last < this.width) {
      coverage[last] += (b - last) * weight
      return [first, last]
    }
    return [first, last - 1]
  }

  private blendRow(row: number, from: number, to: number, color: Rgb, opacity: number): void {
    const coverage = this.coverage
    const pixels = this.pixels
    const [red, green, blue] = color
    let offset = (row * this.width + from) * 3
    for (let x = from; x <= to; x++, offset += 3) {
      const value = coverage[x]
      if (value <= 0) continue
      coverage[x] = 0
      const alpha = (value >= 0.999 ? 1 : value) * opacity
      if (alpha >= 0.999) {
        pixels[offset] = red
        pixels[offset + 1] = green
        pixels[offset + 2] = blue
      } else {
        pixels[offset] = Math.round(pixels[offset] + (red - pixels[offset]) * alpha)
        pixels[offset + 1] = Math.round(pixels[offset + 1] + (green - pixels[offset + 1]) * alpha)
        pixels[offset + 2] = Math.round(pixels[offset + 2] + (blue - pixels[offset + 2]) * alpha)
      }
    }
  }
}

function chunk(type: string, data: Buffer): Buffer {
  const name = Buffer.from(type, 'ascii')
  const size = Buffer.alloc(4)
  size.writeUInt32BE(data.length)
  const checksum = Buffer.alloc(4)
  checksum.writeUInt32BE(crc32(Buffer.concat([name, data])))
  return Buffer.concat([size, name, data, checksum])
}

export function ellipsePoints(
  cx: number,
  cy: number,
  rx: number,
  ry: number,
  rotation = 0
): Point[] {
  const segments = Math.min(256, Math.max(24, Math.ceil(Math.max(rx, ry) * 0.7)))
  const cos = Math.cos(rotation)
  const sin = Math.sin(rotation)
  const points: Point[] = []
  for (let index = 0; index < segments; index++) {
    const angle = (index / segments) * Math.PI * 2
    const x = Math.cos(angle) * rx
    const y = Math.sin(angle) * ry
    points.push([cx + x * cos - y * sin, cy + x * sin + y * cos])
  }
  return points
}

export function arcPoints(cx: number, cy: number, radius: number, from: number, to: number) {
  const segments = Math.max(8, Math.ceil(((to - from) / (Math.PI * 2)) * radius * 0.7))
  const points: Point[] = []
  for (let index = 0; index <= segments; index++) {
    const angle = from + ((to - from) * index) / segments
    points.push([cx + Math.cos(angle) * radius, cy + Math.sin(angle) * radius])
  }
  return points
}

export function roundRectPoints(
  x: number,
  y: number,
  width: number,
  height: number,
  radius: number
): Point[] {
  const r = Math.max(0, Math.min(radius, width / 2, height / 2))
  if (r === 0) {
    return [
      [x, y],
      [x + width, y],
      [x + width, y + height],
      [x, y + height],
    ]
  }
  return [
    ...arcPoints(x + width - r, y + r, r, -Math.PI / 2, 0),
    ...arcPoints(x + width - r, y + height - r, r, 0, Math.PI / 2),
    ...arcPoints(x + r, y + height - r, r, Math.PI / 2, Math.PI),
    ...arcPoints(x + r, y + r, r, Math.PI, Math.PI * 1.5),
  ]
}

export function rotatePoints(
  points: ReadonlyArray<Point>,
  cx: number,
  cy: number,
  angle: number
): Point[] {
  const cos = Math.cos(angle)
  const sin = Math.sin(angle)
  return points.map(([x, y]) => {
    const dx = x - cx
    const dy = y - cy
    return [cx + dx * cos - dy * sin, cy + dx * sin + dy * cos] as const
  })
}

/** Quadratic Bézier flattened to points, for leaves, petals and flowing lines. */
export function quadraticPoints(from: Point, control: Point, to: Point, segments = 24): Point[] {
  const points: Point[] = []
  for (let index = 0; index <= segments; index++) {
    const t = index / segments
    const u = 1 - t
    points.push([
      u * u * from[0] + 2 * u * t * control[0] + t * t * to[0],
      u * u * from[1] + 2 * u * t * control[1] + t * t * to[1],
    ])
  }
  return points
}

/** A pointed leaf between two points, bulging by `width` on each side. */
export function leafPoints(from: Point, to: Point, width: number): Point[] {
  const dx = to[0] - from[0]
  const dy = to[1] - from[1]
  const length = Math.hypot(dx, dy) || 1
  const nx = (-dy / length) * width
  const ny = (dx / length) * width
  const mid: Point = [(from[0] + to[0]) / 2, (from[1] + to[1]) / 2]
  return [
    ...quadraticPoints(from, [mid[0] + nx * 2, mid[1] + ny * 2], to, 16),
    ...quadraticPoints(to, [mid[0] - nx * 2, mid[1] - ny * 2], from, 16).slice(1, -1),
  ]
}
