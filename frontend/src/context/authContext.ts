import { createContext } from 'react'

export interface Admin {
  id: string
  name: string
  email: string | null
  provider: string
  isGlobalAdmin: boolean
}

export interface AuthContextValue {
  admin: Admin | null
  isLoading: boolean
  isGlobalAdmin: boolean
}

export const AuthContext = createContext<AuthContextValue>({ admin: null, isLoading: true, isGlobalAdmin: false })
