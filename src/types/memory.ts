export interface MemoryTopic {
  id: string
  name: string
  status: 'ongoing' | 'resolved' | 'tabled' | 'contradicted'
  description: string
}

export interface MemoryDecision {
  id: string
  statement: string
}

export interface MemoryQuestion {
  id: string
  question: string
}

export interface MemoryData {
  topics: MemoryTopic[]
  decisions: MemoryDecision[]
  openQuestions: MemoryQuestion[]
}
