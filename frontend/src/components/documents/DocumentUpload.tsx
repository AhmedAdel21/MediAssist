'use client'

import { type DragEvent, useRef, useState } from 'react'
import { clsx } from 'clsx'
import { Button } from '@/components/ui/Button'
import { useDocumentUpload } from '@/hooks/useDocuments'

const ACCEPTED = ['.txt', '.md', '.pdf']
const ACCEPT_MIME = 'text/plain,text/markdown,.md,application/pdf'

export function DocumentUpload() {
  const [dragging, setDragging] = useState(false)
  const [selectedFile, setSelectedFile] = useState<File | null>(null)
  const [successMsg, setSuccessMsg] = useState<string | null>(null)
  const inputRef = useRef<HTMLInputElement>(null)
  const upload = useDocumentUpload()

  function handleDrop(e: DragEvent) {
    e.preventDefault()
    setDragging(false)
    const file = e.dataTransfer.files[0]
    if (file) setSelectedFile(file)
  }

  async function handleUpload() {
    if (!selectedFile) return
    setSuccessMsg(null)
    try {
      const result = await upload.mutateAsync(selectedFile)
      setSuccessMsg(`"${result.filename}" indexed into ${result.chunks_created} searchable chunks`)
      setSelectedFile(null)
    } catch {
      // error is in upload.error
    }
  }

  function formatSize(bytes: number): string {
    if (bytes < 1024) return `${bytes} B`
    if (bytes < 1024 * 1024) return `${(bytes / 1024).toFixed(1)} KB`
    return `${(bytes / 1024 / 1024).toFixed(1)} MB`
  }

  return (
    <div className="flex flex-col gap-4">
      <div
        onDragOver={(e) => { e.preventDefault(); setDragging(true) }}
        onDragLeave={() => setDragging(false)}
        onDrop={handleDrop}
        onClick={() => inputRef.current?.click()}
        className={clsx(
          'border-2 border-dashed rounded-xl p-8 text-center cursor-pointer transition-colors',
          dragging ? 'border-primary bg-primary/5' : 'border-gray-300 hover:border-primary hover:bg-gray-50',
        )}
      >
        <input
          ref={inputRef}
          type="file"
          accept={ACCEPT_MIME}
          className="hidden"
          onChange={(e) => { const f = e.target.files?.[0]; if (f) setSelectedFile(f) }}
        />
        <svg className="mx-auto h-10 w-10 text-gray-300 mb-3" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={1.5}>
          <path strokeLinecap="round" strokeLinejoin="round" d="M3 16.5v2.25A2.25 2.25 0 005.25 21h13.5A2.25 2.25 0 0021 18.75V16.5m-13.5-9L12 3m0 0l4.5 4.5M12 3v13.5" />
        </svg>
        {selectedFile ? (
          <div>
            <p className="font-medium text-gray-800">{selectedFile.name}</p>
            <p className="text-sm text-gray-500">{formatSize(selectedFile.size)}</p>
          </div>
        ) : (
          <div>
            <p className="text-sm font-medium text-gray-700">Drop a file here or click to browse</p>
            <p className="text-xs text-gray-400 mt-1">Accepted: {ACCEPTED.join(', ')}</p>
          </div>
        )}
      </div>

      {upload.error && (
        <p className="text-sm text-danger">{(upload.error as Error).message}</p>
      )}
      {successMsg && (
        <p className="text-sm text-success font-medium">✓ {successMsg}</p>
      )}

      {selectedFile && (
        <Button onClick={handleUpload} loading={upload.isPending} disabled={upload.isPending}>
          Upload and Index
        </Button>
      )}
    </div>
  )
}
