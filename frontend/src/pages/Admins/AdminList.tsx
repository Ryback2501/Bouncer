import { useState } from 'react'
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query'
import { useDeleteMutation } from '../../hooks/useDeleteMutation'
import { SkeletonList } from '../../components/shared/SkeletonList'
import { Plus, Trash2, UserCog, Users } from 'lucide-react'
import {
  getAdmins, getInvitations, createInvitation, deleteInvitation,
  type BouncerAdmin, type Invitation,
} from '../../api/invitations'
import { Button } from '../../components/shared/Button'
import { Badge } from '../../components/shared/Badge'
import { ConfirmDialog } from '../../components/shared/ConfirmDialog'
import { CopyableCode } from '../../components/shared/CopyableCode'
import { Modal } from '../../components/shared/Modal'
import { EmptyState } from '../../components/shared/EmptyState'
import { useToast } from '../../components/shared/useToast'

function invitationStatus(inv: Invitation): { label: string; variant: 'green' | 'red' | 'yellow' | 'gray' } {
  if (inv.usedAt) return { label: 'Used', variant: 'gray' }
  if (new Date(inv.expiresAt) < new Date()) return { label: 'Expired', variant: 'red' }
  return { label: 'Pending', variant: 'green' }
}

export function AdminList() {
  const qc = useQueryClient()
  const toast = useToast()
  const [inviteLink, setInviteLink] = useState<string | null>(null)
  const [revoking, setRevoking] = useState<Invitation | null>(null)

  const { data: admins = [], isLoading: adminsLoading } = useQuery({
    queryKey: ['admins'],
    queryFn: getAdmins,
  })

  const { data: invitations = [], isLoading: invitationsLoading } = useQuery({
    queryKey: ['invitations'],
    queryFn: getInvitations,
  })

  const createMutation = useMutation({
    mutationFn: createInvitation,
    onSuccess: (data) => {
      qc.invalidateQueries({ queryKey: ['invitations'] })
      setInviteLink(data.inviteUrl)
    },
    onError: () => toast.error('Failed to create invitation'),
  })

  const deleteMutation = useDeleteMutation<Invitation>({
    mutationFn: (inv) => deleteInvitation(inv.id),
    queryKey: ['invitations'],
    successMessage: 'Invitation revoked',
    errorMessage: 'Failed to revoke invitation',
    invalidateDashboard: false,
    onSuccess: () => setRevoking(null),
  })

  return (
    <div className="space-y-8">

      {/* ── Admins section ── */}
      <section className="space-y-4">
        <div className="flex items-center justify-between">
          <h2 className="text-sm font-semibold text-gray-700 uppercase tracking-wide">Bouncer Admins</h2>
          <span className="text-sm text-gray-500">{admins.length} admin{admins.length !== 1 ? 's' : ''}</span>
        </div>

        {adminsLoading ? (
          <SkeletonList count={2} height="h-14" />
        ) : admins.length === 0 ? (
          <EmptyState icon={Users} title="No admins" description="The first person to sign in becomes the global admin." />
        ) : (
          <div className="overflow-hidden rounded-xl border border-gray-200 bg-white shadow-sm">
            <table className="min-w-full divide-y divide-gray-200">
              <thead className="bg-gray-50">
                <tr>
                  <th className="px-4 py-3 text-left text-xs font-semibold uppercase tracking-wide text-gray-500">Name</th>
                  <th className="hidden px-4 py-3 text-left text-xs font-semibold uppercase tracking-wide text-gray-500 sm:table-cell">Email</th>
                  <th className="hidden px-4 py-3 text-left text-xs font-semibold uppercase tracking-wide text-gray-500 md:table-cell">Provider</th>
                  <th className="px-4 py-3 text-left text-xs font-semibold uppercase tracking-wide text-gray-500">Role</th>
                  <th className="hidden px-4 py-3 text-left text-xs font-semibold uppercase tracking-wide text-gray-500 lg:table-cell">Joined</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-gray-100">
                {admins.map((admin: BouncerAdmin) => (
                  <tr key={admin.id} className="hover:bg-gray-50 transition-colors">
                    <td className="px-4 py-4 text-sm font-medium text-gray-900">{admin.name}</td>
                    <td className="hidden px-4 py-4 text-sm text-gray-500 sm:table-cell">{admin.email ?? <span className="italic text-gray-400">—</span>}</td>
                    <td className="hidden px-4 py-4 text-sm text-gray-500 md:table-cell capitalize">{admin.provider}</td>
                    <td className="px-4 py-4">
                      {admin.isGlobalAdmin
                        ? <Badge variant="blue">Global Admin</Badge>
                        : <Badge variant="gray">Admin</Badge>}
                    </td>
                    <td className="hidden px-4 py-4 text-sm text-gray-500 lg:table-cell">
                      {new Date(admin.createdAt).toLocaleDateString()}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </section>

      {/* ── Invitations section ── */}
      <section className="space-y-4">
        <div className="flex items-center justify-between">
          <h2 className="text-sm font-semibold text-gray-700 uppercase tracking-wide">Invitations</h2>
          <Button onClick={() => createMutation.mutate()} disabled={createMutation.isPending}>
            <Plus size={16} />
            {createMutation.isPending ? 'Creating…' : 'Create Invitation'}
          </Button>
        </div>

        {invitationsLoading ? (
          <SkeletonList count={2} height="h-14" />
        ) : invitations.length === 0 ? (
          <EmptyState
            icon={UserCog}
            title="No invitations yet"
            description="Create an invitation link to add a new admin to Bouncer."
            action={
              <Button onClick={() => createMutation.mutate()} disabled={createMutation.isPending}>
                <Plus size={16} />Create Invitation
              </Button>
            }
          />
        ) : (
          <div className="overflow-hidden rounded-xl border border-gray-200 bg-white shadow-sm">
            <table className="min-w-full divide-y divide-gray-200">
              <thead className="bg-gray-50">
                <tr>
                  <th className="px-4 py-3 text-left text-xs font-semibold uppercase tracking-wide text-gray-500">Created By</th>
                  <th className="hidden px-4 py-3 text-left text-xs font-semibold uppercase tracking-wide text-gray-500 sm:table-cell">Created</th>
                  <th className="hidden px-4 py-3 text-left text-xs font-semibold uppercase tracking-wide text-gray-500 md:table-cell">Expires</th>
                  <th className="px-4 py-3 text-left text-xs font-semibold uppercase tracking-wide text-gray-500">Status</th>
                  <th className="px-4 py-3 text-right text-xs font-semibold uppercase tracking-wide text-gray-500">Actions</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-gray-100">
                {invitations.map((inv: Invitation) => {
                  const status = invitationStatus(inv)
                  const isPending = !inv.usedAt && new Date(inv.expiresAt) >= new Date()
                  return (
                    <tr key={inv.id} className="hover:bg-gray-50 transition-colors">
                      <td className="px-4 py-4 text-sm text-gray-900">{inv.createdBy.name}</td>
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
                          {isPending && (
                            <Button variant="ghost" size="sm" onClick={() => setInviteLink(inv.inviteUrl)}>
                              Copy Link
                            </Button>
                          )}
                          {isPending && (
                            <Button
                              variant="ghost" size="sm"
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
        )}
      </section>

      {/* Invite link modal */}
      <Modal open={!!inviteLink} onClose={() => setInviteLink(null)} title="Invitation Link" size="md">
        <div className="space-y-4">
          <div className="rounded-lg bg-blue-50 border border-blue-200 px-4 py-3 text-sm text-blue-800">
            Share this link with the person you want to invite. It expires in 24 hours and can only be used once.
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
