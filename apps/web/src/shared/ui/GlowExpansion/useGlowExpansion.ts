import { createContext, useContext } from 'react'

export type GlowDestination = { left: number; top: number; width: number; height: number }

export const GlowExpansionContext = createContext<(element: HTMLElement, startTime?: CSSNumberish | null, destination?: GlowDestination) => void>(() => {})
export function useGlowExpansion() { return useContext(GlowExpansionContext) }
