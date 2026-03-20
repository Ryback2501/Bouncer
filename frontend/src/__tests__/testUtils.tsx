import { type ReactElement } from 'react'
import { render } from '@testing-library/react'
import { QueryClient, QueryClientProvider } from '@tanstack/react-query'
import { MemoryRouter, Routes, Route } from 'react-router-dom'
import { AuthContext, type Admin } from '../context/authContext'
import { ToastContext } from '../components/shared/toastContext'
import { vi } from 'vitest'

export const mockAdmin: Admin = {
  id: 'u1',
  name: 'Alice',
  email: 'alice@test.com',
  provider: 'google',
  isGlobalAdmin: true,
}

export const mockToast = { success: vi.fn(), error: vi.fn() }

export function renderWithProviders(
  ui: ReactElement,
  options?: {
    admin?: Admin | null
    route?: string
    path?: string
  }
) {
  const queryClient = new QueryClient({
    defaultOptions: { queries: { retry: false }, mutations: { retry: false } },
  })
  const admin = options?.admin !== undefined ? options.admin : mockAdmin

  function Wrapper() {
    return (
      <QueryClientProvider client={queryClient}>
        <ToastContext.Provider value={mockToast}>
          <MemoryRouter initialEntries={[options?.route ?? '/']}>
            <AuthContext.Provider value={{ admin, isLoading: false, isGlobalAdmin: admin?.isGlobalAdmin ?? false }}>
              {options?.path ? (
                <Routes>
                  <Route path={options.path} element={ui} />
                </Routes>
              ) : (
                ui
              )}
            </AuthContext.Provider>
          </MemoryRouter>
        </ToastContext.Provider>
      </QueryClientProvider>
    )
  }

  return render(<Wrapper />)
}
