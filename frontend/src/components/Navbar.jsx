import { SignedIn, SignedOut, UserButton } from '@clerk/clerk-react'
import { Link, NavLink } from 'react-router-dom'

import BrandMark from './BrandMark.jsx'

const navLinkClass = ({ isActive }) =>
  [
    'rounded-full px-4 py-2 text-sm font-medium transition',
    isActive
      ? 'bg-white/10 text-white shadow-sm shadow-black/20'
      : 'text-slate-300 hover:bg-white/5 hover:text-white',
  ].join(' ')

export default function Navbar() {
  return (
    <header className="sticky top-0 z-40 border-b border-white/10 bg-slate-950/50 backdrop-blur-xl">
      <div className="mx-auto flex max-w-7xl items-center justify-between px-4 py-4 sm:px-6 lg:px-8">
        <BrandMark />

        <div className="flex items-center gap-2">
          <SignedIn>
            <nav className="hidden items-center gap-1 rounded-full border border-white/10 bg-white/5 p-1 sm:flex">
              <NavLink className={navLinkClass} to="/dashboard">
                Dashboard
              </NavLink>
              <NavLink className={navLinkClass} to="/profile">
                Profile
              </NavLink>
            </nav>
          </SignedIn>

          <SignedOut>
            <div className="flex items-center gap-2">
              <Link
                className="rounded-full border border-white/10 px-4 py-2 text-sm font-medium text-slate-200 transition hover:border-white/20 hover:bg-white/5"
                to="/sign-in"
              >
                Sign In
              </Link>
              <Link
                className="rounded-full bg-sky-400 px-4 py-2 text-sm font-semibold text-slate-950 transition hover:bg-sky-300"
                to="/sign-up"
              >
                Create account
              </Link>
            </div>
          </SignedOut>

          <SignedIn>
            <UserButton
              appearance={{
                elements: {
                  avatarBox:
                    'h-11 w-11 ring-2 ring-sky-400/20 transition hover:ring-sky-300/40',
                  userButtonPopoverCard:
                    'border border-white/10 bg-slate-950/95 text-slate-100 shadow-2xl shadow-black/50',
                  userPreviewTextContainer: 'text-slate-100',
                  userButtonPopoverActionButton:
                    'text-slate-200 hover:bg-white/5 hover:text-white',
                },
              }}
              afterSignOutUrl="/sign-in"
              userProfileMode="navigation"
              userProfileUrl="/profile"
            />
          </SignedIn>
        </div>
      </div>
    </header>
  )
}
