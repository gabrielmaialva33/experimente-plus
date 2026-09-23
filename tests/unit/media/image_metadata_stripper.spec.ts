import { readFile } from 'node:fs/promises'
import { join } from 'node:path'

import { test } from '@japa/runner'

import { stripImageMetadata } from '#modules/media/services/image_metadata_stripper'

const fixture = (name: string) => readFile(join(process.cwd(), 'tests', 'fixtures', 'media', name))

// The only EXIF the stripper may emit: little-endian TIFF, one IFD, one entry —
// Orientation (0x0112), SHORT, value 6 — and no next IFD.
const orientationOnly = Buffer.from([
  0x49, 0x49, 0x2a, 0x00, 0x08, 0x00, 0x00, 0x00, 0x01, 0x00, 0x12, 0x01, 0x03, 0x00, 0x01, 0x00,
  0x00, 0x00, 0x06, 0x00, 0x00, 0x00, 0x00, 0x00, 0x00, 0x00,
])

const revealing = ['Rua das Flores', 'shot at home', 'xmpmeta', 'FixtureCam']
// The GPS IFD pointer tag, in either byte order.
const gpsPointer = [Buffer.from([0x25, 0x88]), Buffer.from([0x88, 0x25])]

test.group('Image metadata stripper', () => {
  for (const format of ['jpg', 'png', 'webp']) {
    test(`removes location and text from a ${format} but keeps its orientation`, async ({
      assert,
    }) => {
      const original = await fixture(`with_metadata.${format}`)
      assert.isTrue(
        gpsPointer.some((tag) => original.includes(tag)),
        'fixture must carry GPS'
      )

      const stripped = stripImageMetadata(original)

      for (const text of revealing) {
        assert.isFalse(stripped.includes(Buffer.from(text)), `${text} survived`)
      }
      assert.isFalse(stripped.includes(Buffer.from('GPS')))
      assert.isTrue(
        stripped.includes(orientationOnly),
        'orientation must survive, alone, or portrait photos render sideways'
      )
      assert.isBelow(stripped.length, original.length)
    })

    test(`is idempotent on a ${format}`, async ({ assert }) => {
      const once = stripImageMetadata(await fixture(`with_metadata.${format}`))
      assert.isTrue(stripImageMetadata(once).equals(once))
    })
  }

  for (const name of ['valid.jpg', 'valid.png', 'valid.webp']) {
    test(`leaves ${name}, which has nothing to remove, byte-identical`, async ({ assert }) => {
      const original = await fixture(name)
      assert.isTrue(stripImageMetadata(original).equals(original))
    })
  }

  test('refuses a truncated image instead of storing it as received', async ({ assert }) => {
    const original = await fixture('with_metadata.jpg')
    assert.throws(() => stripImageMetadata(original.subarray(0, 40)))

    const png = await fixture('with_metadata.png')
    assert.throws(() => stripImageMetadata(png.subarray(0, png.length - 20)))
  })

  test('leaves unknown content to the image probe', ({ assert }) => {
    const text = Buffer.from('not-an-image')
    assert.strictEqual(stripImageMetadata(text), text)
  })
})
