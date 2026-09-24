import { Navigate, useParams } from 'react-router-dom'

/**
 * Compatibility shim for invitation links minted before the token moved into the URL fragment.
 *
 * Those links are already delivered and live for 24 hours, so dropping them would send recipients to
 * a generic admin login page with no explanation. This re-enters the normal flow by moving the token
 * from the path to the fragment; `replace` keeps the path form out of the back button.
 *
 * Delete once no pre-upgrade invitation can still be valid.
 */
export function LegacyInviteRedirect() {
  const { token } = useParams<{ token: string }>()
  return <Navigate to={`/invite#${token ?? ''}`} replace />
}
