import type { FormEventHandler } from 'react'
import { useMemo, useState } from 'react'
import { Search, Star, Tags } from 'lucide-react'

import {
  EditorSaveBar,
  EditorSection,
  type EditorDisplayIssue,
} from '~/components/portal/editor_section'
import { Badge } from '~/components/ui/badge'
import { Input } from '~/components/ui/input'
import { firstError } from '~/lib/form_errors'
import { numberValue, stringValue, type JsonRecord } from '~/lib/establishment_editor'
import { cn } from '~/lib/utils'
import { EditorDependencyNotice } from './dependency_notice'
import type { CategoriesForm } from './types'

interface CategoriesSectionProps {
  form: CategoriesForm
  categories: JsonRecord[]
  editable: boolean
  busy: boolean
  blockedByUnsavedAttributes?: boolean
  issues: EditorDisplayIssue[]
  onSubmit: FormEventHandler<HTMLFormElement>
  onReviewAttributes: () => void
}

export function CategoriesSection({
  form,
  categories,
  editable,
  busy,
  blockedByUnsavedAttributes = false,
  issues,
  onSubmit,
  onReviewAttributes,
}: CategoriesSectionProps) {
  const [query, setQuery] = useState('')
  const controlsDisabled = !editable || busy || blockedByUnsavedAttributes

  const selectedCategoryIds = useMemo(
    () => new Set(form.data.categories.map((item) => item.category_id)),
    [form.data.categories]
  )
  const categoryNames = useMemo(
    () =>
      new Map(categories.map((category) => [Number(category.id), stringValue(category, 'name')])),
    [categories]
  )
  const parentCategoryIds = useMemo(
    () =>
      new Set(
        categories
          .map((category) => numberValue(category, 'parent_id'))
          .filter((id): id is number => id !== null)
      ),
    [categories]
  )
  const visibleCategories = useMemo(() => {
    const normalizedQuery = query.trim().toLocaleLowerCase('pt-BR')
    return categories.filter((category) => {
      const id = Number(category.id)
      const parentId = numberValue(category, 'parent_id')
      const isLeaf = !parentCategoryIds.has(id)
      if (!isLeaf && !selectedCategoryIds.has(id)) return false
      if (!normalizedQuery) return true
      const parentName = parentId ? (categoryNames.get(parentId) ?? '') : ''
      return `${stringValue(category, 'name')} ${parentName}`
        .toLocaleLowerCase('pt-BR')
        .includes(normalizedQuery)
    })
  }, [categories, categoryNames, parentCategoryIds, query, selectedCategoryIds])

  const primaryCategory = form.data.categories.find((item) => item.is_primary)

  function toggleCategory(categoryId: number) {
    if (selectedCategoryIds.has(categoryId)) {
      let next = form.data.categories.filter((item) => item.category_id !== categoryId)
      if (next.length > 0 && !next.some((item) => item.is_primary)) {
        next = next.map((item, index) => ({ ...item, is_primary: index === 0 }))
      }
      form.setData(
        'categories',
        next.map((item, index) => ({ ...item, sort_order: index }))
      )
      return
    }

    form.setData('categories', [
      ...form.data.categories,
      {
        category_id: categoryId,
        is_primary: form.data.categories.length === 0,
        sort_order: form.data.categories.length,
      },
    ])
  }

  function setPrimaryCategory(categoryId: number) {
    form.setData(
      'categories',
      form.data.categories.map((item) => ({
        ...item,
        is_primary: item.category_id === categoryId,
      }))
    )
  }

  return (
    <EditorSection
      id="categories"
      icon={Tags}
      title="Categorias"
      description="Escolha as classificações mais precisas e defina uma principal. Ela controla as características e parte das regras de completude."
      issues={issues}
      toolbar={
        <Badge variant="secondary" appearance="light" size="sm">
          {form.data.categories.length}{' '}
          {form.data.categories.length === 1 ? 'selecionada' : 'selecionadas'}
        </Badge>
      }
    >
      <form onSubmit={onSubmit} aria-busy={form.processing}>
        <div className="space-y-5 p-5 sm:p-6">
          {blockedByUnsavedAttributes ? (
            <EditorDependencyNotice
              title="Salve as características antes de trocar categorias"
              description="A categoria principal define os campos efetivos. Para não perder alterações locais, conclua primeiro a etapa de características."
              actionLabel="Ir para características"
              onAction={onReviewAttributes}
            />
          ) : null}

          <div className="relative">
            <Search className="pointer-events-none absolute start-3 top-1/2 size-4 -translate-y-1/2 text-muted-foreground" />
            <Input
              variant="lg"
              value={query}
              onChange={(event) => setQuery(event.target.value)}
              placeholder="Buscar categoria ou família…"
              className="ps-9"
              aria-label="Buscar categorias"
              aria-controls="category-options"
            />
          </div>

          {primaryCategory ? (
            <div className="flex flex-wrap items-center gap-2 rounded-xl border border-primary/20 bg-primary/5 px-4 py-3 text-sm">
              <Star className="size-4 fill-primary text-primary" />
              <span className="font-medium">Categoria principal:</span>
              <span>{categoryNames.get(primaryCategory.category_id)}</span>
            </div>
          ) : null}

          <p className="text-xs text-muted-foreground" role="status" aria-live="polite">
            {visibleCategories.length}{' '}
            {visibleCategories.length === 1 ? 'categoria disponível' : 'categorias disponíveis'}
          </p>

          <div
            id="category-options"
            className="grid max-h-[30rem] gap-3 overflow-y-auto pe-1 sm:grid-cols-2 xl:grid-cols-3"
          >
            {visibleCategories.map((category) => {
              const id = Number(category.id)
              const parentId = numberValue(category, 'parent_id')
              const selectedItem = form.data.categories.find((item) => item.category_id === id)
              const selected = Boolean(selectedItem)
              const primary = selectedItem?.is_primary === true

              return (
                <div
                  key={id}
                  className={cn(
                    'rounded-xl border p-3.5 transition-colors',
                    selected
                      ? 'border-primary/30 bg-primary/5'
                      : 'border-border/70 bg-background hover:bg-muted/30'
                  )}
                >
                  <label className="flex cursor-pointer items-start gap-3">
                    <input
                      type="checkbox"
                      disabled={controlsDisabled}
                      checked={selected}
                      onChange={() => toggleCategory(id)}
                      className="mt-0.5 size-4 rounded border-input accent-primary"
                    />
                    <span className="min-w-0">
                      <span className="block text-sm font-medium">
                        {stringValue(category, 'name')}
                      </span>
                      {parentId ? (
                        <span className="mt-1 block text-xs text-muted-foreground">
                          {categoryNames.get(parentId)}
                        </span>
                      ) : null}
                    </span>
                  </label>

                  {selected ? (
                    <label className="mt-3 flex cursor-pointer items-center gap-2 border-t border-border/60 pt-3 text-xs font-medium text-muted-foreground">
                      <input
                        type="radio"
                        name="primary-category"
                        disabled={controlsDisabled}
                        checked={primary}
                        onChange={() => setPrimaryCategory(id)}
                        className="size-4 accent-primary"
                      />
                      Usar como categoria principal
                    </label>
                  ) : null}
                </div>
              )
            })}
          </div>

          {visibleCategories.length === 0 ? (
            <div className="rounded-xl border border-dashed border-border bg-muted/20 px-5 py-8 text-center text-sm text-muted-foreground">
              Nenhuma categoria corresponde à busca.
            </div>
          ) : null}

          {form.hasErrors ? (
            <p
              role="alert"
              className="rounded-lg border border-destructive/20 bg-destructive/10 px-3 py-2 text-sm text-destructive"
            >
              {firstError(form.errors)}
            </p>
          ) : null}
        </div>

        {editable ? (
          <EditorSaveBar
            processing={form.processing}
            recentlySuccessful={form.recentlySuccessful}
            dirty={form.isDirty}
            disabled={(busy && !form.processing) || blockedByUnsavedAttributes}
            label="Salvar categorias"
            onDiscard={() => {
              form.reset()
              form.clearErrors()
            }}
          />
        ) : null}
      </form>
    </EditorSection>
  )
}
