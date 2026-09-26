/** Where a place stands, as a partner reads it on the overview and the places page. */
export type PlaceState = 'published' | 'pending_review' | 'changes_requested' | 'draft'

export const PLACE_STATE: Record<
  PlaceState,
  { label: string; variant: 'success' | 'info' | 'warning' | 'secondary' }
> = {
  published: { label: 'Publicado', variant: 'success' },
  pending_review: { label: 'Em análise', variant: 'info' },
  changes_requested: { label: 'Correções pedidas', variant: 'warning' },
  draft: { label: 'Rascunho', variant: 'secondary' },
}
