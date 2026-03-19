import { type ReactNode } from 'react'
import { useQuery } from '@tanstack/react-query'
import client from '../api/client'
import { AuthContext, type Admin } from './authContext'

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
