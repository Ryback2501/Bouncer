import { useMemo, useState } from 'react'
import { useQuery } from '@tanstack/react-query'
import { Plus, Trash2, UserCog } from 'lucide-react'
import { useDeleteMutation } from '../../hooks/useDeleteMutation'
import { SkeletonList } from '../../components/shared/SkeletonList'
import { Button } from '../../components/shared/Button'
import { Badge } from '../../components/shared/Badge'
import { ConfirmDialog } from '../../components/shared/ConfirmDialog'
import { CopyableCode } from '../../components/shared/CopyableCode'
import { Modal } from '../../components/shared/Modal'
import { EmptyState } from '../../components/shared/EmptyState'
import { getInvitations, deleteInvitation, type Invitation } from '../../api/invitations'
import { CreateInvitationModal } from './CreateInvitationModal'

function invitationStatus(inv: Invitation): { label: string; variant: 'green' | 'red' | 'yellow' | 'gray' } {
  if (inv.usedAt) return { label: 'Used', variant: 'gray' }
  if (new Date(inv.expiresAt) < new Date()) return { label: 'Expired', variant: 'red' }
  return { label: 'Pending', variant: 'green' }
}

interface AppGroup {
  applicationId: string
  applicationName: string
  applicationCustomId: string
  rows: Invitation[]
}

function groupByApplication(rows: Invitation[]): AppGroup[] {
  const map = new Map<string, AppGroup>()
  for (const row of rows) {
    let group = map.get(row.applicationId)
    if (!group) {
      group = {
        applicationId: row.applicationId,
        applicationName: row.application.name,
        applicationCustomId: row.application.customId,
        rows: [],
      }
      map.set(row.applicationId, group)
    }
    group.rows.push(row)
  }
  return [...map.values()].sort((a, b) => a.applicationName.localeCompare(b.applicationName))
}

export function InvitationList() {
  const [createOpen, setCreateOpen] = useState(false)
  const [inviteLink, setInviteLink] = useState<string | null>(null)
  const [revoking, setRevoking] = useState<Invitation | null>(null)

  const { data: invitations = [], isLoading } = useQuery({
    queryKey: ['invitations'],
    queryFn: getInvitations,
  })

  const groups = useMemo(() => groupByApplication(invitations), [invitations])

  const deleteMutation = useDeleteMutation<Invitation>({
    mutationFn: (inv) => deleteInvitation(inv.id),
    queryKey: ['invitations'],
    successMessage: 'Invitation revoked',
    errorMessage: 'Failed to revoke invitation',
    invalidateDashboard: true,
    onSuccess: () => setRevoking(null),
  })

  return (
    <div className="space-y-8">
      <div className="flex items-center justify-end">
        <Button onClick={() => setCreateOpen(true)}>
          <Plus size={16} />
          Create Invitation
        </Button>
      </div>

      {isLoading ? (
        <SkeletonList count={3} height="h-32" />
      ) : groups.length === 0 ? (
        <EmptyState
          icon={UserCog}
          title="No invitations yet"
          description="Create an invitation link to onboard a new user into any registered application."
          action={
            <Button onClick={() => setCreateOpen(true)}>
              <Plus size={16} />Create Invitation
            </Button>
          }
        />
      ) : (
        groups.map(group => (
          <section key={group.applicationId} className="space-y-4">
            <div className="flex items-center justify-between">
              <div>
                <h2 className="text-sm font-semibold text-gray-700 uppercase tracking-wide">
                  {group.applicationName}
                </h2>
                <p className="text-xs text-gray-500 mt-0.5">
                  <span className="font-mono">{group.applicationCustomId}</span>
                </p>
              </div>
              <span className="text-sm text-gray-500">
                {group.rows.length} invitation{group.rows.length !== 1 ? 's' : ''}
              </span>
            </div>

            <div className="overflow-hidden rounded-xl border border-gray-200 bg-white shadow-sm">
              <table className="min-w-full divide-y divide-gray-200">
                <thead className="bg-gray-50">
                  <tr>
                    <th className="px-4 py-3 text-left text-xs font-semibold uppercase tracking-wide text-gray-500">Role</th>
                    <th className="px-4 py-3 text-left text-xs font-semibold uppercase tracking-wide text-gray-500">Created By</th>
                    <th className="hidden px-4 py-3 text-left text-xs font-semibold uppercase tracking-wide text-gray-500 sm:table-cell">Created</th>
                    <th className="hidden px-4 py-3 text-left text-xs font-semibold uppercase tracking-wide text-gray-500 md:table-cell">Expires</th>
                    <th className="px-4 py-3 text-left text-xs font-semibold uppercase tracking-wide text-gray-500">Status</th>
                    <th className="px-4 py-3 text-right text-xs font-semibold uppercase tracking-wide text-gray-500">Actions</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-gray-100">
                  {group.rows.map(inv => {
                    const status = invitationStatus(inv)
                    const isPending = !inv.usedAt && new Date(inv.expiresAt) >= new Date()
                    return (
                      <tr key={inv.id} className="hover:bg-gray-50 transition-colors">
                        <td className="px-4 py-4">
                          <Badge variant="gray">{inv.role.name}</Badge>
                        </td>
                        <td className="px-4 py-4 text-sm text-gray-900">
                          {inv.createdBy?.name ?? <span className="italic text-gray-400">—</span>}
                        </td>
                        <td className="hidden px-4 py-4 text-sm text-gray-500 sm:table-cell">
                          {new Date(inv.createdAt).toLocaleDateString()}
                        </td>
                        <td className="hidden px-4 py-4 text-sm text-gray-500 md:table-cell">
                          {new Date(inv.expiresAt).toLocaleString()}
                        </td>
                        <td className="px-4 py-4">
                          <Badge variant={status.variant}>{status.label}</Badge>
                        </td>
                        <td className="px-4 py-4">
                          <div className="flex justify-end gap-2">
                            {isPending && inv.inviteUrl && (
                              <Button variant="ghost" size="sm" onClick={() => setInviteLink(inv.inviteUrl ?? null)}>
                                Copy Link
                              </Button>
                            )}
                            {isPending && (
                              <Button
                                variant="ghost"
                                size="sm"
                                className="text-red-500 hover:bg-red-50 hover:text-red-700"
                                onClick={() => setRevoking(inv)}
                              >
                                <Trash2 size={14} /> Revoke
                              </Button>
                            )}
                          </div>
                        </td>
                      </tr>
                    )
                  })}
                </tbody>
              </table>
            </div>
          </section>
        ))
      )}

      <CreateInvitationModal open={createOpen} onClose={() => setCreateOpen(false)} />

      <Modal open={!!inviteLink} onClose={() => setInviteLink(null)} title="Invitation Link" size="md">
        <div className="space-y-4">
          <div className="rounded-lg bg-blue-50 border border-blue-200 px-4 py-3 text-sm text-blue-800">
            Share this link with the invitee. It expires in 24 hours and can only be used once.
          </div>
          <CopyableCode value={inviteLink ?? ''} />
          <div className="flex justify-end">
            <Button onClick={() => setInviteLink(null)}>Done</Button>
          </div>
        </div>
      </Modal>

      <ConfirmDialog
        open={!!revoking}
        onClose={() => setRevoking(null)}
        onConfirm={() => revoking && deleteMutation.mutate(revoking)}
        title="Revoke Invitation"
        message="Revoke this invitation? The link will stop working immediately."
        confirmLabel="Revoke"
        loading={deleteMutation.isPending}
      />
    </div>
  )
}
