import { useAuth, useSession, useUser } from '@clerk/clerk-react'
import { useEffect, useState } from 'react'
import { Link } from 'react-router-dom'

import StatCard from '../components/StatCard.jsx'
import { getProtectedMessage } from '../lib/api.js'

const quickActions = [
  {
    title: 'Manage your profile',
    description: 'Update personal information, email addresses, and account security settings.',
    href: '/profile',
  },
  {
    title: 'Review active session',
    description: 'The current Clerk session is loaded below so you can confirm route protection is working.',
    href: '/profile',
  },
]

export default function DashboardPage() {
  const { getToken, isLoaded, sessionId } = useAuth()
  const { session } = useSession()
  const { user } = useUser()
  const [apiState, setApiState] = useState({
    loading: true,
    data: null,
    error: null,
  })

  useEffect(() => {
    let isMounted = true

    async function loadProtectedData() {
      try {
        const data = await getProtectedMessage(getToken)
        if (isMounted) {
          setApiState({ loading: false, data, error: null })
        }
      } catch (error) {
        if (isMounted) {
          const message =
            error.response?.data?.error ||
            error.message ||
            'Unable to reach the protected API example.'
          setApiState({ loading: false, data: null, error: message })
        }
      }
    }

    loadProtectedData()

    return () => {
      isMounted = false
    }
  }, [getToken])

  const fullName = [user?.firstName, user?.lastName].filter(Boolean).join(' ') || 'Authenticated user'

  return (
    <main className="mx-auto max-w-7xl px-4 py-10 sm:px-6 lg:px-8">
      <section className="overflow-hidden rounded-[2rem] border border-white/10 bg-slate-950/60 p-8 shadow-2xl shadow-black/35 backdrop-blur-2xl sm:p-10">
        <div className="flex flex-col gap-6 lg:flex-row lg:items-end lg:justify-between">
          <div className="max-w-2xl space-y-4">
            <div className="inline-flex rounded-full border border-sky-400/20 bg-sky-400/10 px-3 py-1 text-xs font-medium uppercase tracking-[0.3em] text-sky-200">
              Protected dashboard
            </div>
            <div>
              <h1 className="text-4xl font-semibold tracking-tight text-white sm:text-5xl">
                Welcome, {fullName}.
              </h1>
              <p className="mt-4 text-base leading-8 text-slate-300">
                Your route is protected with Clerk. Signed-out visitors are redirected,
                and authenticated users can access profile management, session details,
                and protected API responses from this dashboard.
              </p>
            </div>
          </div>
          <div className="rounded-3xl border border-emerald-400/20 bg-emerald-400/10 px-5 py-4 text-sm text-emerald-100 shadow-lg shadow-emerald-950/20">
            Session status: {isLoaded ? 'active' : 'loading'}
          </div>
        </div>
      </section>

      <section className="mt-8 grid gap-4 md:grid-cols-3">
        <StatCard
          label="User ID"
          value={user?.id || '...'}
          hint="Direct from Clerk useUser() for current identity."
        />
        <StatCard
          label="Session ID"
          value={sessionId || '...'}
          hint="Managed by Clerk for secure session handling."
        />
        <StatCard
          label="Primary Email"
          value={user?.primaryEmailAddress?.emailAddress || '...'}
          hint="Verification status is enforced by your Clerk instance."
        />
      </section>

      <section className="mt-8 grid gap-8 lg:grid-cols-[1.1fr_0.9fr]">
        <div className="rounded-[2rem] border border-white/10 bg-white/5 p-7 shadow-xl shadow-black/25 backdrop-blur-xl">
          <div className="flex items-center justify-between gap-4">
            <div>
              <h2 className="text-2xl font-semibold text-white">Protected API example</h2>
              <p className="mt-2 text-sm leading-7 text-slate-400">
                This card calls the optional Express server route at
                {' '}
                <code>/api/protected</code>
                {' '}
                using a Clerk token from the current session.
              </p>
            </div>
            <div className="rounded-full border border-white/10 bg-slate-950/70 px-3 py-1 text-xs uppercase tracking-[0.3em] text-slate-300">
              {apiState.loading ? 'Loading' : apiState.error ? 'Unavailable' : 'Live'}
            </div>
          </div>

          <div className="mt-6 rounded-3xl border border-white/10 bg-slate-950/80 p-5">
            {apiState.loading ? (
              <p className="text-sm text-slate-400">Fetching the protected response...</p>
            ) : null}

            {apiState.error ? (
              <div className="space-y-3">
                <p className="text-sm font-medium text-amber-200">
                  The frontend is working, but the optional Express example is not responding yet.
                </p>
                <p className="text-sm leading-7 text-slate-400">{apiState.error}</p>
              </div>
            ) : null}

            {apiState.data ? (
              <dl className="grid gap-4 text-sm text-slate-300 sm:grid-cols-2">
                <div>
                  <dt className="text-xs uppercase tracking-[0.25em] text-slate-500">Message</dt>
                  <dd className="mt-2 text-base text-white">{apiState.data.message}</dd>
                </div>
                <div>
                  <dt className="text-xs uppercase tracking-[0.25em] text-slate-500">Backend User ID</dt>
                  <dd className="mt-2 font-medium text-sky-200">{apiState.data.userId}</dd>
                </div>
                <div>
                  <dt className="text-xs uppercase tracking-[0.25em] text-slate-500">Session Claim</dt>
                  <dd className="mt-2 font-medium text-slate-200">{apiState.data.sessionId}</dd>
                </div>
                <div>
                  <dt className="text-xs uppercase tracking-[0.25em] text-slate-500">Verified at</dt>
                  <dd className="mt-2 text-slate-200">{apiState.data.issuedAt}</dd>
                </div>
              </dl>
            ) : null}
          </div>
        </div>

        <div className="space-y-6">
          <div className="rounded-[2rem] border border-white/10 bg-white/5 p-7 shadow-xl shadow-black/25 backdrop-blur-xl">
            <h2 className="text-2xl font-semibold text-white">Session overview</h2>
            <p className="mt-2 text-sm leading-7 text-slate-400">
              Clerk manages the current browser session, device context, password recovery,
              and email verification behind the scenes.
            </p>
            <div className="mt-6 space-y-4">
              <div className="rounded-2xl border border-white/10 bg-slate-950/70 p-4">
                <div className="text-xs uppercase tracking-[0.25em] text-slate-500">Session Status</div>
                <div className="mt-2 text-base font-medium text-white">{session?.status || 'pending'}</div>
              </div>
              <div className="rounded-2xl border border-white/10 bg-slate-950/70 p-4">
                <div className="text-xs uppercase tracking-[0.25em] text-slate-500">Last Active</div>
                <div className="mt-2 text-base font-medium text-white">
                  {session?.lastActiveAt ? new Date(session.lastActiveAt).toLocaleString() : 'Not available'}
                </div>
              </div>
            </div>
          </div>

          <div className="rounded-[2rem] border border-white/10 bg-white/5 p-7 shadow-xl shadow-black/25 backdrop-blur-xl">
            <h2 className="text-2xl font-semibold text-white">Quick actions</h2>
            <div className="mt-6 space-y-4">
              {quickActions.map((action) => (
                <Link
                  key={action.title}
                  className="block rounded-2xl border border-white/10 bg-slate-950/70 p-4 transition hover:border-sky-400/30 hover:bg-slate-950"
                  to={action.href}
                >
                  <div className="text-base font-medium text-white">{action.title}</div>
                  <p className="mt-2 text-sm leading-7 text-slate-400">{action.description}</p>
                </Link>
              ))}
            </div>
          </div>
        </div>
      </section>
    </main>
  )
}
