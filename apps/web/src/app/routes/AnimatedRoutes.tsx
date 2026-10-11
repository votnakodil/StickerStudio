import { lazy, Suspense, useEffect, useState } from 'react'
import { useHeroArtworkTransition } from '@/shared/ui/HeroArtworkTransition/useHeroArtworkTransition'
import { LayoutGroup } from 'motion/react'
import { Navigate, Route, Routes, useLocation, type Location } from 'react-router-dom'
import { useAuthSession } from '@/features/auth'
import { EditorPage } from '@/pages/EditorPage/EditorPage'
import { LibraryPage } from '@/pages/LibraryPage/LibraryPage'
import { SessionCheck } from './SessionCheck'

const LoginPage = lazy(() =>
  import('@/pages/LoginPage/LoginPage').then(
    (module) => ({
      default: module.LoginPage,
    }),
  ),
)

function RouteLayer({ location, leaving }: { location: Location; leaving: boolean }) {
  const { status, refreshSession } = useAuthSession()
  if (status === 'loading') return <SessionCheck loading />
  if (status === 'error') return <SessionCheck loading={false} retry={() => void refreshSession().catch(() => {})} />
  const protectedPage = status === 'authenticated' ? null : <Navigate to="/login" replace />
  return (
    <Routes location={location}>
      <Route path="/" element={<Navigate to={status === 'authenticated' ? '/library' : '/login'} replace />} />
      <Route path="/login" element={<LoginPage />} />
      <Route path="/library" element={protectedPage ?? <LibraryPage leaving={leaving} />} />
      <Route path="/editor/:stickerId" element={protectedPage ?? <EditorPage leavingRoute={leaving} />} />
      <Route path="/editor" element={protectedPage ?? <EditorPage leavingRoute={leaving} />} />
      <Route path="*" element={<Navigate to="/login" replace />} />
    </Routes>
  )
}

export function AnimatedRoutes() {
  const location = useLocation()
  const { flight } = useHeroArtworkTransition()
  const [pages, setPages] = useState<{ current: Location; previous: Location | null }>(() => ({ current: location, previous: null }))

  if (pages.current.pathname !== location.pathname) {
    setPages({ current: location, previous: pages.current })
  }

  const currentPath = pages.current.pathname
  const hasPrevious = Boolean(pages.previous)
  const openingCard = flight?.direction === 'open' && !flight.settled
  useEffect(() => {
    if (!hasPrevious || openingCard) return
    const timeout = window.setTimeout(() => {
      setPages((current) => current.current.pathname === currentPath ? { ...current, previous: null } : current)
    }, 850)
    return () => window.clearTimeout(timeout)
  }, [currentPath, hasPrevious, openingCard])

  return (
    <LayoutGroup id="sticker-pages">
      <Suspense fallback={null}>
        {pages.previous && <RouteLayer key={pages.previous.key} location={pages.previous} leaving />}
        <RouteLayer key={pages.current.key} location={pages.current} leaving={false} />
      </Suspense>
    </LayoutGroup>
  )
}

