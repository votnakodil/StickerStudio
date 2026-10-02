import type { ReactNode } from 'react'
import { HeroArtworkTransitionProvider } from '@/shared/ui/HeroArtworkTransition/HeroArtworkTransition'

export function AppProviders({ children }: { children: ReactNode }) {
  return <HeroArtworkTransitionProvider>{children}</HeroArtworkTransitionProvider>
}
