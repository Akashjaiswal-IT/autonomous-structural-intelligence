import { Navigate, Route, Routes } from 'react-router-dom'

import AppLayout from './layouts/AppLayout.jsx'
import ProtectedRoute from './components/ProtectedRoute.jsx'
import HomeRedirectPage from './pages/HomeRedirectPage.jsx'
import NotFoundPage from './pages/NotFoundPage.jsx'
import ProfilePage from './pages/ProfilePage.jsx'
import SignInPage from './pages/SignInPage.jsx'
import SignUpPage from './pages/SignUpPage.jsx'
import StructuralWorkspacePage from './pages/StructuralWorkspacePage.jsx'

function App() {
  return (
    <Routes>
      <Route index element={<HomeRedirectPage />} />
      <Route
        path="/dashboard"
        element={
          <ProtectedRoute>
            <StructuralWorkspacePage />
          </ProtectedRoute>
        }
      />
      <Route element={<AppLayout />}>
        <Route path="/sign-in/*" element={<SignInPage />} />
        <Route path="/sign-up/*" element={<SignUpPage />} />
        <Route
          path="/profile/*"
          element={
            <ProtectedRoute>
              <ProfilePage />
            </ProtectedRoute>
          }
        />
        <Route path="/home" element={<Navigate to="/" replace />} />
        <Route path="*" element={<NotFoundPage />} />
      </Route>
    </Routes>
  )
}

export default App
