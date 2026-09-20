import { lazy, Suspense } from 'react'

const EditorLab = lazy(() =>
  import('./pages/EditorLab').then((module) => ({
    default: module.EditorLab,
  })),
)

export default function App() {
  return (
    <Suspense fallback={null}>
      <EditorLab />
    </Suspense>
  )
}