import { Link } from 'react-router-dom'

export default function NotFoundPage() {
  return (
    <main className="flex min-h-[calc(100vh-81px)] items-center justify-center px-4 py-16">
      <div className="max-w-xl rounded-[2rem] border border-white/10 bg-slate-950/70 p-10 text-center shadow-2xl shadow-black/35 backdrop-blur-2xl">
        <div className="text-sm uppercase tracking-[0.35em] text-slate-500">404</div>
        <h1 className="mt-4 text-4xl font-semibold text-white">Page not found</h1>
        <p className="mt-4 text-base leading-8 text-slate-300">
          The page you requested does not exist in this auth workspace.
        </p>
        <Link
          className="mt-8 inline-flex rounded-full bg-sky-400 px-5 py-3 text-sm font-semibold text-slate-950 transition hover:bg-sky-300"
          to="/"
        >
          Return home
        </Link>
      </div>
    </main>
  )
}
