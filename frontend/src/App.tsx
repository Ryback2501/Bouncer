import { BrowserRouter, Routes, Route, Navigate } from 'react-router-dom'
import { AuthProvider } from './context/AuthContext'
import { useAuth } from './context/useAuth'
import { ToastProvider } from './components/shared/Toast'
import { AppShell } from './components/layout/AppShell'
import { Login } from './pages/Login'
import { Dashboard } from './pages/Dashboard'
import { ApplicationList } from './pages/Applications/ApplicationList'
import { RoleList } from './pages/Roles/RoleList'
import { UserList } from './pages/Users/UserList'
import { UserDetail } from './pages/Users/UserDetail'
import { ApiKeyList } from './pages/ApiKeys/ApiKeyList'
import { AssignmentList } from './pages/Assignments/AssignmentList'
import { InvitationList } from './pages/Invitations/InvitationList'
import { InviteAccept } from './pages/InviteAccept'
import { LegacyInviteRedirect } from './pages/LegacyInviteRedirect'
import { Invited } from './pages/Invited'

function ProtectedRoutes() {
  const { admin, isLoading } = useAuth()

  if (isLoading) {
    return (
      <div className="flex h-screen items-center justify-center">
        <div className="h-8 w-8 animate-spin rounded-full border-4 border-blue-600 border-t-transparent" />
      </div>
    )
  }

  if (!admin) return <Navigate to="/login" replace />

  return (
    <Routes>
      <Route element={<AppShell />}>
        <Route index element={<Dashboard />} />
        <Route path="applications" element={<ApplicationList />} />
        <Route path="applications/:appId/roles" element={<RoleList />} />
        <Route path="applications/:appId/api-keys" element={<ApiKeyList />} />
        <Route path="users" element={<UserList />} />
        <Route path="users/:userId" element={<UserDetail />} />
        <Route path="assignments" element={<AssignmentList />} />
        <Route path="invitations" element={<InvitationList />} />
      </Route>
    </Routes>
  )
}

export default function App() {
  return (
    <BrowserRouter>
      <ToastProvider>
        <AuthProvider>
          <Routes>
            <Route path="/login" element={<Login />} />
            <Route path="/invite" element={<InviteAccept />} />
            {/* Invitations minted before the token moved into the fragment. Those links are already
                out in the wild with a 24h life, so redirect them rather than dropping the recipient
                on a generic login page. The server masks the token in its logs (lib/redactUrl).
                Safe to delete once no pre-upgrade invitation can still be live. */}
            <Route path="/invite/:token" element={<LegacyInviteRedirect />} />
            <Route path="/invited" element={<Invited />} />
            <Route path="/*" element={<ProtectedRoutes />} />
          </Routes>
        </AuthProvider>
      </ToastProvider>
    </BrowserRouter>
  )
}
