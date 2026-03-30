export default function AuthCard({ badge, title, description, children, footer }) {
  return (
    <div className="relative overflow-hidden rounded-[2rem] border border-white/10 bg-slate-950/65 p-6 shadow-2xl shadow-black/40 backdrop-blur-2xl sm:p-10">
      <div className="pointer-events-none absolute inset-0 bg-[radial-gradient(circle_at_top,rgba(56,189,248,0.2),transparent_35%),radial-gradient(circle_at_bottom_right,rgba(99,102,241,0.18),transparent_28%)]" />
      <div className="relative space-y-8">
        <div className="space-y-4">
          {badge ? (
            <div className="inline-flex rounded-full border border-sky-400/20 bg-sky-400/10 px-3 py-1 text-xs font-medium uppercase tracking-[0.3em] text-sky-200">
              {badge}
            </div>
          ) : null}
          <div className="space-y-3">
            <h1 className="text-3xl font-semibold tracking-tight text-white sm:text-4xl">
              {title}
            </h1>
            <p className="max-w-xl text-sm leading-7 text-slate-300 sm:text-base">
              {description}
            </p>
          </div>
        </div>
        {children}
        {footer ? <div className="border-t border-white/10 pt-5">{footer}</div> : null}
      </div>
    </div>
  )
}
