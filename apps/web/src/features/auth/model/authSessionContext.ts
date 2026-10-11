import { createContext, useContext } from 'react'

export type SessionStatus = 'loading' | 'authenticated' | 'anonymous' | 'error'
export interface AuthSessionContextValue {
  status: SessionStatus
  refreshSession: () => Promise<boolean>
  logout: () => Promise<void>
  logoutAll: () => Promise<void>
}

export const AuthSessionContext = createContext<AuthSessionContextValue | null>(null)

export function useAuthSession() {
  const context = useContext(AuthSessionContext)
  if (!context) throw new Error('AuthSessionProvider is missing.')
  return context
}
