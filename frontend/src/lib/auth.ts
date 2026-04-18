import { logger } from './logger'

const ACCESS_TOKEN_KEY = 'mediassist_access_token'
const REFRESH_TOKEN_KEY = 'mediassist_refresh_token'

export function getAccessToken(): string | null {
  if (typeof window === 'undefined') return null
  const token = localStorage.getItem(ACCESS_TOKEN_KEY)
  logger.auth('token-read', { key: 'access', found: token !== null })
  return token
}

export function getRefreshToken(): string | null {
  if (typeof window === 'undefined') return null
  const token = localStorage.getItem(REFRESH_TOKEN_KEY)
  logger.auth('token-read', { key: 'refresh', found: token !== null })
  return token
}

export function setTokens(accessToken: string, refreshToken: string): void {
  localStorage.setItem(ACCESS_TOKEN_KEY, accessToken)
  localStorage.setItem(REFRESH_TOKEN_KEY, refreshToken)
  logger.auth('tokens-set')
}

export function clearTokens(): void {
  localStorage.removeItem(ACCESS_TOKEN_KEY)
  localStorage.removeItem(REFRESH_TOKEN_KEY)
  logger.auth('tokens-cleared')
}
