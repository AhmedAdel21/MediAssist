interface ToolCallIndicatorProps {
  toolCalls: string[]
}

export function ToolCallIndicator({ toolCalls }: ToolCallIndicatorProps) {
  if (!toolCalls.length) return null

  return (
    <div className="flex flex-wrap gap-1.5 mt-1">
      {toolCalls.map((tc, i) => (
        <span
          key={i}
          className="inline-flex items-center gap-1 px-2.5 py-1 bg-gray-100 text-gray-600 text-xs rounded-full border border-gray-200"
        >
          <svg className="animate-spin h-3 w-3" fill="none" viewBox="0 0 24 24">
            <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4" />
            <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4z" />
          </svg>
          {tc.replace('[Using tool: ', '').replace('...]', '')}
        </span>
      ))}
    </div>
  )
}
