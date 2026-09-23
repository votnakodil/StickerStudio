import { useNavigate } from 'react-router-dom'

export function LibraryPage() {
  const navigate = useNavigate()

  return (
    <main className="min-h-screen bg-neutral-950 text-white p-8">
      <div className="mx-auto max-w-6xl">
        <h1 className="text-3xl font-semibold">
          Sticker Library
        </h1>

        <p className="mt-2 text-neutral-400">
          Choose a sticker or create your own.
        </p>

        <div className="mt-8 flex gap-4">
          <button
            type="button"
            className="rounded-xl bg-white px-5 py-3 font-medium text-black"
            onClick={() =>
              navigate(
                '/editor/demo',
              )
            }
          >
            Open demo sticker
          </button>

          <button
            type="button"
            className="rounded-xl bg-neutral-800 px-5 py-3 font-medium text-white"
          >
            Create custom sticker
          </button>
        </div>
      </div>
    </main>
  )
}