import { CircleAlert } from 'lucide-react'
import { EmptyView } from '@/shared/ui/EmptyView/EmptyView'
import { Button } from '@/shared/ui/Button/Button'
import styles from './SessionCheck.module.css'

export function SessionCheck({ retry, loading }: { retry?: () => void; loading: boolean }) {
  if (loading) return <main className={styles.page} aria-busy="true"><p>Checking your session…</p></main>
  return <main className={styles.page} role="alert">
    <EmptyView icon={<CircleAlert size={32} />} title="Could not check your session"
      subtitle="Check your connection and try again."
      action={<Button onClick={retry}>Retry</Button>} />
  </main>
}
