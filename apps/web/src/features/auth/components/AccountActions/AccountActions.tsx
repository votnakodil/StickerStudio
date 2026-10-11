import { useRef, useState } from 'react'
import { useAuthSession } from '../../model/authSessionContext'
import styles from './AccountActions.module.css'

export function AccountActions() {
  const { logout, logoutAll } = useAuthSession()
  const [busy, setBusy] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const pending = useRef(false)
  const signOut = async (everywhere: boolean) => {
    if (pending.current) return
    pending.current = true
    setBusy(true)
    setError(null)
    try { await (everywhere ? logoutAll() : logout()) }
    catch { setError('Could not sign out. Check your connection and try again.') }
    finally { pending.current = false; setBusy(false) }
  }
  return <details className={styles.menu}>
    <summary>Account</summary>
    <div className={styles.actions}>
      <button type="button" disabled={busy} onClick={() => void signOut(false)}>Sign out</button>
      <button type="button" disabled={busy} onClick={() => void signOut(true)}>Sign out on all devices</button>
      {error && <p role="alert">{error}</p>}
    </div>
  </details>
}
