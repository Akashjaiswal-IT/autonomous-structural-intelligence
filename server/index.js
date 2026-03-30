import cors from 'cors'
import dotenv from 'dotenv'
import express from 'express'
import { clerkMiddleware, getAuth, requireAuth } from '@clerk/express'

dotenv.config()

const app = express()
const port = Number(process.env.PORT || 8787)
const frontendUrl = process.env.FRONTEND_URL || 'http://localhost:5173'

app.use(
  cors({
    origin: frontendUrl,
    credentials: true,
  }),
)
app.use(express.json())
app.use(clerkMiddleware())

app.get('/api/health', (_req, res) => {
  res.json({ ok: true })
})

app.get('/api/protected', requireAuth(), (req, res) => {
  const { userId, sessionId } = getAuth(req)

  res.json({
    message: 'Protected data retrieved successfully.',
    userId,
    sessionId,
    issuedAt: new Date().toISOString(),
  })
})

app.use((err, _req, res, _next) => {
  console.error(err)

  if (res.headersSent) {
    return
  }

  res.status(err.status || 500).json({
    error: err.errors?.[0]?.longMessage || err.message || 'Unexpected server error',
  })
})

app.listen(port, () => {
  console.log(`Clerk example API listening on http://localhost:${port}`)
})
