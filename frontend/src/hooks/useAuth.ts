'use client'

import { create } from 'zustand'
import { api, ApiError } from '@/lib/api'
import { clearTokens, getAccessToken, setTokens } from '@/lib/auth'
import { logger } from '@/lib/logger'
import type { TokenResponse, User } from '@/types'

interface AuthState {
  user: User | null
  accessToken: string | null
  isLoading: boolean
  isAuthenticated: boolean
  login: (email: string, password: string) => Promise<void>
  logout: () => void
  initialize: () => Promise<void>
}

export const useAuthStore = create<AuthState>((set, get) => ({
  user: null,
  accessToken: null,
  isLoading: true,
  isAuthenticated: false,

  initialize: async () => {
    logger.state('auth-store', 'initialize:start')
    const token = getAccessToken()
    if (!token) {
      logger.state('auth-store', 'initialize:no-token')
      set({ isLoading: false })
      return
    }
    try {
      const user = await api.get<User>('/api/v1/auth/me')
      set({ user, accessToken: token, isAuthenticated: true, isLoading: false })
      logger.state('auth-store', 'initialize:success', { email: user.email })
    } catch (err) {
      logger.state('auth-store', 'initialize:error', { error: err instanceof Error ? err.message : err })
      clearTokens()
      set({ isLoading: false })
    }
  },

  login: async (email: string, password: string) => {
    logger.state('auth-store', 'login:start', { email })
    try {
      const data = await api.post<TokenResponse>('/api/v1/auth/login', { email, password })
      setTokens(data.access_token, data.refresh_token)
      const user = await api.get<User>('/api/v1/auth/me')
      set({ user, accessToken: data.access_token, isAuthenticated: true })
      logger.state('auth-store', 'login:success', { email: user.email })
    } catch (err) {
      logger.state('auth-store', 'login:error', { error: err instanceof ApiError ? err.detail : err instanceof Error ? err.message : err })
      throw err
    }
  },

  logout: () => {
    logger.state('auth-store', 'logout', { email: get().user?.email })
    clearTokens()
    set({ user: null, accessToken: null, isAuthenticated: false })
  },
}))
