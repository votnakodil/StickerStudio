import type { ReactNode } from 'react'
import { AuthSessionProvider } from '@/features/auth'
import { GlowExpansionProvider } from '@/shared/ui/GlowExpansion/GlowExpansion'
import { HeroArtworkTransitionProvider } from '@/shared/ui/HeroArtworkTransition/HeroArtworkTransition'

export function AppProviders({ children }: { children: ReactNode }) {
  return <AuthSessionProvider><GlowExpansionProvider><HeroArtworkTransitionProvider>{children}</HeroArtworkTransitionProvider></GlowExpansionProvider></AuthSessionProvider>
}
