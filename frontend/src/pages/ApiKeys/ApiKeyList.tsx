import { useState } from 'react'
import { useParams, Link } from 'react-router-dom'
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query'
import { Plus, Trash2, Key, ArrowLeft } from 'lucide-react'
import { getApiKeys, createApiKey, deleteApiKey, type NewApiKey } from '../../api/apiKeys'
import { getApplication } from '../../api/applications'
import { Button } from '../../components/shared/Button'
import { Input } from '../../components/shared/Input'
import { ConfirmDialog } from '../../components/shared/ConfirmDialog'
import { EmptyState } from '../../components/shared/EmptyState'
import { CopyableCode } from '../../components/shared/CopyableCode'
import { Modal } from '../../components/shared/Modal'
import { useToast } from '../../components/shared/Toast'
import type { ApiKey } from '../../api/apiKeys'

export function ApiKeyList() {
  const { appId } = useParams<{ appId: string }>()
  const qc = useQueryClient()
  const toast = useToast()
  const [newKeyOpen, setNewKeyOpen] = useState(false)
  const [newLabel, setNewLabel] = useState('')
  const [generatedKey, setGeneratedKey] = useState<NewApiKey | null>(null)
  const [deleting, setDeleting] = useState<ApiKey | null>(null)

  const { data: app } = useQuery({ queryKey: ['application', appId], queryFn: () => getApplication(appId!) })
  const { data: keys = [], isLoading } = useQuery({ queryKey: ['api-keys', appId], queryFn: () => getApiKeys(appId!) })

  const createMutation = useMutation({
    mutationFn: () => createApiKey(appId!, newLabel || undefined),
    onSuccess: (data) => {
      qc.invalidateQueries({ queryKey: ['api-keys', appId] })
      setNewKeyOpen(false)
      setNewLabel('')
      setGeneratedKey(data)
    },
    onError: () => toast.error('Failed to generate API key'),
  })

  const deleteMutation = useMutation({
    mutationFn: (key: ApiKey) => deleteApiKey(appId!, key.id),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ['api-keys', appId] })
      toast.success('API key revoked')
      setDeleting(null)
    },
    onError: () => toast.error('Failed to revoke API key'),
  })

  return (
    <div className="space-y-4">
      <div className="flex items-center gap-3">
        <Link to="/applications">
          <Button variant="ghost" size="sm"><ArrowLeft size={14} /> Applications</Button>
        </Link>
        <span className="text-gray-400">/</span>
        <span className="text-sm font-medium text-gray-700">{app?.name ?? '…'}</span>
        <span className="text-gray-400">/</span>
        <span className="text-sm font-medium text-gray-700">API Keys</span>
      </div>

      <div className="flex items-center justify-between">
        <p className="text-sm text-gray-500">{keys.length} key{keys.length !== 1 ? 's' : ''}</p>
        <Button onClick={() => setNewKeyOpen(true)}><Plus size={16} />Generate Key</Button>
      </div>

      {isLoading ? (
        <div className="space-y-3">
          {[...Array(2)].map((_, i) => <div key={i} className="h-16 rounded-xl bg-gray-200 animate-pulse" />)}
        </div>
      ) : keys.length === 0 ? (
        <EmptyState
          icon={Key}
          title="No API keys"
          description="Generate an API key to allow your application to query Bouncer."
          action={<Button onClick={() => setNewKeyOpen(true)}><Plus size={16} />Generate Key</Button>}
        />
      ) : (
        <div className="overflow-hidden rounded-xl border border-gray-200 bg-white shadow-sm">
          <table className="min-w-full divide-y divide-gray-200">
            <thead className="bg-gray-50">
              <tr>
                <th className="px-4 py-3 text-left text-xs font-semibold uppercase tracking-wide text-gray-500">Label</th>
                <th className="hidden px-4 py-3 text-left text-xs font-semibold uppercase tracking-wide text-gray-500 sm:table-cell">Created</th>
                <th className="hidden px-4 py-3 text-left text-xs font-semibold uppercase tracking-wide text-gray-500 md:table-cell">Last Used</th>
                <th className="px-4 py-3 text-right text-xs font-semibold uppercase tracking-wide text-gray-500">Actions</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-gray-100">
              {keys.map(key => (
                <tr key={key.id} className="hover:bg-gray-50 transition-colors">
                  <td className="px-4 py-4">
                    <span className="font-medium text-sm text-gray-900">{key.label ?? <span className="text-gray-400 italic">unlabeled</span>}</span>
                  </td>
                  <td className="hidden px-4 py-4 text-sm text-gray-500 sm:table-cell">
                    {new Date(key.createdAt).toLocaleDateString()}
                  </td>
                  <td className="hidden px-4 py-4 text-sm text-gray-500 md:table-cell">
                    {key.lastUsedAt ? new Date(key.lastUsedAt).toLocaleDateString() : '—'}
                  </td>
                  <td className="px-4 py-4">
                    <div className="flex justify-end">
                      <Button variant="ghost" size="sm" onClick={() => setDeleting(key)}
                        className="text-red-500 hover:bg-red-50 hover:text-red-700">
                        <Trash2 size={14} /> Revoke
                      </Button>
                    </div>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}

      {/* Generate key modal */}
      <Modal open={newKeyOpen} onClose={() => setNewKeyOpen(false)} title="Generate API Key" size="sm">
        <div className="space-y-4">
          <Input
            label="Label (optional)"
            placeholder="production"
            value={newLabel}
            onChange={e => setNewLabel(e.target.value)}
          />
          <div className="flex justify-end gap-3">
            <Button variant="secondary" onClick={() => setNewKeyOpen(false)}>Cancel</Button>
            <Button onClick={() => createMutation.mutate()} disabled={createMutation.isPending}>
              {createMutation.isPending ? 'Generating…' : 'Generate'}
            </Button>
          </div>
        </div>
      </Modal>

      {/* Show generated key once */}
      <Modal open={!!generatedKey} onClose={() => setGeneratedKey(null)} title="API Key Generated" size="md">
        <div className="space-y-4">
          <div className="rounded-lg bg-yellow-50 border border-yellow-200 px-4 py-3 text-sm text-yellow-800">
            ⚠️ Copy this key now. It will not be shown again.
          </div>
          <CopyableCode value={generatedKey?.rawKey ?? ''} />
          <div className="flex justify-end">
            <Button onClick={() => setGeneratedKey(null)}>Done</Button>
          </div>
        </div>
      </Modal>

      <ConfirmDialog
        open={!!deleting}
        onClose={() => setDeleting(null)}
        onConfirm={() => deleting && deleteMutation.mutate(deleting)}
        title="Revoke API Key"
        message={`Revoke the key "${deleting?.label ?? 'unlabeled'}"? Any application using this key will immediately lose access.`}
        confirmLabel="Revoke"
        loading={deleteMutation.isPending}
      />
    </div>
  )
}
