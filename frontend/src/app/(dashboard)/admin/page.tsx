'use client'

import { useEffect, useState } from 'react'
import { useRouter } from 'next/navigation'
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query'
import { useAuthStore } from '@/hooks/useAuth'
import { api } from '@/lib/api'
import { Badge } from '@/components/ui/Badge'
import { Button } from '@/components/ui/Button'
import { Card } from '@/components/ui/Card'
import { Spinner } from '@/components/ui/Spinner'
import { Modal } from '@/components/ui/Modal'
import type { PaginatedUsers, User, UserRole } from '@/types'

const ROLES: UserRole[] = ['admin', 'doctor', 'nurse', 'patient']

function StatsCard({ label, value, color }: { label: string; value: number; color: string }) {
  return (
    <Card padding="md" className="flex flex-col gap-1">
      <p className="text-sm text-gray-500">{label}</p>
      <p className={`text-3xl font-bold ${color}`}>{value}</p>
    </Card>
  )
}

export default function AdminPage() {
  const user = useAuthStore((s) => s.user)
  const router = useRouter()
  const queryClient = useQueryClient()
  const [page, setPage] = useState(1)
  const [editUser, setEditUser] = useState<User | null>(null)
  const [editRole, setEditRole] = useState<UserRole>('doctor')

  useEffect(() => {
    if (user && user.role !== 'admin') {
      router.push('/chat')
    }
  }, [user, router])

  const { data, isLoading } = useQuery<PaginatedUsers>({
    queryKey: ['admin-users', page],
    queryFn: () => api.get<PaginatedUsers>(`/api/v1/admin/users?page=${page}&page_size=20`),
    enabled: user?.role === 'admin',
  })

  const patchMutation = useMutation({
    mutationFn: ({ id, body }: { id: string; body: Partial<User> }) =>
      api.patch<User>(`/api/v1/admin/users/${id}`, body),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['admin-users'] })
      setEditUser(null)
    },
  })

  if (!user || user.role !== 'admin') return null

  const items = data?.items ?? []
  const stats = {
    total: data?.total ?? 0,
    active: items.filter((u) => u.is_active).length,
    doctors: items.filter((u) => u.role === 'doctor').length,
    nurses: items.filter((u) => u.role === 'nurse').length,
  }

  return (
    <div className="flex flex-col gap-6">
      <div>
        <h1 className="text-xl font-bold text-gray-900">User Management</h1>
        <p className="text-sm text-gray-500 mt-1">Manage users, roles, and access</p>
      </div>

      {/* Stats */}
      <div className="grid grid-cols-2 lg:grid-cols-4 gap-4">
        <StatsCard label="Total users" value={data?.total ?? 0} color="text-gray-900" />
        <StatsCard label="Active" value={stats.active} color="text-success" />
        <StatsCard label="Doctors" value={stats.doctors} color="text-secondary" />
        <StatsCard label="Nurses" value={stats.nurses} color="text-primary" />
      </div>

      {/* Table */}
      <Card padding="none" className="overflow-hidden">
        {isLoading ? (
          <div className="flex justify-center py-12">
            <Spinner />
          </div>
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full text-sm">
              <thead>
                <tr className="border-b border-gray-200 bg-gray-50">
                  <th className="text-left px-4 py-3 font-semibold text-gray-600">User</th>
                  <th className="text-left px-4 py-3 font-semibold text-gray-600">Role</th>
                  <th className="text-left px-4 py-3 font-semibold text-gray-600">Status</th>
                  <th className="text-left px-4 py-3 font-semibold text-gray-600">Created</th>
                  <th className="text-right px-4 py-3 font-semibold text-gray-600">Actions</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-gray-100">
                {items.map((u) => {
                  const initials = u.full_name.split(' ').map((n) => n[0]).join('').toUpperCase().slice(0, 2)
                  return (
                    <tr key={u.id} className="hover:bg-gray-50 transition-colors">
                      <td className="px-4 py-3">
                        <div className="flex items-center gap-3">
                          <div className="w-8 h-8 rounded-full bg-primary/10 text-primary text-xs font-bold flex items-center justify-center flex-shrink-0">
                            {initials}
                          </div>
                          <div>
                            <p className="font-medium text-gray-800">{u.full_name}</p>
                            <p className="text-xs text-gray-400">{u.email}</p>
                          </div>
                        </div>
                      </td>
                      <td className="px-4 py-3">
                        <Badge variant={u.role}>{u.role}</Badge>
                      </td>
                      <td className="px-4 py-3">
                        <Badge variant={u.is_active ? 'success' : 'danger'}>
                          {u.is_active ? 'Active' : 'Inactive'}
                        </Badge>
                      </td>
                      <td className="px-4 py-3 text-gray-500">
                        {new Date(u.created_at).toLocaleDateString()}
                      </td>
                      <td className="px-4 py-3 text-right">
                        <div className="flex items-center justify-end gap-2">
                          <Button
                            variant="ghost"
                            size="sm"
                            onClick={() => { setEditUser(u); setEditRole(u.role) }}
                          >
                            Edit
                          </Button>
                          <Button
                            variant={u.is_active ? 'danger' : 'ghost'}
                            size="sm"
                            onClick={() => patchMutation.mutate({ id: u.id, body: { is_active: !u.is_active } })}
                          >
                            {u.is_active ? 'Deactivate' : 'Reactivate'}
                          </Button>
                        </div>
                      </td>
                    </tr>
                  )
                })}
              </tbody>
            </table>
          </div>
        )}

        {/* Pagination */}
        {data && data.total_pages > 1 && (
          <div className="flex items-center justify-between px-4 py-3 border-t border-gray-200">
            <p className="text-sm text-gray-500">
              Page {data.page} of {data.total_pages} ({data.total} users)
            </p>
            <div className="flex gap-2">
              <Button variant="ghost" size="sm" disabled={page === 1} onClick={() => setPage((p) => p - 1)}>
                Previous
              </Button>
              <Button
                variant="ghost"
                size="sm"
                disabled={page === data.total_pages}
                onClick={() => setPage((p) => p + 1)}
              >
                Next
              </Button>
            </div>
          </div>
        )}
      </Card>

      {/* Edit modal */}
      <Modal open={!!editUser} onClose={() => setEditUser(null)} title="Edit User">
        {editUser && (
          <div className="flex flex-col gap-4">
            <p className="text-sm text-gray-600">
              <span className="font-medium">{editUser.full_name}</span> — {editUser.email}
            </p>
            <div className="flex flex-col gap-1">
              <label className="text-sm font-medium text-gray-700">Role</label>
              <select
                value={editRole}
                onChange={(e) => setEditRole(e.target.value as UserRole)}
                className="block w-full rounded-lg border border-gray-300 px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-primary"
              >
                {ROLES.map((r) => (
                  <option key={r} value={r}>{r}</option>
                ))}
              </select>
            </div>
            <div className="flex gap-2 justify-end">
              <Button variant="ghost" onClick={() => setEditUser(null)}>
                Cancel
              </Button>
              <Button
                onClick={() => patchMutation.mutate({ id: editUser.id, body: { role: editRole } })}
                loading={patchMutation.isPending}
              >
                Save changes
              </Button>
            </div>
          </div>
        )}
      </Modal>
    </div>
  )
}
