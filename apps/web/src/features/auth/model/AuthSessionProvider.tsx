import { useCallback, useEffect, useRef, useState, type ReactNode } from 'react'
import { authService } from '../api'
import { AUTH_REQUIRED_EVENT } from './authSessionEvents'
import { AuthSessionContext, type SessionStatus } from './authSessionContext'

export function AuthSessionProvider({ children }: { children: ReactNode }) {
  const [status, setStatus] = useState<SessionStatus>('loading')
  const generation = useRef(0)
  const refreshSession = useCallback(async () => {
    const attempt = ++generation.current
    try {
      const authenticated = await authService.getSession()
      if (generation.current === attempt) setStatus(authenticated ? 'authenticated' : 'anonymous')
      return authenticated
    } catch {
      if (generation.current === attempt) setStatus('error')
      throw new Error('Could not check your session. Check your connection and reload.')
    }
  }, [])
  useEffect(() => {
    void refreshSession().catch(() => {})
    const activeGeneration = generation
    const expired = () => { ++generation.current; setStatus('anonymous') }
    window.addEventListener(AUTH_REQUIRED_EVENT, expired)
    return () => { ++activeGeneration.current; window.removeEventListener(AUTH_REQUIRED_EVENT, expired) }
  }, [refreshSession])
  const logout = useCallback(async () => {
    await authService.logout()
    ++generation.current
    setStatus('anonymous')
  }, [])
  const logoutAll = useCallback(async () => {
    await authService.logoutAll()
    ++generation.current
    setStatus('anonymous')
  }, [])
  return <AuthSessionContext.Provider value={{ status, refreshSession, logout, logoutAll }}>{children}</AuthSessionContext.Provider>
}

