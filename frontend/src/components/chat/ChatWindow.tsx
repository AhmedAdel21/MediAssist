'use client'

import { useEffect, useRef } from 'react'
import { useStreamingChat } from '@/hooks/useStreamingChat'
import { MessageBubble } from './MessageBubble'
import { ChatInput } from './ChatInput'
import { SourceCitations } from './SourceCitations'
import { Button } from '@/components/ui/Button'
import type { SourceChunk } from '@/types'

const SUGGESTIONS = [
  'What is the aspirin dose for cardiac events?',
  'What are the signs of pulmonary embolism?',
  'Upload a protocol and ask me anything',
]

export function ChatWindow() {
  const { messages, isStreaming, error, sendMessage, stopStreaming, clearConversation } = useStreamingChat()
  const bottomRef = useRef<HTMLDivElement>(null)

  useEffect(() => {
    bottomRef.current?.scrollIntoView({ behavior: 'smooth' })
  }, [messages])

  const lastAssistantMsg = [...messages].reverse().find((m) => m.role === 'assistant')
  const sources: SourceChunk[] = lastAssistantMsg?.sources ?? []

  return (
    <div className="flex h-full gap-4">
      {/* Left: conversation */}
      <div className="flex flex-col flex-1 min-w-0 bg-surface rounded-xl border border-gray-200 overflow-hidden">
        {/* Header */}
        <div className="flex items-center justify-between px-4 py-3 border-b border-gray-200 bg-white">
          <h2 className="font-semibold text-gray-800">Clinical AI Assistant</h2>
          {messages.length > 0 && (
            <Button variant="ghost" size="sm" onClick={clearConversation}>
              New conversation
            </Button>
          )}
        </div>

        {/* Messages */}
        <div className="flex-1 overflow-y-auto px-4 py-4 flex flex-col gap-3">
          {messages.length === 0 ? (
            <div className="flex flex-col items-center justify-center h-full gap-6 text-center">
              {/* Logo mark */}
              <div className="flex items-center justify-center w-16 h-16 bg-primary rounded-2xl shadow-lg">
                <div className="relative">
                  <div className="w-8 h-1.5 bg-white rounded-full" />
                  <div className="absolute top-1/2 left-1/2 -translate-x-1/2 -translate-y-1/2 w-1.5 h-8 bg-white rounded-full" />
                </div>
              </div>
              <div>
                <p className="text-lg font-semibold text-gray-800">Ask a clinical question</p>
                <p className="text-sm text-gray-500 mt-1">Answers are grounded in your uploaded protocols</p>
              </div>
              <div className="flex flex-col gap-2 w-full max-w-sm">
                {SUGGESTIONS.map((s) => (
                  <button
                    key={s}
                    onClick={() => sendMessage(s)}
                    className="text-left px-4 py-3 bg-white border border-gray-200 rounded-xl text-sm text-gray-700 hover:border-primary hover:text-primary transition-colors"
                  >
                    {s}
                  </button>
                ))}
              </div>
            </div>
          ) : (
            messages.map((msg) => <MessageBubble key={msg.id} message={msg} />)
          )}
          <div ref={bottomRef} />
        </div>

        {/* Error banner */}
        {error && (
          <div className="mx-4 mb-2 px-3 py-2 bg-red-50 border border-danger rounded-lg text-xs text-danger">
            {error}
          </div>
        )}

        {/* Input */}
        <div className="px-4 py-3 border-t border-gray-200 bg-white">
          <ChatInput
            onSend={sendMessage}
            isStreaming={isStreaming}
            onStop={stopStreaming}
            disabled={false}
          />
        </div>
      </div>

      {/* Right: sources panel */}
      <div className="w-80 flex-shrink-0 bg-white rounded-xl border border-gray-200 overflow-hidden hidden lg:flex flex-col">
        <div className="px-4 py-3 border-b border-gray-200">
          <h3 className="text-sm font-semibold text-gray-700">Source Documents</h3>
        </div>
        <div className="flex-1 overflow-y-auto px-3 py-3">
          <SourceCitations sources={sources} />
        </div>
      </div>
    </div>
  )
}
