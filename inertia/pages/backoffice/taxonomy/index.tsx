import { Head } from '@inertiajs/react'
import { FolderTree, Tags } from 'lucide-react'

import { ResourceSection } from '~/components/backoffice/resource_section'
import { PageHeader } from '~/components/page_header'
import { useAuth } from '~/hooks/use_auth'
import { MainLayout } from '~/layouts/main_layout'
import { collection, numeric, text, type JsonRecord } from '~/lib/json'
import type { FieldSpec } from '~/lib/resource_form'

interface TaxonomyPageProps {
  families: unknown
  categories: unknown
}

const familyFields: FieldSpec[] = [
  { name: 'name', label: 'Nome', type: 'text', required: true },
  {
    name: 'slug',
    label: 'Slug',
    type: 'text',
    omitWhenBlank: true,
    hint: 'Em branco, é gerado a partir do nome',
    advanced: true,
  },
  { name: 'description', label: 'Descrição', type: 'textarea', nullable: true },
  { name: 'icon', label: 'Ícone', type: 'text', nullable: true, advanced: true },
  {
    name: 'sort_order',
    label: 'Ordem',
    type: 'number',
    defaultValue: '0',
    step: '1',
    advanced: true,
  },
]

export default function BackofficeTaxonomy({ families, categories }: TaxonomyPageProps) {
  const { can } = useAuth()
  const familyRows = collection(families)
  const categoryRows = collection(categories)

  const familyName = new Map(familyRows.map((row) => [numeric(row, 'id'), text(row, 'name')]))
  const categoryName = new Map(categoryRows.map((row) => [numeric(row, 'id'), text(row, 'name')]))

  const categoryFields: FieldSpec[] = [
    {
      name: 'family_id',
      label: 'Família',
      type: 'select',
      numeric: true,
      required: true,
      defaultValue: familyRows[0] ? String(numeric(familyRows[0], 'id')) : '',
      options: familyRows.map((row) => ({
        value: String(numeric(row, 'id')),
        label: text(row, 'name'),
      })),
    },
    {
      name: 'parent_id',
      label: 'Categoria mãe',
      type: 'select',
      numeric: true,
      nullable: true,
      hint: 'Opcional. Precisa ser da mesma família',
      options: categoryRows.map((row) => ({
        value: String(numeric(row, 'id')),
        label: text(row, 'name'),
      })),
    },
    ...familyFields,
    {
      name: 'allows_always_open',
      label: 'Permite funcionamento 24 horas',
      type: 'checkbox',
      defaultValue: false,
    },
  ]

  // Slugs and ordering are technical; the list says what a person reads.
  const describeFamily = (row: JsonRecord) => ({
    name: text(row, 'name'),
    meta: text(row, 'description'),
  })

  const describeCategory = (row: JsonRecord) => {
    const parent = row.parent_id ? categoryName.get(numeric(row, 'parent_id')) : null
    return {
      name: text(row, 'name'),
      meta: [familyName.get(numeric(row, 'family_id')), parent ? `dentro de ${parent}` : null]
        .filter(Boolean)
        .join(' · '),
    }
  }

  return (
    <MainLayout>
      <Head title="Categorias" />
      <div className="space-y-6">
        <PageHeader
          eyebrow="Administração · catálogo"
          icon={Tags}
          title="Categorias"
          description="Famílias e categorias que organizam a descoberta. Nada é apagado: uma categoria sai de uso sendo desativada, e o histórico das unidades que a usaram continua de pé."
        />

        <ResourceSection
          id="families"
          title="Famílias"
          description="O agrupamento mais amplo, como Comer & Beber."
          icon={FolderTree}
          records={familyRows}
          fields={familyFields}
          basePath="/backoffice/taxonomy/families"
          createLabel="Nova família"
          emptyLabel="Nenhuma família cadastrada"
          describe={describeFamily}
          deactivateEffect="As categorias desta família deixam de aparecer na descoberta. Nada é apagado, e dá para reativar depois."
          canCreate={can('category_families.create')}
          canUpdate={can('category_families.update')}
        />

        <ResourceSection
          id="categories"
          title="Categorias"
          description="O que o visitante filtra e o parceiro escolhe para a própria unidade."
          icon={Tags}
          records={categoryRows}
          fields={categoryFields}
          basePath="/backoffice/taxonomy/categories"
          createLabel="Nova categoria"
          emptyLabel="Nenhuma categoria cadastrada"
          describe={describeCategory}
          deactivateEffect="A categoria sai dos filtros da descoberta. As unidades que já a usam continuam cadastradas, e dá para reativar depois."
          canCreate={can('categories.create') && familyRows.length > 0}
          canUpdate={can('categories.update')}
        />
      </div>
    </MainLayout>
  )
}
