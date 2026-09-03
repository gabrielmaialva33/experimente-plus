import { Head, Link, router } from '@inertiajs/react'
import { useMemo, useState } from 'react'
import {
  createColumnHelper,
  useTable,
  type OnChangeFn,
  type PaginationState,
  type SortingState,
} from '@tanstack/react-table'
import { Edit, MoreVertical, Plus, Search, Trash2 } from 'lucide-react'

import { MainLayout } from '~/layouts'
import { ConfirmDialog } from '~/components/confirm_dialog'
import {
  Card,
  CardContent,
  CardHeader,
  CardHeading,
  CardTitle,
  CardToolbar,
} from '~/components/ui/card'
import { Button } from '~/components/ui/button'
import { Input } from '~/components/ui/input'
import { Badge } from '~/components/ui/badge'
import { Avatar, AvatarFallback } from '~/components/ui/avatar'
import { DataGrid, DataGridContainer } from '~/components/ui/data-grid'
import { dataGridFeatures, type DataGridFeatures } from '~/components/ui/data-grid-features'
import { DataGridTable } from '~/components/ui/data-grid-table'
import { DataGridPagination } from '~/components/ui/data-grid-pagination'
import { DataGridColumnHeader } from '~/components/ui/data-grid-column-header'
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuLabel,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from '~/components/ui/dropdown-menu'
import { PageHeader } from '~/components/page_header'
import { useAuth } from '~/hooks/use_auth'
import type { PaginatedResponse } from '~/types'

interface UserRole {
  id: number
  name: string
  display_name?: string
}

interface UserRow {
  id: number
  full_name: string
  email: string
  username: string | null
  email_verified_at: string | null
  created_at: string
  roles?: UserRole[]
}

interface UsersPageProps {
  users: PaginatedResponse<UserRow>
  search: string
  sortBy: string
  direction: 'asc' | 'desc'
}

const columnHelper = createColumnHelper<DataGridFeatures, UserRow>()

function initialsOf(name: string) {
  return name
    .split(' ')
    .map((part) => part.charAt(0))
    .filter(Boolean)
    .slice(0, 2)
    .join('')
    .toUpperCase()
}

function formatDate(iso: string) {
  return new Date(iso).toLocaleDateString('pt-BR', {
    year: 'numeric',
    month: 'short',
    day: 'numeric',
  })
}

export default function UsersPage({ users, search, sortBy, direction }: UsersPageProps) {
  const { can } = useAuth()
  const canCreate = can('users.create')
  const canEdit = can('users.read') && can('users.update')
  const canDelete = can('users.delete')

  const [userToDelete, setUserToDelete] = useState<UserRow | null>(null)
  const [deleting, setDeleting] = useState(false)
  const [searchValue, setSearchValue] = useState(search)

  const currentPage = Number(users.meta.current_page)
  const perPage = Number(users.meta.per_page)
  const total = Number(users.meta.total)

  const navigate = (params: {
    page?: number
    perPage?: number
    sortBy?: string
    direction?: string
    search?: string
  }) => {
    router.get(
      '/users',
      {
        page: params.page ?? currentPage,
        per_page: params.perPage ?? perPage,
        sort_by: params.sortBy ?? sortBy,
        order: params.direction ?? direction,
        search: params.search ?? searchValue,
      },
      { preserveState: true, preserveScroll: true, replace: true }
    )
  }

  const sorting: SortingState = [{ id: sortBy, desc: direction === 'desc' }]
  const pagination: PaginationState = { pageIndex: currentPage - 1, pageSize: perPage }

  const handleSortingChange: OnChangeFn<SortingState> = (updater) => {
    const next = typeof updater === 'function' ? updater(sorting) : updater
    const first = next[0]
    if (first) {
      navigate({ sortBy: first.id, direction: first.desc ? 'desc' : 'asc', page: 1 })
    }
  }

  const handlePaginationChange: OnChangeFn<PaginationState> = (updater) => {
    const next = typeof updater === 'function' ? updater(pagination) : updater
    navigate({ page: next.pageIndex + 1, perPage: next.pageSize })
  }

  const columns = useMemo(
    () =>
      // `columns()` keeps each column's TValue intact across the array — v9
      // otherwise widens them to `unknown` and the defs stop matching.
      columnHelper.columns([
        columnHelper.accessor('full_name', {
          id: 'full_name',
          header: ({ column }) => <DataGridColumnHeader column={column} title="Nome" />,
          cell: ({ row }) => (
            <div className="flex items-center gap-3">
              <Avatar className="size-8">
                <AvatarFallback className="bg-primary/10 text-xs text-primary">
                  {initialsOf(row.original.full_name)}
                </AvatarFallback>
              </Avatar>
              <div className="min-w-0">
                <p className="truncate text-sm font-medium">{row.original.full_name}</p>
                <p className="truncate text-xs text-muted-foreground">{row.original.email}</p>
              </div>
            </div>
          ),
          enableSorting: true,
        }),
        columnHelper.accessor('roles', {
          id: 'roles',
          header: 'Papéis',
          cell: ({ row }) => {
            const roles = row.original.roles ?? []
            if (roles.length === 0) {
              return <span className="text-xs text-muted-foreground">—</span>
            }
            return (
              <div className="flex flex-wrap gap-1">
                {roles.map((role) => (
                  <Badge key={role.id} variant="secondary" appearance="light" size="sm">
                    {role.display_name ?? role.name}
                  </Badge>
                ))}
              </div>
            )
          },
          enableSorting: false,
        }),
        columnHelper.accessor('email_verified_at', {
          id: 'email_verified_at',
          header: 'Situação',
          cell: ({ row }) =>
            row.original.email_verified_at ? (
              <Badge variant="success" appearance="light" size="sm">
                Verificado
              </Badge>
            ) : (
              <Badge variant="warning" appearance="light" size="sm">
                Não verificado
              </Badge>
            ),
          enableSorting: false,
        }),
        columnHelper.accessor('created_at', {
          id: 'created_at',
          header: ({ column }) => <DataGridColumnHeader column={column} title="Cadastro" />,
          cell: ({ row }) => (
            <span className="text-sm text-muted-foreground">
              {formatDate(row.original.created_at)}
            </span>
          ),
          enableSorting: true,
        }),
        columnHelper.display({
          id: 'actions',
          header: '',
          cell: ({ row }) => (
            <DropdownMenu>
              <DropdownMenuTrigger asChild>
                <Button variant="ghost" mode="icon" size="sm" aria-label="Abrir ações do usuário">
                  <MoreVertical className="size-4" />
                </Button>
              </DropdownMenuTrigger>
              <DropdownMenuContent align="end">
                <DropdownMenuLabel>Ações</DropdownMenuLabel>
                <DropdownMenuSeparator />
                {canEdit && (
                  <DropdownMenuItem asChild>
                    <Link href={`/users/${row.original.id}/edit`}>
                      <Edit className="size-4" />
                      Editar usuário
                    </Link>
                  </DropdownMenuItem>
                )}
                {canEdit && canDelete && <DropdownMenuSeparator />}
                {canDelete && (
                  <DropdownMenuItem
                    variant="destructive"
                    onSelect={() => setUserToDelete(row.original)}
                  >
                    <Trash2 className="size-4" />
                    Desativar usuário
                  </DropdownMenuItem>
                )}
              </DropdownMenuContent>
            </DropdownMenu>
          ),
        }),
      ]),
    [canDelete, canEdit]
  )

  const table = useTable({
    features: dataGridFeatures,
    data: users.data,
    columns,
    state: {
      sorting,
      pagination,
      columnVisibility: { actions: canEdit || canDelete },
    },
    onSortingChange: handleSortingChange,
    onPaginationChange: handlePaginationChange,
    manualSorting: true,
    manualPagination: true,
    rowCount: total,
    getRowId: (row) => String(row.id),
  })

  const confirmDelete = () => {
    if (!userToDelete || !canDelete || deleting) return
    setDeleting(true)
    router.delete(`/users/${userToDelete.id}`, {
      preserveScroll: true,
      onFinish: () => {
        setDeleting(false)
        setUserToDelete(null)
      },
    })
  }

  return (
    <MainLayout>
      <Head title="Usuários" />

      <ConfirmDialog
        open={Boolean(userToDelete)}
        onOpenChange={(open) => !open && !deleting && setUserToDelete(null)}
        title="Desativar usuário?"
        description={`${userToDelete?.full_name ?? 'Este usuário'} não poderá mais entrar e sairá das listagens comuns. O histórico administrativo será preservado.`}
        confirmLabel="Desativar usuário"
        destructive
        processing={deleting}
        onConfirm={confirmDelete}
      />

      <div className="space-y-6">
        <PageHeader
          title="Usuários"
          description="Administre contas e seus papéis globais na plataforma."
          actions={
            canCreate ? (
              <Button asChild>
                <Link href="/users/create">
                  <Plus className="size-4" />
                  Adicionar usuário
                </Link>
              </Button>
            ) : undefined
          }
        />

        <Card>
          <CardHeader>
            <CardHeading>
              <CardTitle>Todos os usuários</CardTitle>
            </CardHeading>
            <CardToolbar>
              <form
                onSubmit={(event) => {
                  event.preventDefault()
                  navigate({ search: searchValue, page: 1 })
                }}
                className="relative"
              >
                <Search className="absolute start-3 top-1/2 size-4 -translate-y-1/2 text-muted-foreground" />
                <Input
                  type="search"
                  placeholder="Buscar por nome ou e-mail"
                  aria-label="Buscar usuários"
                  className="w-full ps-9 sm:w-64"
                  value={searchValue}
                  onChange={(event) => setSearchValue(event.target.value)}
                />
              </form>
            </CardToolbar>
          </CardHeader>
          <CardContent className="p-0">
            <DataGrid
              table={table}
              recordCount={total}
              tableLayout={{ rowBorder: true, headerBackground: true }}
              emptyMessage="Nenhum usuário encontrado."
            >
              <DataGridContainer border={false}>
                <DataGridTable />
              </DataGridContainer>
              <div className="border-t p-4">
                <DataGridPagination />
              </div>
            </DataGrid>
          </CardContent>
        </Card>
      </div>
    </MainLayout>
  )
}
