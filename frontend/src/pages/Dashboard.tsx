import { useQuery } from '@tanstack/react-query'
import { Link } from 'react-router-dom'
import { AppWindow, Users, Link as LinkIcon, Mail } from 'lucide-react'
import client from '../api/client'

interface Stats {
  applications: number
  users: number
  assignments: number
  invitations: number
}

function StatCard({
  to,
  label,
  value,
  icon: Icon,
  color,
}: {
  to: string
  label: string
  value: number
  icon: typeof AppWindow
  color: string
}) {
  return (
    <Link
      to={to}
      className="block rounded-xl bg-white border border-gray-200 p-6 shadow-sm transition hover:border-gray-300 hover:shadow-md focus:outline-none focus:ring-2 focus:ring-blue-500"
    >
      <div className="flex items-center justify-between">
        <div>
          <p className="text-sm font-medium text-gray-500">{label}</p>
          <p className="mt-1 text-3xl font-bold text-gray-900">{value.toLocaleString()}</p>
        </div>
        <div className={`flex h-12 w-12 items-center justify-center rounded-xl ${color}`}>
          <Icon size={22} className="text-white" />
        </div>
      </div>
    </Link>
  )
}

export function Dashboard() {
  const { data, isLoading } = useQuery<Stats>({
    queryKey: ['dashboard'],
    queryFn: () => client.get<Stats>('/dashboard').then(r => r.data),
  })

  if (isLoading) {
    return (
      <div className="grid grid-cols-2 gap-4 lg:grid-cols-4">
        {[...Array(4)].map((_, i) => (
          <div key={i} className="h-28 rounded-xl bg-gray-200 animate-pulse" />
        ))}
      </div>
    )
  }

  return (
    <div className="space-y-6">
      <div className="grid grid-cols-2 gap-4 lg:grid-cols-4">
        <StatCard to="/applications" label="Applications" value={data?.applications ?? 0} icon={AppWindow} color="bg-blue-500" />
        <StatCard to="/users" label="Users" value={data?.users ?? 0} icon={Users} color="bg-violet-500" />
        <StatCard to="/assignments" label="Assignments" value={data?.assignments ?? 0} icon={LinkIcon} color="bg-orange-500" />
        <StatCard to="/invitations" label="Invitations" value={data?.invitations ?? 0} icon={Mail} color="bg-emerald-500" />
      </div>

      <div className="rounded-xl bg-white border border-gray-200 p-6 shadow-sm">
        <h2 className="text-sm font-semibold text-gray-900 mb-1">API Integration</h2>
        <p className="text-sm text-gray-500 mb-4">Connected apps can query user access using the API.</p>
        <div className="rounded-lg bg-gray-50 border border-gray-200 p-4 font-mono text-sm text-gray-700">
          <p className="text-gray-400 mb-1"># Check if a user has a role in your application</p>
          <p>
            <span className="text-blue-600">GET</span>{' '}
            <span className="text-gray-900">/api/v1/access?sub=USER_SUB</span>
          </p>
          <p className="mt-1">
            <span className="text-green-700">Authorization: Bearer</span>{' '}
            <span className="text-yellow-600">{'<your-api-key>'}</span>
          </p>
        </div>
      </div>
    </div>
  )
}
