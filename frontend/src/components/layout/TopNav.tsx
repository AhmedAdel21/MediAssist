'use client'

import { usePathname } from 'next/navigation'

const PAGE_TITLES: Record<string, string> = {
  '/chat': 'Chat',
  '/documents': 'Documents',
  '/admin': 'Admin',
}

export function TopNav() {
  const pathname = usePathname()
  const title = Object.entries(PAGE_TITLES).find(([k]) => pathname.startsWith(k))?.[1] ?? 'Dashboard'

  return (
    <header className="h-14 flex items-center px-6 border-b border-gray-200 bg-white sticky top-0 z-10">
      <nav className="flex items-center gap-2 text-sm text-gray-500">
        <span>MediAssist AI</span>
        <span className="text-gray-300">/</span>
        <span className="text-gray-800 font-medium">{title}</span>
      </nav>
    </header>
  )
}
