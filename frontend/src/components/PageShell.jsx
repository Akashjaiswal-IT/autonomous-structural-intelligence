export default function PageShell({ children, rightAside }) {
  return (
    <div className="relative isolate min-h-[calc(100vh-81px)] overflow-hidden">
      <div className="absolute inset-0 -z-10 bg-[radial-gradient(circle_at_top_left,rgba(56,189,248,0.12),transparent_30%),radial-gradient(circle_at_80%_20%,rgba(15,118,110,0.15),transparent_25%),radial-gradient(circle_at_bottom,rgba(99,102,241,0.12),transparent_35%)]" />
      <div className="mx-auto grid min-h-[calc(100vh-81px)] max-w-7xl gap-10 px-4 py-10 sm:px-6 lg:grid-cols-[1.2fr_0.8fr] lg:px-8 lg:py-14">
        <div className="flex items-center">{children}</div>
        <aside className="hidden lg:flex lg:items-center">{rightAside}</aside>
      </div>
    </div>
  )
}
