export default function ClerkSetupScreen() {
  return (
    <div className="flex min-h-screen items-center justify-center px-4 py-10">
      <div className="w-full max-w-2xl rounded-[2rem] border border-amber-400/20 bg-slate-950/70 p-8 shadow-2xl shadow-black/40 backdrop-blur-2xl sm:p-10">
        <div className="inline-flex rounded-full border border-amber-400/20 bg-amber-400/10 px-3 py-1 text-xs font-medium uppercase tracking-[0.28em] text-amber-200">
          Clerk setup needed
        </div>
        <h1 className="mt-5 text-3xl font-semibold tracking-tight text-white sm:text-4xl">
          Add your Clerk publishable key
        </h1>
        <p className="mt-4 text-sm leading-7 text-slate-300 sm:text-base">
          The UI is loading, but Clerk cannot start because
          {' '}
          <code>VITE_CLERK_PUBLISHABLE_KEY</code>
          {' '}
          is missing.
        </p>
        <div className="mt-6 rounded-3xl border border-white/10 bg-slate-900/90 p-5 text-sm text-slate-200">
          <div className="font-medium text-white">Create this file:</div>
          <pre className="mt-3 overflow-x-auto text-sky-200">{`frontend/.env
VITE_CLERK_PUBLISHABLE_KEY=pk_test_your_key_here
VITE_API_URL=http://localhost:8787`}</pre>
        </div>
        <div className="mt-6 space-y-3 text-sm text-slate-400">
          <p>1. Copy the key from your Clerk dashboard.</p>
          <p>2. Save the file.</p>
          <p>3. Restart `npm run dev`.</p>
        </div>
      </div>
    </div>
  )
}
