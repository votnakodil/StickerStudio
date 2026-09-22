import { EditorCanvas } from '../components/editor/EditorCanvas'
import { CanvasToolbar } from '../components/editor/CanvasToolbar/CanvasToolbar'

export function EditorLab() {
  return (
    <main className="relative min-h-screen bg-neutral-950 text-white flex items-center justify-center p-6">
      <div className="w-[min(82vw,82vh)] aspect-square bg-neutral-900 rounded-3xl overflow-hidden shadow-2xl">
        <EditorCanvas />
      </div>

      <div className="absolute bottom-8 left-1/2 -translate-x-1/2">
        <CanvasToolbar corner={14} />
      </div>
    </main>
  )
}