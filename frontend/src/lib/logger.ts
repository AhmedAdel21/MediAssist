const isDev = process.env.NODE_ENV !== 'production'

function group(label: string, color: string, fn: () => void) {
  if (!isDev) return
  console.group(`%c${label}`, `color: ${color}; font-weight: bold`)
  fn()
  console.groupEnd()
}

export const logger = {
  request(method: string, url: string, body?: unknown) {
    if (!isDev) return
    group(`→ ${method} ${url}`, '#2196F3', () => {
      if (body !== undefined) console.log('body:', body)
    })
  },

  response(method: string, url: string, status: number, body?: unknown) {
    if (!isDev) return
    const color = status >= 400 ? '#F44336' : '#4CAF50'
    group(`← ${method} ${url} [${status}]`, color, () => {
      if (body !== undefined) console.log('body:', body)
    })
  },

  stream(event: 'chunk' | 'tool-call' | 'done' | 'error' | 'aborted', data?: unknown) {
    if (!isDev) return
    const colors: Record<string, string> = {
      chunk: '#9C27B0',
      'tool-call': '#FF9800',
      done: '#4CAF50',
      error: '#F44336',
      aborted: '#9E9E9E',
    }
    group(`~ stream:${event}`, colors[event] ?? '#9C27B0', () => {
      if (data !== undefined) console.log('data:', data)
    })
  },

  auth(
    event:
      | 'tokens-set'
      | 'tokens-cleared'
      | 'token-read'
      | 'token-refresh-start'
      | 'token-refresh-success'
      | 'token-refresh-failed'
      | 'session-expired',
    detail?: unknown,
  ) {
    if (!isDev) return
    const color = event.includes('failed') || event === 'session-expired' ? '#F44336' : '#FF9800'
    group(`🔑 auth:${event}`, color, () => {
      if (detail !== undefined) console.log('detail:', detail)
    })
  },

  state(store: string, event: string, detail?: unknown) {
    if (!isDev) return
    const color = event.includes('error') || event.includes('fail') ? '#F44336' : '#00BCD4'
    group(`◆ ${store}:${event}`, color, () => {
      if (detail !== undefined) console.log('detail:', detail)
    })
  },
}
