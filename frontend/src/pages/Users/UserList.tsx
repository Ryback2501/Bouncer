import { useState } from 'react'
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query'
import { Link } from 'react-router-dom'
import { Plus, Search, Pencil, Trash2, ChevronLeft, ChevronRight, Users } from 'lucide-react'
import { getUsers, deleteUser, type User } from '../../api/users'
import { Button } from '../../components/shared/Button'
import { ConfirmDialog } from '../../components/shared/ConfirmDialog'
import { EmptyState } from '../../components/shared/EmptyState'
import { Badge } from '../../components/shared/Badge'
import { useToast } from '../../components/shared/Toast'
import { UserForm } from './UserForm'

const providerColor: Record<string, 'blue' | 'green' | 'gray'> = {
  google: 'blue',
  microsoft: 'green',
  apple: 'gray',
}

export function UserList() {
  const qc = useQueryClient()
  const toast = useToast()
  const [search, setSearch] = useState('')
  const [page, setPage] = useState(1)
  const [formOpen, setFormOpen] = useState(false)
  const [editing, setEditing] = useState<User | null>(null)
  const [deleting, setDeleting] = useState<User | null>(null)

  const { data, isLoading } = useQuery({
    queryKey: ['users', search, page],
    queryFn: () => getUsers({ search: search || undefined, page, limit: 20 }),
    placeholderData: (prev) => prev,
  })

  const deleteMutation = useMutation({
    mutationFn: (id: string) => deleteUser(id),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ['users'] })
      qc.invalidateQueries({ queryKey: ['dashboard'] })
      toast.success('User deleted')
      setDeleting(null)
    },
    onError: () => toast.error('Failed to delete user'),
  })

  const openCreate = () => { setEditing(null); setFormOpen(true) }
  const openEdit = (user: User) => { setEditing(user); setFormOpen(true) }

  const totalPages = data ? Math.ceil(data.total / data.limit) : 1

  return (
    <div className="space-y-4">
      <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
        <div className="relative">
          <Search size={14} className="absolute left-3 top-1/2 -translate-y-1/2 text-gray-400" />
          <input
            type="search"
            placeholder="Search by name or sub…"
            value={search}
            onChange={e => { setSearch(e.target.value); setPage(1) }}
            className="w-full rounded-lg border border-gray-300 pl-9 pr-3 py-2 text-sm focus:border-blue-500 focus:outline-none focus:ring-1 focus:ring-blue-500 sm:w-72"
          />
        </div>
        <Button onClick={openCreate}><Plus size={16} />New User</Button>
      </div>

      {isLoading ? (
        <div className="space-y-3">
          {[...Array(5)].map((_, i) => <div key={i} className="h-16 rounded-xl bg-gray-200 animate-pulse" />)}
        </div>
      ) : !data || data.users.length === 0 ? (
        <EmptyState
          icon={Users}
          title={search ? 'No users found' : 'No users yet'}
          description={search ? 'Try a different search.' : 'Add your first user to start assigning roles.'}
          action={!search ? <Button onClick={openCreate}><Plus size={16} />New User</Button> : undefined}
        />
      ) : (
        <>
          <div className="overflow-hidden rounded-xl border border-gray-200 bg-white shadow-sm">
            <table className="min-w-full divide-y divide-gray-200">
              <thead className="bg-gray-50">
                <tr>
                  <th className="px-4 py-3 text-left text-xs font-semibold uppercase tracking-wide text-gray-500">User</th>
                  <th className="hidden px-4 py-3 text-left text-xs font-semibold uppercase tracking-wide text-gray-500 sm:table-cell">Sub</th>
                  <th className="hidden px-4 py-3 text-left text-xs font-semibold uppercase tracking-wide text-gray-500 md:table-cell">Provider</th>
                  <th className="hidden px-4 py-3 text-center text-xs font-semibold uppercase tracking-wide text-gray-500 md:table-cell">Roles</th>
                  <th className="px-4 py-3 text-right text-xs font-semibold uppercase tracking-wide text-gray-500">Actions</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-gray-100">
                {data.users.map(user => (
                  <tr key={user.id} className="hover:bg-gray-50 transition-colors">
                    <td className="px-4 py-4">
                      <Link to={`/users/${user.id}`} className="font-medium text-blue-600 hover:underline">{user.name}</Link>
                    </td>
                    <td className="hidden px-4 py-4 sm:table-cell">
                      <span className="font-mono text-xs text-gray-500 break-all">{user.sub}</span>
                    </td>
                    <td className="hidden px-4 py-4 md:table-cell">
                      <Badge variant={providerColor[user.provider] ?? 'gray'}>{user.provider}</Badge>
                    </td>
                    <td className="hidden px-4 py-4 text-center md:table-cell">
                      <span className="text-sm text-gray-700">{user._count?.userRoles ?? 0}</span>
                    </td>
                    <td className="px-4 py-4">
                      <div className="flex items-center justify-end gap-1">
                        <Button variant="ghost" size="sm" onClick={() => openEdit(user)} title="Edit"><Pencil size={14} /></Button>
                        {!user.isGlobalAdmin && (
                          <Button variant="ghost" size="sm" onClick={() => setDeleting(user)} title="Delete"
                            className="text-red-500 hover:bg-red-50 hover:text-red-700">
                            <Trash2 size={14} />
                          </Button>
                        )}
                      </div>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>

          {totalPages > 1 && (
            <div className="flex items-center justify-between text-sm text-gray-600">
              <span>{data.total} users total</span>
              <div className="flex items-center gap-2">
                <Button variant="secondary" size="sm" onClick={() => setPage(p => p - 1)} disabled={page <= 1}>
                  <ChevronLeft size={14} />
                </Button>
                <span>Page {page} of {totalPages}</span>
                <Button variant="secondary" size="sm" onClick={() => setPage(p => p + 1)} disabled={page >= totalPages}>
                  <ChevronRight size={14} />
                </Button>
              </div>
            </div>
          )}
        </>
      )}

      <UserForm open={formOpen} onClose={() => setFormOpen(false)} existing={editing} />

      <ConfirmDialog
        open={!!deleting}
        onClose={() => setDeleting(null)}
        onConfirm={() => deleting && deleteMutation.mutate(deleting.id)}
        title="Delete User"
        message={`Are you sure you want to delete "${deleting?.name}"? All their role assignments will be removed.`}
        loading={deleteMutation.isPending}
      />
    </div>
  )
}
