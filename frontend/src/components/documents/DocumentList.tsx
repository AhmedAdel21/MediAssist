'use client'

import { Spinner } from '@/components/ui/Spinner'
import { useDocumentStats } from '@/hooks/useDocuments'

export function DocumentList() {
  const { data, isLoading, error } = useDocumentStats()

  if (isLoading) {
    return (
      <div className="flex items-center justify-center py-12">
        <Spinner />
      </div>
    )
  }

  if (error) {
    return (
      <div className="py-8 text-center text-sm text-danger">
        Failed to load document stats
      </div>
    )
  }

  return (
    <div className="flex flex-col gap-4">
      <div className="flex items-center gap-3 px-4 py-3 bg-blue-50 border border-blue-200 rounded-lg">
        <svg className="h-5 w-5 text-secondary flex-shrink-0" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
          <path strokeLinecap="round" strokeLinejoin="round" d="M13 16h-1v-4h-1m1-4h.01M21 12a9 9 0 11-18 0 9 9 0 0118 0z" />
        </svg>
        <p className="text-sm text-secondary">
          Document list coming soon. Currently indexed:{' '}
          <strong>{data?.total_chunks ?? 0} chunks</strong> in collection{' '}
          <code className="text-xs bg-blue-100 px-1 py-0.5 rounded">{data?.collection_name}</code>
        </p>
      </div>

      {(data?.total_chunks ?? 0) === 0 && (
        <div className="flex flex-col items-center py-12 text-gray-400">
          <svg className="h-12 w-12 mb-3 opacity-40" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={1.5}>
            <path strokeLinecap="round" strokeLinejoin="round" d="M9 12h6m-6 4h6m2 5H7a2 2 0 01-2-2V5a2 2 0 012-2h5.586a1 1 0 01.707.293l5.414 5.414a1 1 0 01.293.707V19a2 2 0 01-2 2z" />
          </svg>
          <p className="text-sm">No documents yet. Upload a medical protocol to get started.</p>
        </div>
      )}
    </div>
  )
}
