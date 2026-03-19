import { useState } from 'react'
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query'
import { Link } from 'react-router-dom'
import { Plus, Pencil, Trash2, Key, Shield, AppWindow } from 'lucide-react'
import { getApplications, deleteApplication, type Application } from '../../api/applications'
import { Button } from '../../components/shared/Button'
import { ConfirmDialog } from '../../components/shared/ConfirmDialog'
import { EmptyState } from '../../components/shared/EmptyState'
import { useToast } from '../../components/shared/Toast'
import { ApplicationForm } from './ApplicationForm'

export function ApplicationList() {
  const qc = useQueryClient()
  const toast = useToast()
  const { data: apps = [], isLoading } = useQuery({ queryKey: ['applications'], queryFn: getApplications })

  const [formOpen, setFormOpen] = useState(false)
  const [editing, setEditing] = useState<Application | null>(null)
  const [deleting, setDeleting] = useState<Application | null>(null)

  const deleteMutation = useMutation({
    mutationFn: (id: string) => deleteApplication(id),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ['applications'] })
      qc.invalidateQueries({ queryKey: ['dashboard'] })
      toast.success('Application deleted')
      setDeleting(null)
    },
    onError: () => toast.error('Failed to delete application'),
  })

  const openCreate = () => { setEditing(null); setFormOpen(true) }
  const openEdit = (app: Application) => { setEditing(app); setFormOpen(true) }

  return (
    <div className="space-y-4">
      <div className="flex items-center justify-between">
        <p className="text-sm text-gray-500">{apps.length} application{apps.length !== 1 ? 's' : ''}</p>
        <Button onClick={openCreate}>
          <Plus size={16} />
          New Application
        </Button>
      </div>

      {isLoading ? (
        <div className="space-y-3">
          {[...Array(3)].map((_, i) => <div key={i} className="h-20 rounded-xl bg-gray-200 animate-pulse" />)}
        </div>
      ) : apps.length === 0 ? (
        <EmptyState
          icon={AppWindow}
          title="No applications yet"
          description="Create your first application to start managing roles."
          action={<Button onClick={openCreate}><Plus size={16} />New Application</Button>}
        />
      ) : (
        <div className="overflow-hidden rounded-xl border border-gray-200 bg-white shadow-sm">
          <table className="min-w-full divide-y divide-gray-200">
            <thead className="bg-gray-50">
              <tr>
                <th className="px-4 py-3 text-left text-xs font-semibold uppercase tracking-wide text-gray-500">Application</th>
                <th className="hidden px-4 py-3 text-left text-xs font-semibold uppercase tracking-wide text-gray-500 sm:table-cell">ID</th>
                <th className="hidden px-4 py-3 text-center text-xs font-semibold uppercase tracking-wide text-gray-500 md:table-cell">Roles</th>
                <th className="hidden px-4 py-3 text-center text-xs font-semibold uppercase tracking-wide text-gray-500 md:table-cell">Users</th>
                <th className="px-4 py-3 text-right text-xs font-semibold uppercase tracking-wide text-gray-500">Actions</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-gray-100">
              {apps.map(app => (
                <tr key={app.id} className="hover:bg-gray-50 transition-colors">
                  <td className="px-4 py-4">
                    <p className="font-medium text-gray-900">{app.name}</p>
                    <p className="text-xs text-gray-400 sm:hidden font-mono">{app.customId}</p>
                  </td>
                  <td className="hidden px-4 py-4 sm:table-cell">
                    <span className="font-mono text-sm text-gray-600">{app.customId}</span>
                  </td>
                  <td className="hidden px-4 py-4 text-center md:table-cell">
                    <span className="text-sm text-gray-700">{app._count?.roles ?? 0}</span>
                  </td>
                  <td className="hidden px-4 py-4 text-center md:table-cell">
                    <span className="text-sm text-gray-700">{app._count?.userRoles ?? 0}</span>
                  </td>
                  <td className="px-4 py-4">
                    <div className="flex items-center justify-end gap-1">
                      <Link to={`/applications/${app.id}/roles`}>
                        <Button variant="ghost" size="sm" title="Manage roles">
                          <Shield size={14} />
                          <span className="hidden sm:inline">Roles</span>
                        </Button>
                      </Link>
                      <Link to={`/applications/${app.id}/api-keys`}>
                        <Button variant="ghost" size="sm" title="API keys">
                          <Key size={14} />
                          <span className="hidden sm:inline">API Keys</span>
                        </Button>
                      </Link>
                      {app.customId !== 'bouncer' && (
                        <>
                          <Button variant="ghost" size="sm" onClick={() => openEdit(app)} title="Edit">
                            <Pencil size={14} />
                          </Button>
                          <Button variant="ghost" size="sm" onClick={() => setDeleting(app)} title="Delete"
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

      <ApplicationForm
        open={formOpen}
        onClose={() => setFormOpen(false)}
        existing={editing}
      />

      <ConfirmDialog
        open={!!deleting}
        onClose={() => setDeleting(null)}
        onConfirm={() => deleting && deleteMutation.mutate(deleting.id)}
        title="Delete Application"
        message={`Are you sure you want to delete "${deleting?.name}"? All roles and user assignments in this application will be permanently removed.`}
        loading={deleteMutation.isPending}
      />
    </div>
  )
}
