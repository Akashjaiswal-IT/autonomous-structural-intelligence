import axios from 'axios'

const isBrowser = typeof window !== 'undefined'
const browserOrigin = isBrowser ? window.location.origin : null
const localOrigins = new Set([
  'http://localhost:5173',
  'http://127.0.0.1:5173',
  'http://localhost:5174',
  'http://127.0.0.1:5174',
])
const sameOriginBaseUrl = browserOrigin && !localOrigins.has(browserOrigin) ? browserOrigin : null

export const authApiBaseUrl =
  import.meta.env.VITE_API_URL
  || import.meta.env.VITE_BACKEND_URL
  || sameOriginBaseUrl
  || 'http://localhost:8787'

const pipelineBaseUrlOverride = import.meta.env.VITE_PIPELINE_API_URL
const pipelineCandidates = Array.from(
  new Set(
    [
      pipelineBaseUrlOverride,
      import.meta.env.VITE_BACKEND_URL,
      import.meta.env.VITE_API_URL,
      sameOriginBaseUrl,
      'http://localhost:8000',
      'http://localhost:8787',
    ].filter(Boolean),
  ),
)

let resolvedPipelineBaseUrl = null
let pipelineResolutionPromise = null

async function probePipelineBaseUrl(baseUrl) {
  try {
    const response = await fetch(`${baseUrl}/api/health`)
    if (!response.ok) return false
    const payload = await response.json().catch(() => null)
    return payload?.pipeline === 'ready'
  } catch {
    return false
  }
}

export async function getPipelineBaseUrl() {
  if (resolvedPipelineBaseUrl) return resolvedPipelineBaseUrl
  if (pipelineResolutionPromise) return pipelineResolutionPromise

  pipelineResolutionPromise = (async () => {
    for (const candidate of pipelineCandidates) {
      // FastAPI health includes pipeline=ready; Express health does not.
      if (await probePipelineBaseUrl(candidate)) {
        resolvedPipelineBaseUrl = candidate
        return candidate
      }
    }

    resolvedPipelineBaseUrl = pipelineBaseUrlOverride || 'http://localhost:8000'
    return resolvedPipelineBaseUrl
  })()

  try {
    return await pipelineResolutionPromise
  } finally {
    pipelineResolutionPromise = null
  }
}

export async function fetchPipeline(input, init) {
  const baseUrl = await getPipelineBaseUrl()
  const path = typeof input === 'string' ? input : String(input)
  return fetch(`${baseUrl}${path}`, init)
}

export async function buildPipelineWsUrl(path) {
  const baseUrl = await getPipelineBaseUrl()
  const base = new URL(baseUrl)
  base.protocol = base.protocol === 'https:' ? 'wss:' : 'ws:'
  base.pathname = path
  base.search = ''
  base.hash = ''
  return base.toString()
}

export const pipelineFallbackBaseUrl =
  pipelineBaseUrlOverride
  || import.meta.env.VITE_BACKEND_URL
  || sameOriginBaseUrl
  || 'http://localhost:8000'

export const api = axios.create({
  baseURL: authApiBaseUrl,
  headers: {
    'Content-Type': 'application/json',
  },
})

export async function getProtectedMessage(getToken) {
  const token = await getToken()
  const response = await api.get('/api/protected', {
    headers: token ? { Authorization: `Bearer ${token}` } : undefined,
    withCredentials: true,
  })

  return response.data
}
