import type { ReactNode } from 'react'
import { GlowExpansionProvider } from '@/shared/ui/GlowExpansion/GlowExpansion'
import { HeroArtworkTransitionProvider } from '@/shared/ui/HeroArtworkTransition/HeroArtworkTransition'

export function AppProviders({ children }: { children: ReactNode }) {
  return <GlowExpansionProvider><HeroArtworkTransitionProvider>{children}</HeroArtworkTransitionProvider></GlowExpansionProvider>
}
