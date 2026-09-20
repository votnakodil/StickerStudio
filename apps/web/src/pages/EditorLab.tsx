import { EditorCanvas } from '../components/editor/EditorCanvas'

export function EditorLab() {
  return (
    <main className="min-h-screen bg-neutral-950 text-white flex items-center justify-center">
      <div className="w-[720px] h-[720px] bg-neutral-900 rounded-3xl overflow-hidden shadow-2xl">
        <EditorCanvas />
      </div>
    </main>
  )
}