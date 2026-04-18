'use client'

import { useCallback, useRef, useState } from 'react'
import { getAccessToken } from '@/lib/auth'
import { logger } from '@/lib/logger'
import type { SourceChunk } from '@/types'

export interface ChatMessage {
  id: string
  role: 'user' | 'assistant'
  content: string
  isStreaming?: boolean
  toolCalls?: string[]
  sources?: SourceChunk[]
}

interface UseStreamingChatReturn {
  messages: ChatMessage[]
  isStreaming: boolean
  error: string | null
  sendMessage: (text: string) => Promise<void>
  stopStreaming: () => void
  clearConversation: () => void
}

function makeId(): string {
  return Math.random().toString(36).slice(2)
}

export function useStreamingChat(): UseStreamingChatReturn {
  const [messages, setMessages] = useState<ChatMessage[]>([])
  const [isStreaming, setIsStreaming] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const abortRef = useRef<AbortController | null>(null)

  const stopStreaming = useCallback(() => {
    abortRef.current?.abort()
    setIsStreaming(false)
    setMessages((prev) =>
      prev.map((m) => (m.isStreaming ? { ...m, isStreaming: false } : m)),
    )
  }, [])

  const clearConversation = useCallback(() => {
    abortRef.current?.abort()
    setMessages([])
    setIsStreaming(false)
    setError(null)
  }, [])

  const sendMessage = useCallback(
    async (text: string) => {
      if (isStreaming) return
      setError(null)

      const userMsg: ChatMessage = { id: makeId(), role: 'user', content: text }
      const assistantId = makeId()
      const assistantMsg: ChatMessage = {
        id: assistantId,
        role: 'assistant',
        content: '',
        isStreaming: true,
        toolCalls: [],
      }

      setMessages((prev) => [...prev, userMsg, assistantMsg])
      setIsStreaming(true)

      const history = messages.map((m) => ({ role: m.role, content: m.content }))
      const requestBody = { message: text, conversation_history: history }

      const controller = new AbortController()
      abortRef.current = controller

      try {
        const token = getAccessToken()
        const url = '/api/v1/agent/chat/stream'
        logger.request('POST', url, requestBody)

        const res = await fetch(url, {
          method: 'POST',
          headers: {
            'Content-Type': 'application/json',
            ...(token ? { Authorization: `Bearer ${token}` } : {}),
          },
          body: JSON.stringify(requestBody),
          signal: controller.signal,
        })

        if (!res.ok) {
          logger.stream('error', `Server error: ${res.status}`)
          throw new Error(`Server error: ${res.status}`)
        }

        const reader = res.body!.getReader()
        const decoder = new TextDecoder()
        let buffer = ''

        while (true) {
          const { done, value } = await reader.read()
          if (done) break

          buffer += decoder.decode(value, { stream: true })
          const lines = buffer.split('\n\n')
          buffer = lines.pop() ?? ''

          for (const line of lines) {
            if (!line.startsWith('data: ')) continue
            const data = line.slice(6)

            if (data === '[DONE]') {
              logger.stream('done')
              setMessages((prev) =>
                prev.map((m) =>
                  m.id === assistantId ? { ...m, isStreaming: false } : m,
                ),
              )
              setIsStreaming(false)
              return
            }

            if (data.startsWith('[ERROR]')) {
              const errMsg = data.slice(7).trim()
              logger.stream('error', errMsg)
              setError(errMsg)
              setMessages((prev) =>
                prev.map((m) =>
                  m.id === assistantId
                    ? { ...m, content: `Error: ${errMsg}`, isStreaming: false }
                    : m,
                ),
              )
              setIsStreaming(false)
              return
            }

            if (data.startsWith('[Using tool:')) {
              logger.stream('tool-call', data)
              setMessages((prev) =>
                prev.map((m) =>
                  m.id === assistantId
                    ? { ...m, toolCalls: [...(m.toolCalls ?? []), data] }
                    : m,
                ),
              )
            } else {
              logger.stream('chunk', data)
              setMessages((prev) =>
                prev.map((m) =>
                  m.id === assistantId
                    ? { ...m, content: m.content + data }
                    : m,
                ),
              )
            }
          }
        }
      } catch (err) {
        if ((err as Error).name === 'AbortError') {
          logger.stream('aborted')
          return
        }
        const msg = err instanceof Error ? err.message : 'Unknown error'
        logger.stream('error', msg)
        setError(msg)
        setMessages((prev) =>
          prev.map((m) =>
            m.id === assistantId
              ? { ...m, content: `Error: ${msg}`, isStreaming: false }
              : m,
          ),
        )
      } finally {
        setIsStreaming(false)
      }
    },
    [isStreaming, messages],
  )

  return { messages, isStreaming, error, sendMessage, stopStreaming, clearConversation }
}
