import { useMemo } from 'react'
import { useQuery } from '@tanstack/react-query'
import { Users } from 'lucide-react'
import { SkeletonList } from '../../components/shared/SkeletonList'
import { Badge } from '../../components/shared/Badge'
import { EmptyState } from '../../components/shared/EmptyState'
import { getAssignments, type Assignment } from '../../api/assignments'

function assignmentStatus(a: Assignment): { label: string; variant: 'green' | 'red' | 'yellow' | 'gray' } {
  if (a.expiredAt && new Date(a.expiredAt) < new Date()) {
    return { label: 'Expired', variant: 'yellow' }
  }
  if (!a.active) return { label: 'Inactive', variant: 'gray' }
  return { label: 'Active', variant: 'green' }
}

interface AppGroup {
  applicationId: string
  applicationName: string
  applicationCustomId: string
  rows: Assignment[]
}

function groupByApplication(rows: Assignment[]): AppGroup[] {
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

export function AssignmentList() {
  const { data: rows = [], isLoading } = useQuery({
    queryKey: ['assignments'],
    queryFn: getAssignments,
  })

  const groups = useMemo(() => groupByApplication(rows), [rows])

  if (isLoading) {
    return <SkeletonList count={3} height="h-32" />
  }

  if (groups.length === 0) {
    return (
      <EmptyState
        icon={Users}
        title="No assignments yet"
        description="Once users are invited or assigned to an application, they appear here grouped by application."
      />
    )
  }

  return (
    <div className="space-y-8">
      {groups.map(group => (
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
              {group.rows.length} user{group.rows.length !== 1 ? 's' : ''}
            </span>
          </div>

          <div className="overflow-hidden rounded-xl border border-gray-200 bg-white shadow-sm">
            <table className="min-w-full divide-y divide-gray-200">
              <thead className="bg-gray-50">
                <tr>
                  <th className="px-4 py-3 text-left text-xs font-semibold uppercase tracking-wide text-gray-500">Name</th>
                  <th className="hidden px-4 py-3 text-left text-xs font-semibold uppercase tracking-wide text-gray-500 sm:table-cell">Email</th>
                  <th className="hidden px-4 py-3 text-left text-xs font-semibold uppercase tracking-wide text-gray-500 md:table-cell">Provider</th>
                  <th className="px-4 py-3 text-left text-xs font-semibold uppercase tracking-wide text-gray-500">Role</th>
                  <th className="px-4 py-3 text-left text-xs font-semibold uppercase tracking-wide text-gray-500">Status</th>
                  <th className="hidden px-4 py-3 text-left text-xs font-semibold uppercase tracking-wide text-gray-500 lg:table-cell">Joined</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-gray-100">
                {group.rows.map(row => {
                  const status = assignmentStatus(row)
                  return (
                    <tr key={row.id} className="hover:bg-gray-50 transition-colors">
                      <td className="px-4 py-4 text-sm font-medium text-gray-900">{row.user.name}</td>
                      <td className="hidden px-4 py-4 text-sm text-gray-500 sm:table-cell">
                        {row.user.email ?? <span className="italic text-gray-400">—</span>}
                      </td>
                      <td className="hidden px-4 py-4 text-sm text-gray-500 md:table-cell capitalize">
                        {row.user.provider}
                      </td>
                      <td className="px-4 py-4">
                        {row.user.isGlobalAdmin
                          ? <Badge variant="blue">Global Admin</Badge>
                          : <Badge variant="gray">{row.role.name}</Badge>}
                      </td>
                      <td className="px-4 py-4">
                        <Badge variant={status.variant}>{status.label}</Badge>
                      </td>
                      <td className="hidden px-4 py-4 text-sm text-gray-500 lg:table-cell">
                        {new Date(row.user.createdAt).toLocaleDateString()}
                      </td>
                    </tr>
                  )
                })}
              </tbody>
            </table>
          </div>
        </section>
      ))}
    </div>
  )
}
