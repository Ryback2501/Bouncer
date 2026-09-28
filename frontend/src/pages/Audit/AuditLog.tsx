import { useState } from 'react'
import { useQuery } from '@tanstack/react-query'
import { ChevronLeft, ChevronRight, ScrollText } from 'lucide-react'
import { getAuditEvents, type AuditEvent, type AuditOutcome, type AuditQuery } from '../../api/audit'
import { Button } from '../../components/shared/Button'
import { EmptyState } from '../../components/shared/EmptyState'
import { Badge } from '../../components/shared/Badge'
import { Select } from '../../components/shared/Select'
import { SkeletonList } from '../../components/shared/SkeletonList'

const PAGE_SIZE = 25

// Category = action prefix sent to GET /admin/audit.
const categories: { value: string; label: string }[] = [
  { value: '', label: 'All' },
  { value: 'auth.', label: 'Sign-in' },
  { value: 'application.', label: 'Applications' },
  { value: 'role.', label: 'Roles' },
  { value: 'user.', label: 'Users' },
  { value: 'assignment.', label: 'Assignments' },
  { value: 'api_key.', label: 'API keys' },
  { value: 'invitation.', label: 'Invitations' },
]

const outcomeBadge: Record<AuditOutcome, { label: string; variant: 'green' | 'red' | 'yellow' }> = {
  success: { label: 'Success', variant: 'green' },
  denied: { label: 'Denied', variant: 'red' },
  failure: { label: 'Failure', variant: 'yellow' },
}

function actorText(e: AuditEvent): string {
  if (e.actorType === 'api_key') return `API key: ${e.actorLabel ?? e.actorId ?? 'unknown'}`
  if (e.actorType === 'user') return e.actorLabel ?? e.actorId ?? 'Unknown user'
  return 'Anonymous'
}

function targetText(e: AuditEvent): string {
  if (!e.targetType) return '—'
  return e.targetLabel ?? e.targetId ?? e.targetType
}

export function AuditLog() {
  const [category, setCategory] = useState('')
  const [outcome, setOutcome] = useState<AuditOutcome | ''>('')
  const [page, setPage] = useState(1)

  const query: AuditQuery = {
    page,
    limit: PAGE_SIZE,
    ...(category && { action: category }),
    ...(outcome && { outcome }),
  }
  const { data, isLoading } = useQuery({
    queryKey: ['audit', category, outcome, page],
    queryFn: () => getAuditEvents(query),
    placeholderData: (prev) => prev,
  })

  const totalPages = data ? Math.max(1, Math.ceil(data.total / data.limit)) : 1
  const filtered = category !== '' || outcome !== ''

  return (
    <div className="space-y-4">
      <div className="flex flex-col gap-3 sm:flex-row sm:items-end">
        <div className="sm:w-56">
          <Select label="Category" value={category} onChange={e => { setCategory(e.target.value); setPage(1) }}>
            {categories.map(c => <option key={c.value} value={c.value}>{c.label}</option>)}
          </Select>
        </div>
        <div className="sm:w-44">
          <Select label="Outcome" value={outcome} onChange={e => { setOutcome(e.target.value as AuditOutcome | ''); setPage(1) }}>
            <option value="">All</option>
            <option value="success">Success</option>
            <option value="denied">Denied</option>
            <option value="failure">Failure</option>
          </Select>
        </div>
      </div>

      {isLoading ? (
        <SkeletonList count={5} />
      ) : !data || data.events.length === 0 ? (
        <EmptyState
          icon={ScrollText}
          title={filtered ? 'No matching events' : 'No audit events yet'}
          description={filtered ? 'Try a different filter.' : 'Sign-ins and admin changes will appear here.'}
        />
      ) : (
        <>
          <div className="overflow-x-auto rounded-xl border border-gray-200 bg-white shadow-sm">
            <table className="min-w-full divide-y divide-gray-200">
              <thead className="bg-gray-50">
                <tr>
                  <th className="px-4 py-3 text-left text-xs font-semibold uppercase tracking-wide text-gray-500">Time</th>
                  <th className="px-4 py-3 text-left text-xs font-semibold uppercase tracking-wide text-gray-500">Action</th>
                  <th className="px-4 py-3 text-left text-xs font-semibold uppercase tracking-wide text-gray-500">Outcome</th>
                  <th className="px-4 py-3 text-left text-xs font-semibold uppercase tracking-wide text-gray-500">Actor</th>
                  <th className="hidden px-4 py-3 text-left text-xs font-semibold uppercase tracking-wide text-gray-500 md:table-cell">Target</th>
                  <th className="hidden px-4 py-3 text-left text-xs font-semibold uppercase tracking-wide text-gray-500 lg:table-cell">IP</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-gray-100">
                {data.events.map(e => (
                  <tr key={e.id} className="hover:bg-gray-50 transition-colors">
                    <td className="whitespace-nowrap px-4 py-3 text-sm text-gray-600">
                      <time dateTime={e.createdAt}>{new Date(e.createdAt).toLocaleString()}</time>
                    </td>
                    <td className="px-4 py-3">
                      <span className="font-mono text-xs text-gray-800">{e.action}</span>
                    </td>
                    <td className="px-4 py-3">
                      <Badge variant={outcomeBadge[e.outcome]?.variant ?? 'gray'}>{outcomeBadge[e.outcome]?.label ?? e.outcome}</Badge>
                    </td>
                    <td className="px-4 py-3 text-sm text-gray-800">{actorText(e)}</td>
                    <td className="hidden px-4 py-3 text-sm text-gray-700 md:table-cell">{targetText(e)}</td>
                    <td className="hidden px-4 py-3 lg:table-cell">
                      <span className="font-mono text-xs text-gray-500">{e.ip ?? '—'}</span>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>

          {totalPages > 1 && (
            <div className="flex items-center justify-between text-sm text-gray-600">
              <span>{data.total} events</span>
              <div className="flex items-center gap-2">
                <Button variant="secondary" size="sm" title="Previous page" onClick={() => setPage(p => p - 1)} disabled={page <= 1}>
                  <ChevronLeft size={14} />
                </Button>
                <span>Page {page} of {totalPages}</span>
                <Button variant="secondary" size="sm" title="Next page" onClick={() => setPage(p => p + 1)} disabled={page >= totalPages}>
                  <ChevronRight size={14} />
                </Button>
              </div>
            </div>
          )}
        </>
      )}
    </div>
  )
}
