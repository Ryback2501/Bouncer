import { useState } from 'react'
import { Outlet, useLocation } from 'react-router-dom'
import { Sidebar } from './Sidebar'
import { Topbar } from './Topbar'

const pageTitles: Record<string, string> = {
  '/': 'Dashboard',
  '/applications': 'Applications',
  '/users': 'Users',
  '/admins': 'Admin Access',
}

function getTitle(pathname: string): string {
  if (pageTitles[pathname]) return pageTitles[pathname]
  if (pathname.startsWith('/applications/') && pathname.endsWith('/roles')) return 'Roles'
  if (pathname.startsWith('/applications/') && pathname.endsWith('/api-keys')) return 'API Keys'
  if (pathname.startsWith('/users/')) return 'User Details'
  return 'Bouncer'
}

export function AppShell() {
  const [sidebarOpen, setSidebarOpen] = useState(false)
  const location = useLocation()
  const title = getTitle(location.pathname)

  return (
    <div className="flex h-screen overflow-hidden bg-gray-50">
      <Sidebar open={sidebarOpen} onClose={() => setSidebarOpen(false)} />
      <div className="flex flex-1 flex-col overflow-hidden">
        <Topbar onMenuClick={() => setSidebarOpen(o => !o)} title={title} />
        <main className="flex-1 overflow-y-auto p-4 md:p-6">
          <Outlet />
        </main>
      </div>
    </div>
  )
}
