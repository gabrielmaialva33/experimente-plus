import { test } from '@japa/runner'
import { storedFileDisk } from '#shared/utils/storage_disk'

test.group('Media disk ownership after R2 switch', () => {
  test('retains filesystem ownership for legacy URLs and recognizes only the configured public base', ({
    assert,
  }) => {
    const key = 'media/1/revision/asset.png'
    const base = 'https://media.example.test/assets/'
    assert.equal(storedFileDisk(key, '/uploads/' + key, base), 'fs')
    assert.equal(storedFileDisk(key, 'https://catalog.example.test/uploads/' + key, base), 'fs')
    assert.equal(storedFileDisk(key, base + key, base), 'r2')
    assert.throws(() => storedFileDisk(key, 'https://different.example.test/' + key, base))
    assert.throws(() => storedFileDisk(key, base + 'other.png', base))
  })
})
