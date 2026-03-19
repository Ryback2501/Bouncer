import { Menu, LogOut, ChevronDown } from 'lucide-react'
import { useState, useRef, useEffect } from 'react'
import { useAuth } from '../../context/AuthContext'

interface TopbarProps {
  onMenuClick: () => void
  title: string
}

const providerLabel: Record<string, string> = {
  google: 'Google',
  microsoft: 'Microsoft',
  apple: 'Apple',
}

export function Topbar({ onMenuClick, title }: TopbarProps) {
  const { admin } = useAuth()
  const [open, setOpen] = useState(false)
  const ref = useRef<HTMLDivElement>(null)

  useEffect(() => {
    const handler = (e: MouseEvent) => {
      if (ref.current && !ref.current.contains(e.target as Node)) setOpen(false)
    }
    document.addEventListener('mousedown', handler)
    return () => document.removeEventListener('mousedown', handler)
  }, [])

  return (
    <header className="flex h-16 items-center gap-4 border-b border-gray-200 bg-white px-4 md:px-6">
      <button
        onClick={onMenuClick}
        className="rounded-lg p-1.5 text-gray-500 hover:bg-gray-100 lg:hidden"
      >
        <Menu size={20} />
      </button>

      <h1 className="text-base font-semibold text-gray-900">{title}</h1>

      <div className="ml-auto flex items-center gap-2" ref={ref}>
        <button
          onClick={() => setOpen(o => !o)}
          className="flex items-center gap-2 rounded-lg px-3 py-2 text-sm text-gray-700 hover:bg-gray-100 transition-colors"
        >
          <div className="flex h-7 w-7 items-center justify-center rounded-full bg-blue-600 text-xs font-bold text-white">
            {admin?.name?.charAt(0).toUpperCase() ?? '?'}
          </div>
          <span className="hidden md:block font-medium">{admin?.name}</span>
          <ChevronDown size={14} className="text-gray-400" />
        </button>

        {open && (
          <div className="absolute right-4 top-14 z-50 w-52 rounded-xl bg-white py-1 shadow-lg ring-1 ring-gray-200">
            <div className="px-4 py-2 border-b border-gray-100">
              <p className="text-sm font-medium text-gray-900 truncate">{admin?.name}</p>
              <p className="text-xs text-gray-500 truncate">{admin?.email}</p>
              <p className="text-xs text-gray-400 mt-0.5">{providerLabel[admin?.provider ?? ''] ?? admin?.provider}</p>
            </div>
            <a
              href="/auth/logout"
              className="flex items-center gap-2 px-4 py-2 text-sm text-red-600 hover:bg-red-50 transition-colors"
            >
              <LogOut size={14} />
              Sign out
            </a>
          </div>
        )}
      </div>
    </header>
  )
}
