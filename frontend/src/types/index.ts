export type UserRole = 'admin' | 'doctor' | 'nurse' | 'patient'

export interface User {
  id: string
  email: string
  full_name: string
  role: UserRole
  is_active: boolean
  created_at: string
}

export interface TokenResponse {
  access_token: string
  refresh_token: string
  token_type: string
  expires_in: number
}

export interface DocumentUploadResponse {
  doc_id: string
  filename: string
  chunks_created: number
  message: string
}

export interface SourceChunk {
  content: string
  relevance_score: number
  metadata: {
    filename: string
    doc_id: string
    chunk_index?: number
    uploader_id?: string
  }
}

export interface QueryResponse {
  question: string
  chunks: SourceChunk[]
  total_found: number
}

export interface DocumentStats {
  total_chunks: number
  collection_name: string
}

export interface PaginatedUsers {
  items: User[]
  total: number
  page: number
  page_size: number
  total_pages: number
}

export interface ApiError {
  detail: string | { msg: string; type: string }[]
}
