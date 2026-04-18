import { clsx } from 'clsx'
import type { ChatMessage } from '@/hooks/useStreamingChat'
import { StreamingMessage } from './StreamingMessage'
import { ToolCallIndicator } from './ToolCallIndicator'

interface MessageBubbleProps {
  message: ChatMessage
}

export function MessageBubble({ message }: MessageBubbleProps) {
  const isUser = message.role === 'user'

  return (
    <div className={clsx('flex', isUser ? 'justify-end' : 'justify-start')}>
      <div className={clsx('max-w-[80%] rounded-2xl px-4 py-3', isUser ? 'bg-primary text-white' : 'bg-white border border-gray-200 shadow-sm')}>
        {isUser ? (
          <p className="text-sm whitespace-pre-wrap break-words">{message.content}</p>
        ) : (
          <>
            {message.toolCalls && message.toolCalls.length > 0 && message.isStreaming && (
              <ToolCallIndicator toolCalls={message.toolCalls} />
            )}
            <StreamingMessage content={message.content} isStreaming={!!message.isStreaming} />
          </>
        )}
      </div>
    </div>
  )
}
