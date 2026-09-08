import { deflateSync } from 'node:zlib'

export type DevelopmentIllustration = 'coffee' | 'petiscos' | 'bakery'
export const DEVELOPMENT_MEDIA_WIDTH = 1200
export const DEVELOPMENT_MEDIA_HEIGHT = 800

type Color = readonly [number, number, number]
const cache = new Map<DevelopmentIllustration, Buffer>()

/** Original procedural illustrations, not photographs of real venues. No external assets/fonts. */
export function developmentIllustration(scene: DevelopmentIllustration): Buffer {
  const cached = cache.get(scene)
  if (cached) return cached
  const width = DEVELOPMENT_MEDIA_WIDTH
  const height = DEVELOPMENT_MEDIA_HEIGHT
  const pixels = Buffer.alloc(width * height * 3)
  const paper: Color = [245, 232, 208]
  const ink: Color = [19, 70, 124]
  const white: Color = [255, 253, 246]
  const terracotta: Color = [203, 93, 46]
  const gold: Color = [227, 170, 76]
  const green: Color = [55, 98, 70]
  const brown: Color = [87, 49, 34]

  function pixel(x: number, y: number, color: Color) {
    const offset = (y * width + x) * 3
    pixels[offset] = color[0]
    pixels[offset + 1] = color[1]
    pixels[offset + 2] = color[2]
  }
  function rect(x: number, y: number, w: number, h: number, color: Color) {
    for (let row = Math.max(0, y); row < Math.min(height, y + h); row++)
      for (let col = Math.max(0, x); col < Math.min(width, x + w); col++) pixel(col, row, color)
  }
  function ellipse(cx: number, cy: number, rx: number, ry: number, color: Color) {
    for (let y = Math.max(0, Math.floor(cy - ry)); y < Math.min(height, cy + ry); y++)
      for (let x = Math.max(0, Math.floor(cx - rx)); x < Math.min(width, cx + rx); x++)
        if (((x - cx) / rx) ** 2 + ((y - cy) / ry) ** 2 <= 1) pixel(x, y, color)
  }
  function polygon(points: Array<[number, number]>, color: Color) {
    const minX = Math.max(0, Math.floor(Math.min(...points.map((p) => p[0]))))
    const maxX = Math.min(width, Math.ceil(Math.max(...points.map((p) => p[0]))))
    const minY = Math.max(0, Math.floor(Math.min(...points.map((p) => p[1]))))
    const maxY = Math.min(height, Math.ceil(Math.max(...points.map((p) => p[1]))))
    for (let y = minY; y < maxY; y++)
      for (let x = minX; x < maxX; x++) {
        let inside = false
        for (let i = 0, j = points.length - 1; i < points.length; j = i++) {
          const [xi, yi] = points[i]
          const [xj, yj] = points[j]
          if (yi > y !== yj > y && x < ((xj - xi) * (y - yi)) / (yj - yi) + xi) inside = !inside
        }
        if (inside) pixel(x, y, color)
      }
  }

  rect(0, 0, width, height, paper)
  // Woven table runner, a graphic illustration rather than an enlarged color swatch.
  rect(70, 0, 215, height, ink)
  for (let y = 0; y < height; y += 36) rect(70, y, 215, 4, [52, 94, 137])
  for (let x = 82; x < 280; x += 28) rect(x, 0, 2, height, [72, 110, 148])
  ellipse(695, 430, 343, 274, [218, 199, 168])
  ellipse(685, 410, 330, 263, white)
  ellipse(685, 410, 292, 230, [232, 228, 215])
  ellipse(685, 410, 284, 222, white)

  if (scene === 'coffee') {
    ellipse(902, 418, 98, 85, terracotta)
    ellipse(902, 418, 67, 54, white)
    ellipse(660, 400, 204, 182, terracotta)
    ellipse(660, 393, 177, 157, gold)
    ellipse(660, 393, 162, 143, brown)
    ellipse(660, 407, 100, 79, [171, 109, 58])
    // Stylized latte leaf.
    for (let i = 0; i < 6; i++) {
      ellipse(644 - i * 6, 449 - i * 19, 34 - i * 3, 12, white)
      ellipse(678 + i * 5, 449 - i * 19, 34 - i * 3, 12, white)
    }
    polygon(
      [
        [655, 480],
        [666, 285],
        [673, 477],
      ],
      white
    )
    for (const [x, y] of [
      [935, 180],
      [980, 222],
      [994, 161],
    ]) {
      ellipse(x, y, 30, 21, brown)
      polygon(
        [
          [x - 4, y - 19],
          [x + 5, y - 19],
          [x + 1, y + 20],
        ],
        gold
      )
    }
  } else if (scene === 'petiscos') {
    // Baked savory bites on a plate, red sauce and an illustrated drink.
    for (const [x, y] of [
      [549, 314],
      [704, 291],
      [835, 363],
      [795, 510],
      [600, 514],
    ]) {
      ellipse(x, y, 72, 65, terracotta)
      ellipse(x - 4, y - 9, 65, 54, gold)
      for (let i = 0; i < 11; i++) ellipse(x - 38 + i * 7, y - 18 + (i % 3) * 12, 3, 3, brown)
    }
    ellipse(686, 410, 66, 57, ink)
    ellipse(686, 406, 53, 44, terracotta)
    ellipse(675, 395, 25, 15, [228, 112, 62])
    rect(908, 68, 150, 208, ink)
    rect(920, 79, 126, 184, gold)
    ellipse(983, 83, 75, 31, white)
    rect(934, 119, 15, 107, [242, 202, 123])
    ellipse(974, 193, 6, 6, white)
    ellipse(1021, 161, 4, 4, white)
  } else {
    // A scored sourdough loaf and two slices.
    ellipse(644, 365, 210, 141, brown)
    ellipse(638, 351, 202, 133, terracotta)
    ellipse(624, 335, 178, 111, gold)
    for (let i = 0; i < 5; i++)
      polygon(
        [
          [495 + i * 60, 325],
          [522 + i * 60, 283],
          [552 + i * 60, 386],
          [531 + i * 60, 413],
        ],
        paper
      )
    for (const [x, y] of [
      [784, 505],
      [852, 567],
    ]) {
      ellipse(x, y, 100, 74, brown)
      ellipse(x, y - 4, 91, 64, gold)
      ellipse(x, y - 7, 79, 53, paper)
      for (let i = 0; i < 15; i++) {
        const a = i * 2.399
        ellipse(x + Math.cos(a) * (18 + i * 3), y - 7 + Math.sin(a) * (10 + i * 2), 5, 3, gold)
      }
    }
  }

  // Original botanical sprig and linen stitch details.
  polygon(
    [
      [1005, 747],
      [995, 742],
      [1117, 426],
      [1124, 430],
    ],
    green
  )
  for (let i = 0; i < 7; i++) {
    ellipse(1042 + i * 12, 673 - i * 35, 39, 13, green)
    ellipse(1090 + i * 9, 680 - i * 33, 28, 12, [79, 119, 77])
  }
  for (let x = 310; x < 1140; x += 24) rect(x, 756, 12, 3, terracotta)

  function chunk(type: string, data: Buffer) {
    const name = Buffer.from(type)
    let crc = 0xffffffff
    for (const byte of Buffer.concat([name, data])) {
      crc ^= byte
      for (let bit = 0; bit < 8; bit++) crc = (crc >>> 1) ^ (crc & 1 ? 0xedb88320 : 0)
    }
    const size = Buffer.alloc(4)
    const checksum = Buffer.alloc(4)
    size.writeUInt32BE(data.length)
    checksum.writeUInt32BE((crc ^ 0xffffffff) >>> 0)
    return Buffer.concat([size, name, data, checksum])
  }
  const header = Buffer.alloc(13)
  header.writeUInt32BE(width)
  header.writeUInt32BE(height, 4)
  header[8] = 8
  header[9] = 2 // RGB, no metadata, no external decoder dependency.
  const scanlines = Buffer.alloc(height * (width * 3 + 1))
  for (let y = 0; y < height; y++)
    pixels.copy(scanlines, y * (width * 3 + 1) + 1, y * width * 3, (y + 1) * width * 3)
  const png = Buffer.concat([
    Buffer.from([137, 80, 78, 71, 13, 10, 26, 10]),
    chunk('IHDR', header),
    chunk('IDAT', deflateSync(scanlines, { level: 9 })),
    chunk('IEND', Buffer.alloc(0)),
  ])
  cache.set(scene, png)
  return png
}
