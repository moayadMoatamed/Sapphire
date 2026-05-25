export interface ChatMessage {
  id: string
  role: 'user' | 'assistant'
  content: string
  tokens?: number
  createdAt?: string | Date
}

export interface ChatSession {
  id: string
  userId: string
  bookId: string
  title: string
  createdAt: string | Date
  updatedAt: string | Date
}
