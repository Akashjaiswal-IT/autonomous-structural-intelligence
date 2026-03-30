import { SignIn } from '@clerk/clerk-react'
import { Link } from 'react-router-dom'

import AuthCard from '../components/AuthCard.jsx'
import PageShell from '../components/PageShell.jsx'
import { clerkAppearance } from '../lib/clerkAppearance.js'

function MarketingAside() {
  return (
    <div className="space-y-6 rounded-[2rem] border border-white/10 bg-white/5 p-8 shadow-2xl shadow-black/30 backdrop-blur-2xl">
      <div className="inline-flex rounded-full border border-emerald-400/20 bg-emerald-400/10 px-3 py-1 text-xs font-medium uppercase tracking-[0.28em] text-emerald-200">
        Production ready
      </div>
      <div className="space-y-3">
        <h2 className="text-3xl font-semibold text-white">Secure access with a polished dark UI.</h2>
        <p className="text-sm leading-7 text-slate-300">
          Clerk handles sign in, sign up, email verification, password reset, sessions,
          and profile security flows. This app wraps those flows in a responsive glass
          dashboard that is ready for local development and deployment.
        </p>
      </div>
      <div className="grid gap-4">
        {[
          'Email verification and password reset are built into the Clerk screens.',
          'Protected routes redirect guests automatically before app data loads.',
          'User profile and session controls are available from the profile workspace.',
        ].map((item) => (
          <div
            key={item}
            className="rounded-2xl border border-white/10 bg-slate-950/60 p-4 text-sm text-slate-300"
          >
            {item}
          </div>
        ))}
      </div>
    </div>
  )
}

export default function SignInPage() {
  return (
    <PageShell rightAside={<MarketingAside />}>
      <AuthCard
        badge="Welcome back"
        title="Sign in to your workspace"
        description="Continue with Clerk-powered authentication. Password reset and second-step verification flows are automatically supported on this screen."
        footer={
          <p className="text-sm text-slate-400">
            New here?{' '}
            <Link className="font-medium text-sky-300 hover:text-sky-200" to="/sign-up">
              Create an account
            </Link>
          </p>
        }
      >
        <SignIn
          appearance={clerkAppearance}
          path="/sign-in"
          routing="path"
          signUpUrl="/sign-up"
          fallbackRedirectUrl="/dashboard"
        />
      </AuthCard>
    </PageShell>
  )
}
