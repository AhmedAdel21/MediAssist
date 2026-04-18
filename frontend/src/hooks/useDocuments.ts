'use client'

import { useState } from 'react'
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query'
import { api } from '@/lib/api'
import { logger } from '@/lib/logger'
import type { DocumentStats, DocumentUploadResponse } from '@/types'

export function useDocumentStats() {
  return useQuery<DocumentStats>({
    queryKey: ['document-stats'],
    queryFn: async () => {
      logger.state('documents', 'stats:fetch')
      const result = await api.get<DocumentStats>('/api/v1/documents/stats')
      logger.state('documents', 'stats:success', result)
      return result
    },
    retry: false,
  })
}

export function useDocumentUpload() {
  const queryClient = useQueryClient()
  return useMutation<DocumentUploadResponse, Error, File>({
    mutationFn: (file: File) => {
      logger.state('documents', 'upload:start', { fileName: file.name, fileSize: file.size })
      return api.uploadFile<DocumentUploadResponse>('/api/v1/documents/upload', file)
    },
    onSuccess: (data, file) => {
      logger.state('documents', 'upload:success', { fileName: file.name, response: data })
      queryClient.invalidateQueries({ queryKey: ['document-stats'] })
    },
    onError: (err, file) => {
      logger.state('documents', 'upload:error', { fileName: file.name, error: err.message })
    },
  })
}
