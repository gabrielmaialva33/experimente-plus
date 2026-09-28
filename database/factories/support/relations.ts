/**
 * The row a factory builder creates a relation for, when it runs under a
 * parent's `with(...)`. Lucid sets it on every builder (`FactoryBuilder.parent`)
 * but types it only inside the `with` callback; hooks read it through here and
 * narrow it with `instanceof`, so a child created on its own is unaffected.
 */
export function relationParent(builder: object): unknown {
  return (builder as { parent?: unknown }).parent
}
