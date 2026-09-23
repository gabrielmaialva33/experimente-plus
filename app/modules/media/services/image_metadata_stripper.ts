import { readFile, writeFile } from 'node:fs/promises'
import { crc32 } from 'node:zlib'

import BadRequestException from '#exceptions/bad_request_exception'

/**
 * Removes the metadata a photo carries before it becomes public.
 *
 * A phone photo usually embeds EXIF with the GPS position where it was taken,
 * the device and the time, plus XMP and free-text comments. An establishment
 * photographing its own façade publishes nothing new that way; an Explorer
 * attaching a photo to a review can publish the coordinates of their home.
 * Clause 10.3 asks for reasonable technical measures, and this is the reasonable
 * one: the file that is stored and served carries pixels, not whereabouts.
 *
 * One thing is deliberately kept: the orientation. It is a single number that
 * says how to rotate the pixels, and dropping it with the rest would make every
 * portrait photo appear lying on its side. It is re-emitted in a minimal EXIF
 * block that contains nothing else.
 *
 * It fails closed. A file whose structure it cannot walk is refused rather than
 * stored as received, because "stored unstripped" is exactly the outcome this
 * exists to prevent.
 *
 * And it keeps by allowlist, not by denylist. The first version dropped the
 * containers it knew to carry metadata — EXIF, XMP, IPTC, comments, text
 * chunks — and kept everything else, which let through exactly what it did not
 * know about: APP11 segments (where C2PA content credentials, with author and
 * location assertions, live), private PNG chunks, unknown WebP chunks, and, in a
 * JPEG, every byte after the image ended. Ultra HDR photos append a second JPEG
 * there and motion photos append a video, each with metadata of its own; a
 * crafted file appended a whole EXIF block with GPS, and it was stored byte for
 * byte. What survives now is only what is needed to draw the pixels.
 */
export function stripImageMetadata(input: Buffer): Buffer {
  if (isJpeg(input)) return stripJpeg(input)
  if (isPng(input)) return stripPng(input)
  if (isWebp(input)) return stripWebp(input)
  // Unknown formats are left to the image probe, which rejects them.
  return input
}

export default class ImageMetadataStripper {
  /** Rewrites an uploaded temporary file in place, before it is probed and stored. */
  async stripFile(path: string): Promise<void> {
    const original = await readFile(path)
    const stripped = stripImageMetadata(original)
    if (stripped !== original) {
      await writeFile(path, stripped)
    }
  }
}

const ORIENTATION_TAG = 0x0112

function malformed(): never {
  throw new BadRequestException('The uploaded image could not be processed')
}

/** Reads the orientation from a TIFF block (the body of an EXIF segment). */
function orientationFromTiff(tiff: Buffer): number | null {
  if (tiff.length < 8) return null
  const byteOrder = tiff.toString('latin1', 0, 2)
  const little = byteOrder === 'II'
  if (!little && byteOrder !== 'MM') return null
  const u16 = (offset: number) => (little ? tiff.readUInt16LE(offset) : tiff.readUInt16BE(offset))
  const u32 = (offset: number) => (little ? tiff.readUInt32LE(offset) : tiff.readUInt32BE(offset))

  const ifd = u32(4)
  if (ifd + 2 > tiff.length) return null
  const count = u16(ifd)
  for (let index = 0; index < count; index++) {
    const entry = ifd + 2 + index * 12
    if (entry + 12 > tiff.length) return null
    if (u16(entry) === ORIENTATION_TAG) {
      const value = u16(entry + 8)
      return value >= 1 && value <= 8 ? value : null
    }
  }
  return null
}

/** A TIFF block holding the orientation and nothing else: 26 bytes. */
function minimalTiff(orientation: number): Buffer {
  const tiff = Buffer.alloc(26)
  tiff.write('II', 0, 'latin1')
  tiff.writeUInt16LE(42, 2)
  tiff.writeUInt32LE(8, 4)
  tiff.writeUInt16LE(1, 8)
  tiff.writeUInt16LE(ORIENTATION_TAG, 10)
  tiff.writeUInt16LE(3, 12) // SHORT
  tiff.writeUInt32LE(1, 14)
  tiff.writeUInt16LE(orientation, 18)
  tiff.writeUInt32LE(0, 22) // no next IFD
  return tiff
}

const EXIF_HEADER = Buffer.from('Exif\0\0', 'latin1')

function tiffFromExifPayload(payload: Buffer): Buffer {
  return payload.subarray(0, 6).equals(EXIF_HEADER) ? payload.subarray(6) : payload
}

// JPEG ------------------------------------------------------------------------

function isJpeg(buffer: Buffer): boolean {
  return buffer.length >= 3 && buffer[0] === 0xff && buffer[1] === 0xd8 && buffer[2] === 0xff
}

/**
 * Whether a segment before the image data is needed to draw it.
 *
 * Kept: frame headers, quantisation and Huffman tables, restart interval, and
 * three application segments that change how pixels look — APP0 when it is
 * JFIF, APP2 when it is an ICC colour profile, APP14 when it is Adobe's colour
 * transform. Everything else goes, including APP2 in its other uses (the MPF
 * index that points at an appended second image) and every application segment
 * this code has no reason to trust.
 */
function jpegSegmentIsNeeded(marker: number, payload: Buffer): boolean {
  if (marker >= 0xc0 && marker <= 0xcf) return marker !== 0xc8 // SOFn, DHT, DAC
  if (marker === 0xdb || marker === 0xdd || marker === 0xda) return true // DQT, DRI, SOS
  if (marker === 0xe0) return payload.subarray(0, 5).equals(Buffer.from('JFIF\0', 'latin1'))
  if (marker === 0xe2) return payload.subarray(0, 12).equals(Buffer.from('ICC_PROFILE\0', 'latin1'))
  if (marker === 0xee) return payload.subarray(0, 5).equals(Buffer.from('Adobe', 'latin1'))
  return false
}

/**
 * Rebuilds a JPEG from the segments it needs, and ends it at its own end.
 *
 * The entropy-coded data after each start of scan is walked rather than copied
 * to the end of the file: a real marker is a 0xFF not followed by stuffing
 * (0x00), a restart (0xD0–0xD7) or another fill byte. That is how progressive
 * images, with several scans and tables in between, are followed to their end
 * of image — and how anything appended after it is left behind. A file with no
 * end of image is refused.
 */
function stripJpeg(input: Buffer): Buffer {
  const kept: Buffer[] = [input.subarray(0, 2)]
  let orientation: number | null = null
  let jfifEnd: number | null = null
  let offset = 2
  let ended = false

  while (offset < input.length) {
    if (input[offset] !== 0xff) malformed()
    const marker = input[offset + 1]
    if (marker === undefined) malformed()

    // Fill bytes between segments are legal.
    if (marker === 0xff) {
      offset++
      continue
    }

    if (marker === 0xd9) {
      kept.push(input.subarray(offset, offset + 2))
      ended = true
      break
    }

    if (offset + 4 > input.length) malformed()
    const length = input.readUInt16BE(offset + 2)
    const end = offset + 2 + length
    if (length < 2 || end > input.length) malformed()
    const payload = input.subarray(offset + 4, end)

    if (marker === 0xe1) {
      if (payload.subarray(0, 6).equals(EXIF_HEADER)) {
        orientation ??= orientationFromTiff(payload.subarray(6))
      }
    } else if (jpegSegmentIsNeeded(marker, payload)) {
      kept.push(input.subarray(offset, end))
      if (marker === 0xe0 && jfifEnd === null) jfifEnd = kept.length
    }
    offset = end

    if (marker === 0xda) {
      let cursor = offset
      while (true) {
        if (cursor + 1 >= input.length) malformed()
        if (input[cursor] !== 0xff) {
          cursor++
          continue
        }
        const next = input[cursor + 1]
        if (next === 0x00 || (next >= 0xd0 && next <= 0xd7) || next === 0xff) {
          cursor += next === 0xff ? 1 : 2
          continue
        }
        break
      }
      kept.push(input.subarray(offset, cursor))
      offset = cursor
    }
  }

  if (!ended) malformed()

  if (orientation !== null && orientation !== 1) {
    const tiff = minimalTiff(orientation)
    const app1 = Buffer.alloc(4)
    app1.writeUInt16BE(0xffe1, 0)
    app1.writeUInt16BE(2 + EXIF_HEADER.length + tiff.length, 2)
    // JFIF requires APP0 to follow the start of image directly.
    kept.splice(jfifEnd ?? 1, 0, Buffer.concat([app1, EXIF_HEADER, tiff]))
  }

  return Buffer.concat(kept)
}

// PNG -------------------------------------------------------------------------

const PNG_SIGNATURE = Buffer.from([0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a])
/**
 * The chunks a PNG needs to be drawn as it was: the critical ones, colour and
 * transparency information, physical size, and the three that make an APNG
 * move. Text, time, EXIF and every private or unknown chunk are left out.
 */
const PNG_NEEDED = new Set([
  'IHDR',
  'PLTE',
  'IDAT',
  'IEND',
  'tRNS',
  'gAMA',
  'cHRM',
  'sRGB',
  'iCCP',
  'sBIT',
  'bKGD',
  'pHYs',
  'cICP',
  'mDCV',
  'cLLI',
  'acTL',
  'fcTL',
  'fdAT',
])

function isPng(buffer: Buffer): boolean {
  return buffer.length >= 8 && buffer.subarray(0, 8).equals(PNG_SIGNATURE)
}

function pngChunk(type: string, data: Buffer): Buffer {
  const header = Buffer.alloc(8)
  header.writeUInt32BE(data.length, 0)
  header.write(type, 4, 'latin1')
  const crc = Buffer.alloc(4)
  crc.writeUInt32BE(crc32(Buffer.concat([header.subarray(4), data])) >>> 0, 0)
  return Buffer.concat([header, data, crc])
}

function stripPng(input: Buffer): Buffer {
  const kept: Buffer[] = []
  let orientation: number | null = null
  let offset = 8
  let sawEnd = false

  while (offset < input.length) {
    if (offset + 12 > input.length) malformed()
    const length = input.readUInt32BE(offset)
    const type = input.toString('latin1', offset + 4, offset + 8)
    const end = offset + 12 + length
    if (end > input.length) malformed()
    const data = input.subarray(offset + 8, offset + 8 + length)

    if (type === 'eXIf') {
      orientation ??= orientationFromTiff(tiffFromExifPayload(data))
    } else if (PNG_NEEDED.has(type)) {
      if (type === 'IDAT' && orientation !== null && orientation !== 1) {
        // eXIf must precede the image data.
        kept.push(pngChunk('eXIf', minimalTiff(orientation)))
        orientation = 1
      }
      kept.push(input.subarray(offset, end))
    }

    offset = end
    if (type === 'IEND') {
      sawEnd = true
      break
    }
  }

  if (!sawEnd) malformed()
  return Buffer.concat([PNG_SIGNATURE, ...kept])
}

// WEBP ------------------------------------------------------------------------

function isWebp(buffer: Buffer): boolean {
  return (
    buffer.length >= 12 &&
    buffer.toString('latin1', 0, 4) === 'RIFF' &&
    buffer.toString('latin1', 8, 12) === 'WEBP'
  )
}

/**
 * The chunks a WebP needs: its bitstream (lossy or lossless), the extended
 * header, alpha, animation and the colour profile. EXIF, XMP and any chunk this
 * code does not know are left out.
 */
const WEBP_NEEDED = new Set(['VP8 ', 'VP8L', 'VP8X', 'ALPH', 'ANIM', 'ANMF', 'ICCP'])

const VP8X_EXIF_FLAG = 0x08
const VP8X_XMP_FLAG = 0x04

function riffChunk(type: string, data: Buffer): Buffer {
  const header = Buffer.alloc(8)
  header.write(type, 0, 'latin1')
  header.writeUInt32LE(data.length, 4)
  const padding = data.length % 2 === 1 ? Buffer.alloc(1) : Buffer.alloc(0)
  return Buffer.concat([header, data, padding])
}

/**
 * EXIF and XMP live in their own chunks and are announced by flags in VP8X,
 * which a file carrying either must have. Both chunks go; the flags are updated
 * to match, and the RIFF size is recomputed.
 */
function stripWebp(input: Buffer): Buffer {
  const chunks: Array<{ type: string; raw: Buffer }> = []
  let orientation: number | null = null
  let offset = 12

  while (offset < input.length) {
    if (offset + 8 > input.length) malformed()
    const type = input.toString('latin1', offset, offset + 4)
    const size = input.readUInt32LE(offset + 4)
    const padded = size + (size % 2)
    const end = offset + 8 + padded
    if (offset + 8 + size > input.length) malformed()
    const data = input.subarray(offset + 8, offset + 8 + size)

    if (type === 'EXIF') {
      orientation ??= orientationFromTiff(tiffFromExifPayload(data))
    } else if (WEBP_NEEDED.has(type)) {
      // A final chunk of odd size may arrive without its padding byte. It is
      // restored, so a chunk appended after it still starts on an even offset.
      const raw = input.subarray(offset, Math.min(end, input.length))
      chunks.push({ type, raw: raw.length === 8 + padded ? raw : riffChunk(type, data) })
    }
    offset = end
  }

  const keepOrientation = orientation !== null && orientation !== 1
  const rebuilt = chunks.map(({ type, raw }) => {
    if (type !== 'VP8X') return raw
    const copy = Buffer.from(raw)
    let flags = copy[8] & ~VP8X_XMP_FLAG
    flags = keepOrientation ? flags | VP8X_EXIF_FLAG : flags & ~VP8X_EXIF_FLAG
    copy[8] = flags
    return copy
  })

  // Without VP8X there was no EXIF to begin with: the extended header is what
  // makes the chunk legal.
  const hasExtendedHeader = chunks.some((chunk) => chunk.type === 'VP8X')
  if (keepOrientation && hasExtendedHeader) {
    rebuilt.push(riffChunk('EXIF', minimalTiff(orientation as number)))
  }

  const body = Buffer.concat([Buffer.from('WEBP', 'latin1'), ...rebuilt])
  const header = Buffer.alloc(8)
  header.write('RIFF', 0, 'latin1')
  header.writeUInt32LE(body.length, 4)
  return Buffer.concat([header, body])
}
