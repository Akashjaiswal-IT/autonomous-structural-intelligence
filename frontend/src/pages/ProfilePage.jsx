import { UserProfile, useUser } from '@clerk/clerk-react'

import { clerkAppearance } from '../lib/clerkAppearance.js'

export default function ProfilePage() {
  const { user } = useUser()

  return (
    <main className="mx-auto max-w-7xl px-4 py-10 sm:px-6 lg:px-8">
      <section className="mb-8 rounded-[2rem] border border-white/10 bg-slate-950/60 p-8 shadow-2xl shadow-black/35 backdrop-blur-2xl">
        <div className="flex flex-col gap-5 lg:flex-row lg:items-center lg:justify-between">
          <div>
            <div className="inline-flex rounded-full border border-fuchsia-400/20 bg-fuchsia-400/10 px-3 py-1 text-xs font-medium uppercase tracking-[0.3em] text-fuchsia-200">
              Profile management
            </div>
            <h1 className="mt-4 text-4xl font-semibold tracking-tight text-white">Your account</h1>
            <p className="mt-4 max-w-3xl text-base leading-8 text-slate-300">
              Clerk’s hosted profile lets users manage account details, verified emails,
              passwords, connected identities, and active sessions from one secure screen.
            </p>
          </div>
          <div className="rounded-3xl border border-white/10 bg-white/5 px-5 py-4 text-sm text-slate-300">
            Signed in as {user?.primaryEmailAddress?.emailAddress || 'current user'}
          </div>
        </div>
      </section>

      <section className="rounded-[2rem] border border-white/10 bg-white/5 p-3 shadow-2xl shadow-black/25 backdrop-blur-2xl sm:p-6">
        <UserProfile
          appearance={clerkAppearance}
          path="/profile"
          routing="path"
        />
      </section>
    </main>
  )
}
