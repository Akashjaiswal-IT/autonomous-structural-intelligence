import { SignedIn, SignedOut } from '@clerk/clerk-react'
import { Navigate } from 'react-router-dom'

export default function HomeRedirectPage() {
  return (
    <>
      <SignedIn>
        <Navigate replace to="/dashboard" />
      </SignedIn>
      <SignedOut>
        <Navigate replace to="/sign-in" />
      </SignedOut>
    </>
  )
}
