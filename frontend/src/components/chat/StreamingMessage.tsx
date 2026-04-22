import ReactMarkdown from 'react-markdown'

interface StreamingMessageProps {
  content: string
  isStreaming: boolean
}

export function StreamingMessage({ content, isStreaming }: StreamingMessageProps) {
  return (
    <div className="text-sm text-gray-800 break-words prose prose-sm max-w-none
      prose-p:my-1 prose-ul:my-1 prose-ol:my-1 prose-li:my-0.5
      prose-strong:text-gray-900 prose-headings:text-gray-900">
      <ReactMarkdown>{content}</ReactMarkdown>
      {isStreaming && (
        <span className="inline-block w-0.5 h-4 ml-0.5 bg-gray-600 animate-pulse align-middle" />
      )}
    </div>
  )
}
