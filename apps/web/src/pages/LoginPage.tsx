import { useNavigate } from 'react-router-dom'

export function LoginPage() {
  const navigate = useNavigate()

  return (
    <main className="min-h-screen bg-neutral-950 text-white flex items-center justify-center">
      <div className="text-center">
        <h1 className="text-4xl font-semibold">
          Sticker Studio
        </h1>

        <p className="mt-3 text-neutral-400">
          Login
        </p>

        <button
          type="button"
          className="mt-8 rounded-xl bg-white px-5 py-3 font-medium text-black"
          onClick={() =>
            navigate('/library')
          }
        >
          Continue
        </button>
      </div>
    </main>
  )
}