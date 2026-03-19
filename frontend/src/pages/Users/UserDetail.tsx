import { useState } from 'react'
import { useParams, Link } from 'react-router-dom'
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query'
import { ArrowLeft, Plus, Trash2, CheckCircle, XCircle } from 'lucide-react'
import { getUser } from '../../api/users'
import { removeRole } from '../../api/assignments'
import { Button } from '../../components/shared/Button'
import { Badge } from '../../components/shared/Badge'
import { ConfirmDialog } from '../../components/shared/ConfirmDialog'
import { EmptyState } from '../../components/shared/EmptyState'
import { useToast } from '../../components/shared/Toast'
import { AssignRoleModal } from './AssignRoleModal'
import type { UserRole } from '../../api/users'

function RoleStatus({ userRole }: { userRole: UserRole }) {
  const now = new Date()
  const expired = userRole.expiredAt && new Date(userRole.expiredAt) < now
  if (!userRole.active || expired) {
    return <Badge variant="red"><XCircle size={10} className="mr-1" />Inactive</Badge>
  }
  return <Badge variant="green"><CheckCircle size={10} className="mr-1" />Active</Badge>
}

export function UserDetail() {
  const { userId } = useParams<{ userId: string }>()
  const qc = useQueryClient()
  const toast = useToast()
  const [assignOpen, setAssignOpen] = useState(false)
  const [editingRole, setEditingRole] = useState<UserRole | null>(null)
  const [removingRole, setRemovingRole] = useState<UserRole | null>(null)

  const { data: user, isLoading } = useQuery({
    queryKey: ['user', userId],
    queryFn: () => getUser(userId!),
  })

  const removeMutation = useMutation({
    mutationFn: (userRole: UserRole) => removeRole(userId!, userRole.applicationId),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ['user', userId] })
      qc.invalidateQueries({ queryKey: ['dashboard'] })
      toast.success('Role removed')
      setRemovingRole(null)
    },
    onError: () => toast.error('Failed to remove role'),
  })

  if (isLoading) {
    return <div className="h-48 rounded-xl bg-gray-200 animate-pulse" />
  }
  if (!user) {
    return <div className="text-sm text-gray-500">User not found.</div>
  }

  return (
    <div className="space-y-6">
      <div className="flex items-center gap-3">
        <Link to="/users">
          <Button variant="ghost" size="sm"><ArrowLeft size={14} /> Users</Button>
        </Link>
      </div>

      {/* User info card */}
      <div className="rounded-xl border border-gray-200 bg-white p-6 shadow-sm">
        <div className="flex items-start justify-between gap-4 flex-wrap">
          <div>
            <h2 className="text-lg font-bold text-gray-900">{user.name}</h2>
            <div className="mt-1 flex flex-wrap items-center gap-2">
              <Badge variant="blue">{user.provider}</Badge>
              <span className="font-mono text-xs text-gray-500">{user.sub}</span>
            </div>
            <p className="mt-1 text-xs text-gray-400">Internal ID: {user.id}</p>
          </div>
        </div>
      </div>

      {/* Role assignments */}
      <div className="space-y-3">
        <div className="flex items-center justify-between">
          <h3 className="text-sm font-semibold text-gray-900">Role Assignments</h3>
          <Button size="sm" onClick={() => { setEditingRole(null); setAssignOpen(true) }}>
            <Plus size={14} /> Assign Role
          </Button>
        </div>

        {user.userRoles.length === 0 ? (
          <EmptyState
            icon={Plus}
            title="No roles assigned"
            description="Assign a role to this user in one of your applications."
            action={<Button size="sm" onClick={() => setAssignOpen(true)}><Plus size={14} />Assign Role</Button>}
          />
        ) : (
          <div className="overflow-hidden rounded-xl border border-gray-200 bg-white shadow-sm">
            <table className="min-w-full divide-y divide-gray-200">
              <thead className="bg-gray-50">
                <tr>
                  <th className="px-4 py-3 text-left text-xs font-semibold uppercase tracking-wide text-gray-500">Application</th>
                  <th className="px-4 py-3 text-left text-xs font-semibold uppercase tracking-wide text-gray-500">Role</th>
                  <th className="hidden px-4 py-3 text-left text-xs font-semibold uppercase tracking-wide text-gray-500 sm:table-cell">Status</th>
                  <th className="hidden px-4 py-3 text-left text-xs font-semibold uppercase tracking-wide text-gray-500 md:table-cell">Expires</th>
                  <th className="px-4 py-3 text-right text-xs font-semibold uppercase tracking-wide text-gray-500">Actions</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-gray-100">
                {user.userRoles.map(ur => (
                  <tr key={ur.id} className="hover:bg-gray-50 transition-colors">
                    <td className="px-4 py-3">
                      <p className="font-medium text-sm text-gray-900">{ur.application.name}</p>
                      <p className="text-xs font-mono text-gray-400">{ur.application.customId}</p>
                    </td>
                    <td className="px-4 py-3">
                      <p className="text-sm text-gray-900">{ur.role.name}</p>
                      <p className="text-xs font-mono text-gray-400">{ur.role.customId}</p>
                    </td>
                    <td className="hidden px-4 py-3 sm:table-cell">
                      <RoleStatus userRole={ur} />
                    </td>
                    <td className="hidden px-4 py-3 md:table-cell text-sm text-gray-500">
                      {ur.expiredAt ? new Date(ur.expiredAt).toLocaleDateString() : '—'}
                    </td>
                    <td className="px-4 py-3">
                      <div className="flex items-center justify-end gap-1">
                        <Button variant="ghost" size="sm" onClick={() => { setEditingRole(ur); setAssignOpen(true) }}>
                          Edit
                        </Button>
                        <Button variant="ghost" size="sm" onClick={() => setRemovingRole(ur)}
                          className="text-red-500 hover:bg-red-50 hover:text-red-700">
                          <Trash2 size={14} />
                        </Button>
                      </div>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </div>

      <AssignRoleModal
        open={assignOpen}
        onClose={() => { setAssignOpen(false); setEditingRole(null) }}
        userId={userId!}
        existing={editingRole}
        existingAppIds={user.userRoles.filter(ur => ur !== editingRole).map(ur => ur.applicationId)}
      />

      <ConfirmDialog
        open={!!removingRole}
        onClose={() => setRemovingRole(null)}
        onConfirm={() => removingRole && removeMutation.mutate(removingRole)}
        title="Remove Role"
        message={`Remove the role "${removingRole?.role.name}" from this user in "${removingRole?.application.name}"?`}
        confirmLabel="Remove"
        loading={removeMutation.isPending}
      />
    </div>
  )
}
