import {
  lazy,
  Suspense,
} from 'react'
import {
  BrowserRouter,
  Navigate,
  Route,
  Routes,
} from 'react-router-dom'

const LoginPage = lazy(() =>
  import('./pages/LoginPage').then(
    (module) => ({
      default: module.LoginPage,
    }),
  ),
)

const LibraryPage = lazy(() =>
  import('./pages/LibraryPage').then(
    (module) => ({
      default: module.LibraryPage,
    }),
  ),
)

const EditorLab = lazy(() =>
  import('./pages/EditorLab').then(
    (module) => ({
      default: module.EditorLab,
    }),
  ),
)

export default function App() {
  return (
    <BrowserRouter>
      <Suspense fallback={null}>
        <Routes>
          <Route
            path="/"
            element={
              <Navigate
                to="/login"
                replace
              />
            }
          />

          <Route
            path="/login"
            element={<LoginPage />}
          />

          <Route
            path="/library"
            element={<LibraryPage />}
          />

          <Route
            path="/editor/:stickerId"
            element={<EditorLab />}
          />

          <Route
            path="*"
            element={
              <Navigate
                to="/login"
                replace
              />
            }
          />
        </Routes>
      </Suspense>
    </BrowserRouter>
  )
}