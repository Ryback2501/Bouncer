import { createContext, useContext, type ReactNode } from 'react'
import { useQuery } from '@tanstack/react-query'
import client from '../api/client'

export interface Admin {
  id: string
  name: string
  email: string | null
  provider: string
  isGlobalAdmin: boolean
}

interface AuthContextValue {
  admin: Admin | null
  isLoading: boolean
  isGlobalAdmin: boolean
}

const AuthContext = createContext<AuthContextValue>({ admin: null, isLoading: true, isGlobalAdmin: false })

export function AuthProvider({ children }: { children: ReactNode }) {
  const { data, isLoading } = useQuery<Admin>({
    queryKey: ['me'],
    queryFn: () => client.get<Admin>('/me').then(r => r.data),
    retry: false,
  })

  return (
    <AuthContext.Provider value={{ admin: data ?? null, isLoading, isGlobalAdmin: data?.isGlobalAdmin ?? false }}>
      {children}
    </AuthContext.Provider>
  )
}

export function useAuth() {
  return useContext(AuthContext)
}
