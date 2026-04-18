'use client'

import { useState } from 'react'
import { clsx } from 'clsx'
import type { SourceChunk } from '@/types'

interface SourceCitationsProps {
  sources: SourceChunk[]
}

function SourceItem({ source, index }: { source: SourceChunk; index: number }) {
  const [expanded, setExpanded] = useState(false)
  const pct = Math.round(source.relevance_score * 100)

  return (
    <div className="border border-gray-200 rounded-lg overflow-hidden">
      <button
        onClick={() => setExpanded(!expanded)}
        className="w-full flex items-center justify-between px-3 py-2 text-left hover:bg-gray-50 transition-colors"
      >
        <div className="flex items-center gap-2 min-w-0">
          <span className="text-xs font-mono text-gray-400">#{index + 1}</span>
          <span className="text-xs font-medium text-gray-700 truncate">
            {source.metadata.filename}
          </span>
        </div>
        <div className="flex items-center gap-2 flex-shrink-0">
          <span
            className={clsx(
              'text-xs font-medium px-1.5 py-0.5 rounded',
              pct >= 80 ? 'bg-green-100 text-green-700' :
              pct >= 60 ? 'bg-yellow-100 text-yellow-700' :
              'bg-gray-100 text-gray-600',
            )}
          >
            {pct}%
          </span>
          <svg
            className={clsx('h-3.5 w-3.5 text-gray-400 transition-transform', expanded && 'rotate-180')}
            fill="none"
            viewBox="0 0 24 24"
            stroke="currentColor"
            strokeWidth={2}
          >
            <path strokeLinecap="round" strokeLinejoin="round" d="M19 9l-7 7-7-7" />
          </svg>
        </div>
      </button>
      {expanded && (
        <div className="px-3 py-2 bg-gray-50 border-t border-gray-200">
          <p className="text-xs text-gray-600 leading-relaxed">{source.content}</p>
        </div>
      )}
    </div>
  )
}

export function SourceCitations({ sources }: SourceCitationsProps) {
  if (!sources.length) {
    return (
      <div className="flex flex-col items-center justify-center h-full text-gray-400 text-sm py-8">
        <svg className="h-8 w-8 mb-2 opacity-40" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={1.5}>
          <path strokeLinecap="round" strokeLinejoin="round" d="M9 12h6m-6 4h6m2 5H7a2 2 0 01-2-2V5a2 2 0 012-2h5.586a1 1 0 01.707.293l5.414 5.414a1 1 0 01.293.707V19a2 2 0 01-2 2z" />
        </svg>
        <p>Sources will appear here after a response</p>
      </div>
    )
  }

  return (
    <div className="flex flex-col gap-2">
      <h3 className="text-xs font-semibold text-gray-500 uppercase tracking-wide px-1">
        Sources ({sources.length})
      </h3>
      {sources.map((s, i) => (
        <SourceItem key={i} source={s} index={i} />
      ))}
    </div>
  )
}
