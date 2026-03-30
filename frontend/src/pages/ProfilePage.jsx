import { UserProfile, useUser } from '@clerk/clerk-react'
import { useEffect, useMemo, useState } from 'react'
import { Link } from 'react-router-dom'

import { clerkAppearance } from '../lib/clerkAppearance.js'

const BACKEND_BASE_URL = import.meta.env.VITE_BACKEND_URL || 'http://localhost:8000'

function formatDate(value) {
  if (!value) return 'Unknown time'
  const date = new Date(value)
  if (Number.isNaN(date.getTime())) return value
  return date.toLocaleString()
}

export default function ProfilePage() {
  const { user } = useUser()
  const [historyItems, setHistoryItems] = useState([])
  const [historyLoading, setHistoryLoading] = useState(false)
  const [historyError, setHistoryError] = useState('')

  useEffect(() => {
    let isMounted = true
    const loadHistory = async () => {
      setHistoryLoading(true)
      try {
        const response = await fetch(`${BACKEND_BASE_URL}/api/conversion-history?limit=50`)
        if (!response.ok) {
          throw new Error('Failed to load conversion history')
        }
        const payload = await response.json()
        if (isMounted) {
          setHistoryItems(payload?.items || [])
          setHistoryError('')
        }
      } catch (error) {
        if (isMounted) {
          setHistoryError(error?.message || 'Could not fetch conversion history')
        }
      } finally {
        if (isMounted) {
          setHistoryLoading(false)
        }
      }
    }

    void loadHistory()
    return () => {
      isMounted = false
    }
  }, [])

  const totals = useMemo(
    () => historyItems.reduce(
      (acc, item) => ({
        walls: acc.walls + Number(item?.stats?.walls || 0),
        doors: acc.doors + Number(item?.stats?.doors || 0),
        windows: acc.windows + Number(item?.stats?.windows || 0),
      }),
      { walls: 0, doors: 0, windows: 0 },
    ),
    [historyItems],
  )

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

      <section className="mt-8 rounded-[2rem] border border-cyan-300/20 bg-slate-950/55 p-6 shadow-2xl shadow-black/30 backdrop-blur-xl">
        <div className="flex flex-col gap-4 sm:flex-row sm:items-end sm:justify-between">
          <div>
            <div className="inline-flex rounded-full border border-cyan-300/25 bg-cyan-400/10 px-3 py-1 text-xs font-medium uppercase tracking-[0.3em] text-cyan-200">
              Conversion history
            </div>
            <h2 className="mt-3 text-2xl font-semibold text-white">2D → 3D work history</h2>
            <p className="mt-2 text-sm text-slate-300">
              Every conversion you created in dashboard drawing mode is stored in backend and listed here.
            </p>
          </div>
          <Link
            to="/dashboard"
            className="inline-flex items-center justify-center rounded-xl border border-cyan-300/25 bg-cyan-300/10 px-4 py-2 text-xs font-semibold uppercase tracking-[0.2em] text-cyan-100 transition hover:border-cyan-200/50 hover:bg-cyan-300/15"
          >
            New conversion
          </Link>
        </div>

        <div className="mt-5 grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
          <div className="rounded-2xl border border-white/10 bg-white/5 p-4">
            <div className="text-[11px] uppercase tracking-[0.22em] text-slate-400">Saved entries</div>
            <div className="mt-2 text-2xl font-semibold text-white">{historyItems.length}</div>
          </div>
          <div className="rounded-2xl border border-white/10 bg-white/5 p-4">
            <div className="text-[11px] uppercase tracking-[0.22em] text-slate-400">Walls drawn</div>
            <div className="mt-2 text-2xl font-semibold text-white">{totals.walls}</div>
          </div>
          <div className="rounded-2xl border border-white/10 bg-white/5 p-4">
            <div className="text-[11px] uppercase tracking-[0.22em] text-slate-400">Doors placed</div>
            <div className="mt-2 text-2xl font-semibold text-white">{totals.doors}</div>
          </div>
          <div className="rounded-2xl border border-white/10 bg-white/5 p-4">
            <div className="text-[11px] uppercase tracking-[0.22em] text-slate-400">Windows placed</div>
            <div className="mt-2 text-2xl font-semibold text-white">{totals.windows}</div>
          </div>
        </div>

        <div className="mt-6 rounded-2xl border border-white/10 bg-slate-950/45 p-3">
          {historyLoading ? (
            <div className="p-4 text-sm text-slate-300">Loading history...</div>
          ) : null}
          {historyError ? (
            <div className="p-4 text-sm text-rose-300">{historyError}</div>
          ) : null}
          {!historyLoading && !historyError && historyItems.length === 0 ? (
            <div className="p-4 text-sm text-slate-300">No conversions yet. Create one from dashboard.</div>
          ) : null}

          {!historyLoading && !historyError && historyItems.length > 0 ? (
            <div className="max-h-[360px] space-y-2 overflow-y-auto pr-1">
              {historyItems.map((item) => (
                <div
                  key={item.id}
                  className="rounded-xl border border-cyan-200/10 bg-cyan-500/[0.03] p-3"
                >
                  <div className="flex flex-col gap-2 sm:flex-row sm:items-center sm:justify-between">
                    <div className="flex items-center gap-2">
                      <div className="text-sm font-medium text-cyan-100">{item.title || 'Saved conversion'}</div>
                      <span className={`rounded-full px-2 py-0.5 text-[10px] uppercase tracking-[0.15em] ${
                        item.type === 'upload'
                          ? 'border border-amber-300/40 bg-amber-300/10 text-amber-200'
                          : 'border border-cyan-300/40 bg-cyan-300/10 text-cyan-200'
                      }`}>
                        {item.type || 'draw'}
                      </span>
                    </div>
                    <div className="text-xs text-slate-400">{formatDate(item.created_at)}</div>
                  </div>
                  <div className="mt-2 text-xs text-slate-300">
                    W:{item?.stats?.walls ?? 0} · D:{item?.stats?.doors ?? 0} · Win:{item?.stats?.windows ?? 0} · Rooms:{item?.stats?.rooms ?? 0}
                  </div>
                </div>
              ))}
            </div>
          ) : null}
        </div>
      </section>
    </main>
  )
}
