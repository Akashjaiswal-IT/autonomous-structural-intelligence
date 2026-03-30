import { Link } from 'react-router-dom'

export default function BrandMark() {
  return (
    <Link className="inline-flex items-center gap-3" to="/">
      <div className="flex h-11 w-11 items-center justify-center rounded-2xl border border-sky-400/30 bg-sky-400/10 text-lg font-semibold text-sky-200 shadow-lg shadow-sky-950/50">
        C
      </div>
      <div>
        <div className="text-sm font-semibold uppercase tracking-[0.35em] text-sky-200">
          Clerk Auth
        </div>
        <div className="text-xs text-slate-400">Secure React workspace</div>
      </div>
    </Link>
  )
}
