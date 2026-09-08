/** File rows predate disk metadata. Never delete an object on another disk after a default switch. */
export function storedFileDisk(key: string, storedUrl: string, publicBase?: string): 'fs' | 'r2' {
  const url = new URL(storedUrl, 'http://local.invalid')
  if (publicBase) {
    const base = new URL(publicBase)
    const expected = base.pathname.replace(/\/$/, '') + '/' + key
    if (url.origin === base.origin && decodeURI(url.pathname) === expected) return 'r2'
  }
  if (decodeURI(url.pathname) === '/uploads/' + key) return 'fs'
  throw new Error('Stored media URL has no recognized storage owner')
}
