import { SignUp } from '@clerk/clerk-react'
import { Link } from 'react-router-dom'

import AuthCard from '../components/AuthCard.jsx'
import PageShell from '../components/PageShell.jsx'
import { clerkAppearance } from '../lib/clerkAppearance.js'

function BenefitsAside() {
  return (
    <div className="space-y-6 rounded-[2rem] border border-white/10 bg-white/5 p-8 shadow-2xl shadow-black/30 backdrop-blur-2xl">
      <div className="inline-flex rounded-full border border-fuchsia-400/20 bg-fuchsia-400/10 px-3 py-1 text-xs font-medium uppercase tracking-[0.28em] text-fuchsia-200">
        Fast onboarding
      </div>
      <h2 className="text-3xl font-semibold text-white">Create an account in minutes.</h2>
      <div className="space-y-4">
        {[
          {
            title: 'Verified email',
            text: 'Clerk prompts for email verification automatically when your instance requires it.',
          },
          {
            title: 'Secure recovery',
            text: 'Users can reset passwords directly from the sign-in journey without extra custom code.',
          },
          {
            title: 'Managed sessions',
            text: 'Every device session is managed by Clerk and visible later in the profile screen.',
          },
        ].map((item) => (
          <div key={item.title} className="rounded-2xl border border-white/10 bg-slate-950/60 p-5">
            <h3 className="text-base font-semibold text-white">{item.title}</h3>
            <p className="mt-2 text-sm leading-7 text-slate-300">{item.text}</p>
          </div>
        ))}
      </div>
    </div>
  )
}

export default function SignUpPage() {
  return (
    <PageShell rightAside={<BenefitsAside />}>
      <AuthCard
        badge="Get started"
        title="Create your secure account"
        description="Use Clerk sign-up to register, verify your email, and land directly in a protected dashboard."
        footer={
          <p className="text-sm text-slate-400">
            Already have an account?{' '}
            <Link className="font-medium text-sky-300 hover:text-sky-200" to="/sign-in">
              Sign in
            </Link>
          </p>
        }
      >
        <SignUp
          appearance={clerkAppearance}
          path="/sign-up"
          routing="path"
          signInUrl="/sign-in"
          fallbackRedirectUrl="/dashboard"
        />
      </AuthCard>
    </PageShell>
  )
}
