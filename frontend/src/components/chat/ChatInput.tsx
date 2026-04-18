'use client'

import { type FormEvent, type KeyboardEvent, useRef, useState } from 'react'
import { Button } from '@/components/ui/Button'

interface ChatInputProps {
  onSend: (text: string) => void
  disabled?: boolean
  onStop?: () => void
  isStreaming?: boolean
}

const MAX_CHARS = 2000

export function ChatInput({ onSend, disabled, onStop, isStreaming }: ChatInputProps) {
  const [value, setValue] = useState('')
  const textareaRef = useRef<HTMLTextAreaElement>(null)

  function handleSubmit(e?: FormEvent) {
    e?.preventDefault()
    const text = value.trim()
    if (!text || disabled || isStreaming) return
    setValue('')
    if (textareaRef.current) {
      textareaRef.current.style.height = 'auto'
    }
    onSend(text)
  }

  function handleKeyDown(e: KeyboardEvent<HTMLTextAreaElement>) {
    if (e.key === 'Enter' && !e.shiftKey) {
      e.preventDefault()
      handleSubmit()
    }
  }

  function handleChange(v: string) {
    if (v.length <= MAX_CHARS) setValue(v)
    // Auto-grow textarea
    if (textareaRef.current) {
      textareaRef.current.style.height = 'auto'
      textareaRef.current.style.height = `${Math.min(textareaRef.current.scrollHeight, 120)}px`
    }
  }

  return (
    <form onSubmit={handleSubmit} className="flex flex-col gap-2">
      <div className="flex gap-2 items-end bg-white border border-gray-300 rounded-xl px-3 py-2 focus-within:ring-2 focus-within:ring-primary focus-within:border-primary transition-all">
        <textarea
          ref={textareaRef}
          value={value}
          onChange={(e) => handleChange(e.target.value)}
          onKeyDown={handleKeyDown}
          placeholder="Ask a clinical question... (Enter to send, Shift+Enter for new line)"
          rows={1}
          disabled={disabled}
          className="flex-1 resize-none bg-transparent text-sm text-gray-900 placeholder-gray-400 focus:outline-none"
          style={{ maxHeight: '120px' }}
        />
        {isStreaming ? (
          <Button type="button" variant="danger" size="sm" onClick={onStop}>
            Stop
          </Button>
        ) : (
          <Button type="submit" size="sm" disabled={!value.trim() || disabled}>
            Send
          </Button>
        )}
      </div>
      <div className="flex justify-end">
        <span className={`text-xs ${value.length > MAX_CHARS * 0.9 ? 'text-warning' : 'text-gray-400'}`}>
          {value.length}/{MAX_CHARS}
        </span>
      </div>
    </form>
  )
}
