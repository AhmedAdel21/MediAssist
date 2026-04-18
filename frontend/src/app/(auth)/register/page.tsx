'use client'

import { type FormEvent, useState } from 'react'
import Link from 'next/link'
import { useRouter } from 'next/navigation'
import { api } from '@/lib/api'
import { Button } from '@/components/ui/Button'
import { Input } from '@/components/ui/Input'
import { Card } from '@/components/ui/Card'
import type { UserRole } from '@/types'

const ROLES: { value: UserRole; label: string }[] = [
  { value: 'doctor', label: 'Doctor' },
  { value: 'nurse', label: 'Nurse' },
  { value: 'patient', label: 'Patient' },
]

export default function RegisterPage() {
  const [form, setForm] = useState({ full_name: '', email: '', password: '', role: 'doctor' as UserRole })
  const [error, setError] = useState<string | null>(null)
  const [success, setSuccess] = useState(false)
  const [loading, setLoading] = useState(false)
  const router = useRouter()

  async function handleSubmit(e: FormEvent) {
    e.preventDefault()
    setError(null)
    setLoading(true)
    try {
      await api.post('/api/v1/auth/register', form)
      setSuccess(true)
      setTimeout(() => router.push('/login'), 1500)
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Registration failed')
    } finally {
      setLoading(false)
    }
  }

  return (
    <div className="min-h-screen bg-surface flex items-center justify-center p-4">
      <div className="w-full max-w-md">
        <div className="flex flex-col items-center mb-8">
          <div className="flex items-center justify-center w-14 h-14 bg-primary rounded-2xl shadow-lg mb-4">
            <div className="relative">
              <div className="w-6 h-1 bg-white rounded-full" />
              <div className="absolute top-1/2 left-1/2 -translate-x-1/2 -translate-y-1/2 w-1 h-6 bg-white rounded-full" />
            </div>
          </div>
          <h1 className="text-2xl font-bold text-gray-900">Create an account</h1>
          <p className="text-sm text-gray-500 mt-1">MediAssist AI</p>
        </div>

        <Card>
          {success ? (
            <div className="flex flex-col items-center gap-3 py-4">
              <div className="w-12 h-12 rounded-full bg-green-100 flex items-center justify-center">
                <svg className="h-6 w-6 text-success" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
                  <path strokeLinecap="round" strokeLinejoin="round" d="M5 13l4 4L19 7" />
                </svg>
              </div>
              <p className="text-sm font-medium text-gray-800">Account created! Redirecting to login…</p>
            </div>
          ) : (
            <form onSubmit={handleSubmit} className="flex flex-col gap-4">
              <Input
                id="full_name"
                label="Full name"
                placeholder="Dr. Jane Smith"
                value={form.full_name}
                onChange={(e) => setForm((f) => ({ ...f, full_name: e.target.value }))}
                required
              />
              <Input
                id="email"
                type="email"
                label="Email address"
                placeholder="jane@hospital.com"
                value={form.email}
                onChange={(e) => setForm((f) => ({ ...f, email: e.target.value }))}
                required
              />
              <Input
                id="password"
                type="password"
                label="Password"
                placeholder="Min 8 chars, 1 uppercase, 1 digit"
                value={form.password}
                onChange={(e) => setForm((f) => ({ ...f, password: e.target.value }))}
                required
              />

              <div className="flex flex-col gap-1">
                <label htmlFor="role" className="text-sm font-medium text-gray-700">
                  Role
                </label>
                <select
                  id="role"
                  value={form.role}
                  onChange={(e) => setForm((f) => ({ ...f, role: e.target.value as UserRole }))}
                  className="block w-full rounded-lg border border-gray-300 px-3 py-2 text-sm text-gray-900 focus:outline-none focus:ring-2 focus:ring-primary focus:border-primary"
                >
                  {ROLES.map((r) => (
                    <option key={r.value} value={r.value}>
                      {r.label}
                    </option>
                  ))}
                </select>
              </div>

              {error && (
                <div className="px-3 py-2 bg-red-50 border border-danger rounded-lg text-sm text-danger">
                  {error}
                </div>
              )}

              <Button type="submit" loading={loading} className="w-full">
                Create account
              </Button>

              <p className="text-center text-sm text-gray-500">
                Already have an account?{' '}
                <Link href="/login" className="text-primary font-medium hover:underline">
                  Sign in
                </Link>
              </p>
            </form>
          )}
        </Card>
      </div>
    </div>
  )
}
