'use client'

import { type ReactNode, useEffect } from 'react'
import { useRouter } from 'next/navigation'
import { useAuthStore } from '@/hooks/useAuth'
import { Spinner } from '@/components/ui/Spinner'

export function AuthGuard({ children }: { children: ReactNode }) {
  const { isAuthenticated, isLoading, initialize } = useAuthStore()
  const router = useRouter()

  useEffect(() => {
    initialize()
  }, [initialize])

  useEffect(() => {
    if (!isLoading && !isAuthenticated) {
      router.push('/login')
    }
  }, [isLoading, isAuthenticated, router])

  if (isLoading) {
    return (
      <div className="flex h-screen items-center justify-center bg-surface">
        <Spinner size="lg" />
      </div>
    )
  }

  if (!isAuthenticated) return null

  return <>{children}</>
}
