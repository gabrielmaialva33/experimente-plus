/**
 * Direction A table headers for the admin data grids: overline labels (small,
 * bold, spaced capitals in the muted tone), passed through the grid's own
 * `tableClassNames` so the shared primitive stays untouched.
 */
export const overlineHeaderRow =
  '[&_th]:text-xs [&_th]:font-bold [&_th]:uppercase [&_th]:tracking-[0.1em] [&_th]:text-muted-foreground [&_th_button]:text-xs [&_th_button]:font-bold [&_th_button]:uppercase [&_th_button]:tracking-[0.1em]'
