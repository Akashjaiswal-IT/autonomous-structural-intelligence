import axios from 'axios'

export const api = axios.create({
  baseURL: import.meta.env.VITE_API_URL || 'http://localhost:8787',
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
