import { clearTokens, getAccessToken, getRefreshToken, setTokens } from './auth'
import { logger } from './logger'
import type { TokenResponse } from '@/types'

class ApiError extends Error {
  constructor(
    public status: number,
    public detail: string,
  ) {
    super(detail)
    this.name = 'ApiError'
  }
}

async function parseError(res: Response): Promise<string> {
  try {
    const body = await res.json()
    if (typeof body.detail === 'string') return body.detail
    if (Array.isArray(body.detail)) {
      return body.detail.map((e: { msg: string }) => e.msg).join('; ')
    }
    return `Request failed with status ${res.status}`
  } catch {
    return `Request failed with status ${res.status}`
  }
}

let isRefreshing = false
let refreshQueue: Array<(token: string) => void> = []

async function refreshAccessToken(): Promise<string | null> {
  const refreshToken = getRefreshToken()
  if (!refreshToken) return null

  logger.auth('token-refresh-start')

  const res = await fetch('/api/v1/auth/refresh', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ refresh_token: refreshToken }),
  })

  if (!res.ok) {
    logger.auth('token-refresh-failed', { status: res.status })
    clearTokens()
    return null
  }

  const data: TokenResponse = await res.json()
  setTokens(data.access_token, data.refresh_token)
  logger.auth('token-refresh-success')
  return data.access_token
}

async function fetchWithAuth(url: string, options: RequestInit = {}): Promise<Response> {
  const token = getAccessToken()
  const headers = new Headers(options.headers)
  if (token) headers.set('Authorization', `Bearer ${token}`)
  headers.set('Content-Type', headers.get('Content-Type') ?? 'application/json')

  const method = (options.method ?? 'GET').toUpperCase()
  let bodyToLog: unknown
  try {
    if (options.body && typeof options.body === 'string') bodyToLog = JSON.parse(options.body)
  } catch { /* not JSON */ }
  logger.request(method, url, bodyToLog)

  let res = await fetch(url, { ...options, headers })

  if (res.status === 401) {
    if (isRefreshing) {
      const newToken = await new Promise<string>((resolve) => {
        refreshQueue.push(resolve)
      })
      headers.set('Authorization', `Bearer ${newToken}`)
      return fetch(url, { ...options, headers })
    }

    isRefreshing = true
    const newToken = await refreshAccessToken()
    isRefreshing = false

    if (newToken) {
      refreshQueue.forEach((cb) => cb(newToken))
      refreshQueue = []
      headers.set('Authorization', `Bearer ${newToken}`)
      res = await fetch(url, { ...options, headers })
    } else {
      refreshQueue = []
      logger.auth('session-expired')
      if (typeof window !== 'undefined') window.location.href = '/login'
      throw new ApiError(401, 'Session expired')
    }
  }

  const cloned = res.clone()
  cloned
    .json()
    .then((body) => logger.response(method, url, res.status, body))
    .catch(() => logger.response(method, url, res.status))

  return res
}

export const api = {
  async get<T>(path: string): Promise<T> {
    const res = await fetchWithAuth(path)
    if (!res.ok) throw new ApiError(res.status, await parseError(res))
    return res.json()
  },

  async post<T>(path: string, body?: unknown): Promise<T> {
    const res = await fetchWithAuth(path, {
      method: 'POST',
      body: body !== undefined ? JSON.stringify(body) : undefined,
    })
    if (!res.ok) throw new ApiError(res.status, await parseError(res))
    return res.json()
  },

  async patch<T>(path: string, body: unknown): Promise<T> {
    const res = await fetchWithAuth(path, {
      method: 'PATCH',
      body: JSON.stringify(body),
    })
    if (!res.ok) throw new ApiError(res.status, await parseError(res))
    return res.json()
  },

  async delete(path: string): Promise<void> {
    const res = await fetchWithAuth(path, { method: 'DELETE' })
    if (!res.ok && res.status !== 204) throw new ApiError(res.status, await parseError(res))
  },

  async uploadFile<T>(path: string, file: File): Promise<T> {
    const token = getAccessToken()
    const formData = new FormData()
    formData.append('file', file)
    const headers: HeadersInit = {}
    if (token) headers['Authorization'] = `Bearer ${token}`
    logger.request('POST', path, { fileName: file.name, fileSize: file.size })
    const res = await fetch(path, { method: 'POST', headers, body: formData })
    const cloned = res.clone()
    cloned
      .json()
      .then((body) => logger.response('POST', path, res.status, body))
      .catch(() => logger.response('POST', path, res.status))
    if (!res.ok) throw new ApiError(res.status, await parseError(res))
    return res.json()
  },

  async stream(path: string, body: unknown): Promise<Response> {
    const token = getAccessToken()
    const headers: HeadersInit = {
      'Content-Type': 'application/json',
    }
    if (token) headers['Authorization'] = `Bearer ${token}`
    logger.request('POST', path, body)
    return fetch(path, {
      method: 'POST',
      headers,
      body: JSON.stringify(body),
    })
  },
}

export { ApiError }
