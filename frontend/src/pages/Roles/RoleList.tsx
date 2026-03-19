import { useState } from 'react'
import { useParams, Link } from 'react-router-dom'
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query'
import { Plus, Pencil, Trash2, ArrowLeft, Shield } from 'lucide-react'
import { getRoles, deleteRole, type Role } from '../../api/roles'
import { getApplication } from '../../api/applications'
import { Button } from '../../components/shared/Button'
import { ConfirmDialog } from '../../components/shared/ConfirmDialog'
import { EmptyState } from '../../components/shared/EmptyState'
import { useToast } from '../../components/shared/useToast'
import { RoleForm } from './RoleForm'

export function RoleList() {
  const { appId } = useParams<{ appId: string }>()
  const qc = useQueryClient()
  const toast = useToast()

  const { data: app } = useQuery({ queryKey: ['application', appId], queryFn: () => getApplication(appId!) })
  const { data: roles = [], isLoading } = useQuery({ queryKey: ['roles', appId], queryFn: () => getRoles(appId!) })

  const [formOpen, setFormOpen] = useState(false)
  const [editing, setEditing] = useState<Role | null>(null)
  const [deleting, setDeleting] = useState<Role | null>(null)

  const deleteMutation = useMutation({
    mutationFn: (role: Role) => deleteRole(appId!, role.id),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ['roles', appId] })
      qc.invalidateQueries({ queryKey: ['dashboard'] })
      toast.success('Role deleted')
      setDeleting(null)
    },
    onError: () => toast.error('Failed to delete role'),
  })

  const openCreate = () => { setEditing(null); setFormOpen(true) }
  const openEdit = (role: Role) => { setEditing(role); setFormOpen(true) }

  return (
    <div className="space-y-4">
      <div className="flex items-center gap-3">
        <Link to="/applications">
          <Button variant="ghost" size="sm"><ArrowLeft size={14} /> Applications</Button>
        </Link>
        <span className="text-gray-400">/</span>
        <span className="text-sm font-medium text-gray-700">{app?.name ?? '…'}</span>
        <span className="text-gray-400">/</span>
        <span className="text-sm font-medium text-gray-700">Roles</span>
      </div>

      <div className="flex items-center justify-between">
        <p className="text-sm text-gray-500">{roles.length} role{roles.length !== 1 ? 's' : ''}</p>
        <Button onClick={openCreate}><Plus size={16} />New Role</Button>
      </div>

      {isLoading ? (
        <div className="space-y-3">
          {[...Array(3)].map((_, i) => <div key={i} className="h-16 rounded-xl bg-gray-200 animate-pulse" />)}
        </div>
      ) : roles.length === 0 ? (
        <EmptyState
          icon={Shield}
          title="No roles yet"
          description="Create roles to assign to users within this application."
          action={<Button onClick={openCreate}><Plus size={16} />New Role</Button>}
        />
      ) : (
        <div className="overflow-hidden rounded-xl border border-gray-200 bg-white shadow-sm">
          <table className="min-w-full divide-y divide-gray-200">
            <thead className="bg-gray-50">
              <tr>
                <th className="px-4 py-3 text-left text-xs font-semibold uppercase tracking-wide text-gray-500">Role</th>
                <th className="hidden px-4 py-3 text-left text-xs font-semibold uppercase tracking-wide text-gray-500 sm:table-cell">ID</th>
                <th className="hidden px-4 py-3 text-center text-xs font-semibold uppercase tracking-wide text-gray-500 md:table-cell">Assigned Users</th>
                <th className="px-4 py-3 text-right text-xs font-semibold uppercase tracking-wide text-gray-500">Actions</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-gray-100">
              {roles.map(role => (
                <tr key={role.id} className="hover:bg-gray-50 transition-colors">
                  <td className="px-4 py-4">
                    <p className="font-medium text-gray-900">{role.name}</p>
                    <p className="text-xs text-gray-400 sm:hidden font-mono">{role.customId}</p>
                  </td>
                  <td className="hidden px-4 py-4 sm:table-cell">
                    <span className="font-mono text-sm text-gray-600">{role.customId}</span>
                  </td>
                  <td className="hidden px-4 py-4 text-center md:table-cell">
                    <span className="text-sm text-gray-700">{role._count?.userRoles ?? 0}</span>
                  </td>
                  <td className="px-4 py-4">
                    <div className="flex items-center justify-end gap-1">
                      {!(app?.customId === 'bouncer' && role.customId === 'admin') && (
                        <>
                          <Button variant="ghost" size="sm" onClick={() => openEdit(role)} title="Edit">
                            <Pencil size={14} />
                          </Button>
                          <Button variant="ghost" size="sm" onClick={() => setDeleting(role)} title="Delete"
                            className="text-red-500 hover:bg-red-50 hover:text-red-700">
                            <Trash2 size={14} />
                          </Button>
                        </>
                      )}
                    </div>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}

      <RoleForm open={formOpen} onClose={() => setFormOpen(false)} appId={appId!} existing={editing} />

      <ConfirmDialog
        open={!!deleting}
        onClose={() => setDeleting(null)}
        onConfirm={() => deleting && deleteMutation.mutate(deleting)}
        title="Delete Role"
        message={`Are you sure you want to delete the role "${deleting?.name}"? Users with this role will lose their assignment.`}
        loading={deleteMutation.isPending}
      />
    </div>
  )
}
