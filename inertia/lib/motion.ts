/**
 * How a scripted scroll moves. The stylesheet turns smooth scrolling off for
 * `prefers-reduced-motion`, but an explicit `behavior: 'smooth'` in a script
 * overrides it: every scripted scroll asks here instead.
 */
export function scrollBehavior(): ScrollBehavior {
  const reduce =
    typeof window !== 'undefined' &&
    (window.matchMedia?.('(prefers-reduced-motion: reduce)').matches ?? false)
  return reduce ? 'auto' : 'smooth'
}
