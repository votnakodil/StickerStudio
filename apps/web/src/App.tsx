import {
  lazy,
  Suspense,
  useEffect,
  useState,
} from 'react'
import { LayoutGroup } from 'motion/react'
import {
  BrowserRouter,
  Navigate,
  Route,
  Routes,
  useLocation,
  type Location,
} from 'react-router-dom'
import { EditorLab } from './pages/EditorLab'
import { LibraryPage } from './pages/LibraryPage'
import { HeroArtworkTransitionProvider } from './components/ui/HeroArtworkTransition'

const LoginPage = lazy(() =>
  import('./pages/LoginPage').then(
    (module) => ({
      default: module.LoginPage,
    }),
  ),
)

function RouteLayer({ location, leaving }: { location: Location; leaving: boolean }) {
  return (
    <Routes location={location}>
      <Route path="/" element={<Navigate to="/login" replace />} />
      <Route path="/login" element={<LoginPage />} />
      <Route path="/library" element={<LibraryPage leaving={leaving} />} />
      <Route path="/editor/:stickerId" element={<EditorLab leavingRoute={leaving} />} />
      <Route path="/editor" element={<EditorLab leavingRoute={leaving} />} />
      <Route path="*" element={<Navigate to="/login" replace />} />
    </Routes>
  )
}

function AnimatedRoutes() {
  const location = useLocation()
  const [pages, setPages] = useState<{ current: Location; previous: Location | null }>(() => ({ current: location, previous: null }))

  if (pages.current.pathname !== location.pathname) {
    setPages({ current: location, previous: pages.current })
  }

  const currentPath = pages.current.pathname
  const hasPrevious = Boolean(pages.previous)
  useEffect(() => {
    if (!hasPrevious) return
    const timeout = window.setTimeout(() => {
      setPages((current) => current.current.pathname === currentPath ? { ...current, previous: null } : current)
    }, 850)
    return () => window.clearTimeout(timeout)
  }, [currentPath, hasPrevious])

  return (
    <HeroArtworkTransitionProvider>
      <LayoutGroup id="sticker-pages">
        <Suspense fallback={null}>
          {pages.previous && <RouteLayer key={pages.previous.key} location={pages.previous} leaving />}
          <RouteLayer key={pages.current.key} location={pages.current} leaving={false} />
        </Suspense>
      </LayoutGroup>
    </HeroArtworkTransitionProvider>
  )
}

export default function App() {
  return (
    <BrowserRouter>
      <AnimatedRoutes />
    </BrowserRouter>
  )
}
