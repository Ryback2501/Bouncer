import { useSearchParams } from 'react-router-dom'
import { CheckCircle2 } from 'lucide-react'

// Shown after a user accepts an app-scoped invitation when the app supplied no redirect URL.
// (When a redirect URL is given, Bouncer sends the user straight back to the app instead.)
export function Invited() {
  const [params] = useSearchParams()
  const app = params.get('app')

  return (
    <div className="min-h-screen bg-gradient-to-br from-gray-900 via-blue-950 to-gray-900 flex items-center justify-center p-4">
      <div className="w-full max-w-sm">
        <div className="text-center mb-8">
          <div className="inline-flex h-16 w-16 items-center justify-center rounded-2xl bg-green-600 shadow-lg mb-4">
            <CheckCircle2 size={32} className="text-white" />
          </div>
          <h1 className="text-3xl font-bold text-white">You're all set</h1>
        </div>

        <div className="rounded-2xl bg-white/10 backdrop-blur border border-white/20 shadow-2xl p-8 text-center">
          <p className="text-white font-semibold mb-2">Access granted</p>
          <p className="text-sm text-gray-300">
            Your access{app ? <> to <span className="font-semibold text-white">{app}</span></> : null} is set up.
            You can now sign in to the application.
          </p>
        </div>
      </div>
    </div>
  )
}
