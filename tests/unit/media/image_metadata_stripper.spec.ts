import { readFile } from 'node:fs/promises'
import { join } from 'node:path'
import { crc32 } from 'node:zlib'

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

      // Only a string the fixture actually carries proves anything by being
      // absent afterwards. Asserting the absence of text that was never there
      // passes whatever the stripper does, and the list above is shared by
      // three fixtures that each carry only some of it.
      const present = revealing.filter((text) => original.includes(Buffer.from(text)))
      assert.isNotEmpty(present, 'fixture must carry revealing text')
      for (const text of present) {
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

  test('drops everything a JPEG carries after its own end', async ({ assert }) => {
    // Ultra HDR photos append a second JPEG after the end of image, motion
    // photos append a video, and each carries metadata of its own. The first
    // version copied every byte after the start of scan, and this crafted file —
    // a clean JPEG followed by one with GPS — was stored whole.
    const clean = await fixture('valid.jpg')
    const dirty = await fixture('with_metadata.jpg')
    const stripped = stripImageMetadata(Buffer.concat([clean, dirty]))

    assert.isFalse(stripped.includes(dirty), 'the appended file survived')
    assert.isFalse(
      gpsPointer.some((tag) => stripped.includes(tag)),
      'GPS survived'
    )
    assert.deepEqual([...stripped.subarray(-2)], [0xff, 0xd9], 'must end at its end of image')
  })

  test('refuses a JPEG that never ends instead of guessing where the image stops', async ({
    assert,
  }) => {
    const clean = await fixture('valid.jpg')
    assert.throws(() => stripImageMetadata(clean.subarray(0, clean.length - 2)))
  })

  test('keeps a JPEG segment only when it is needed to draw the image', async ({ assert }) => {
    const clean = await fixture('valid.jpg')
    const segment = (marker: number, body: string) => {
      const payload = Buffer.from(body, 'latin1')
      const header = Buffer.from([0xff, marker, 0, 0])
      header.writeUInt16BE(payload.length + 2, 2)
      return Buffer.concat([header, payload])
    }
    const withSegments = Buffer.concat([
      clean.subarray(0, 2),
      // APP11: where C2PA content credentials, with author and location, live.
      segment(0xeb, 'JP\0\0c2pa author=Fulano lat=-23.31'),
      // APP2 in its MPF use: an index pointing at an appended second image.
      segment(0xe2, 'MPF\0index-of-the-hidden-image'),
      // APP2 as an ICC profile changes colours and must stay.
      segment(0xe2, 'ICC_PROFILE\0\x01\x01colour-profile'),
      clean.subarray(2),
    ])

    const stripped = stripImageMetadata(withSegments)

    assert.isFalse(stripped.includes(Buffer.from('Fulano')))
    assert.isFalse(stripped.includes(Buffer.from('hidden-image')))
    assert.isTrue(stripped.includes(Buffer.from('colour-profile')))
  })

  for (const name of ['progressive_with_metadata.jpg', 'restart_with_metadata.jpg']) {
    test(`follows ${name} through every scan to its end`, async ({ assert }) => {
      // Progressive images interleave tables between several scans, and restart
      // markers sit inside the scan data; both must be crossed, not mistaken
      // for the end of the image.
      const original = await fixture(name)
      const stripped = stripImageMetadata(original)

      assert.isFalse(stripped.includes(Buffer.from('LeakyCam')))
      assert.isFalse(gpsPointer.some((tag) => stripped.includes(tag)))
      assert.isTrue(stripped.includes(orientationOnly))
      assert.isTrue(stripImageMetadata(stripped).equals(stripped))
    })
  }

  test('keeps only the PNG chunks needed to draw the image', async ({ assert }) => {
    const png = await fixture('valid.png')
    const chunk = (type: string, body: string) => {
      const data = Buffer.from(body, 'latin1')
      const header = Buffer.alloc(8)
      header.writeUInt32BE(data.length, 0)
      header.write(type, 4, 'latin1')
      const crc = Buffer.alloc(4)
      crc.writeUInt32BE(crc32(Buffer.concat([header.subarray(4), data])) >>> 0, 0)
      return Buffer.concat([header, data, crc])
    }
    const iend = png.length - 12
    const stripped = stripImageMetadata(
      Buffer.concat([
        png.subarray(0, iend),
        chunk('prVt', 'author=Fulano lat=-23.31'),
        chunk('caBX', 'c2pa manifest of Fulano'),
        png.subarray(iend),
      ])
    )

    assert.isFalse(stripped.includes(Buffer.from('Fulano')))
    assert.isTrue(stripped.equals(png), 'a clean PNG must come back as it was')
  })

  test('keeps only the WebP chunks needed to draw the image', async ({ assert }) => {
    const webp = await fixture('valid.webp')
    const data = Buffer.from('c2pa manifest of Fulano!', 'latin1')
    const header = Buffer.alloc(8)
    header.write('C2PA', 0, 'latin1')
    header.writeUInt32LE(data.length, 4)
    const body = Buffer.concat([webp.subarray(12), header, data])
    const riff = Buffer.alloc(12)
    riff.write('RIFF', 0, 'latin1')
    riff.writeUInt32LE(body.length + 4, 4)
    riff.write('WEBP', 8, 'latin1')

    const stripped = stripImageMetadata(Buffer.concat([riff, body]))

    assert.isFalse(stripped.includes(Buffer.from('Fulano')))
    assert.isTrue(stripped.equals(webp), 'a clean WebP must come back as it was')
  })
})
