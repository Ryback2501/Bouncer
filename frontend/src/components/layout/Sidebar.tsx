import { NavLink } from 'react-router-dom'
import { LayoutDashboard, AppWindow, Users, X, Shield, UserCog } from 'lucide-react'
import { cn } from '../shared/cn'

const navItems = [
  { to: '/', label: 'Dashboard', icon: LayoutDashboard, end: true },
  { to: '/applications', label: 'Applications', icon: AppWindow },
  { to: '/users', label: 'Users', icon: Users },
  { to: '/admins', label: 'Admin Access', icon: UserCog },
]

interface SidebarProps {
  open: boolean
  onClose: () => void
}

export function Sidebar({ open, onClose }: SidebarProps) {
  return (
    <>
      {/* Mobile overlay */}
      {open && (
        <div className="fixed inset-0 z-20 bg-black/40 lg:hidden" onClick={onClose} />
      )}

      {/* Sidebar panel */}
      <aside
        className={cn(
          'fixed inset-y-0 left-0 z-30 flex w-64 flex-col bg-gray-900 transition-transform duration-200 lg:static lg:translate-x-0',
          open ? 'translate-x-0' : '-translate-x-full'
        )}
      >
        {/* Logo */}
        <div className="flex h-16 items-center gap-3 px-5 border-b border-gray-700">
          <div className="flex h-8 w-8 items-center justify-center rounded-lg bg-blue-600">
            <Shield size={16} className="text-white" />
          </div>
          <span className="text-lg font-bold text-white tracking-tight">Bouncer</span>
          <button onClick={onClose} className="ml-auto text-gray-400 hover:text-white lg:hidden">
            <X size={20} />
          </button>
        </div>

        {/* Navigation */}
        <nav className="flex-1 overflow-y-auto px-3 py-4 space-y-1">
          {navItems.map(({ to, label, icon: Icon, end }) => (
            <NavLink
              key={to}
              to={to}
              end={end}
              onClick={onClose}
              className={({ isActive }) =>
                cn(
                  'flex items-center gap-3 rounded-lg px-3 py-2.5 text-sm font-medium transition-colors',
                  isActive
                    ? 'bg-blue-600 text-white'
                    : 'text-gray-300 hover:bg-gray-800 hover:text-white'
                )
              }
            >
              <Icon size={18} />
              {label}
            </NavLink>
          ))}
        </nav>

        {/* Footer */}
        <div className="border-t border-gray-700 px-3 py-3">
          <p className="px-3 text-xs text-gray-500">RBAC Management</p>
        </div>
      </aside>
    </>
  )
}
