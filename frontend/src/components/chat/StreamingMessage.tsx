interface StreamingMessageProps {
  content: string
  isStreaming: boolean
}

export function StreamingMessage({ content, isStreaming }: StreamingMessageProps) {
  return (
    <span className="whitespace-pre-wrap break-words text-sm text-gray-800">
      {content}
      {isStreaming && (
        <span className="inline-block w-0.5 h-4 ml-0.5 bg-gray-600 animate-pulse align-middle" />
      )}
    </span>
  )
}
