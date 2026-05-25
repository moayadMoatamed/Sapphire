import { db } from '@/db'
import { eq, desc, and } from 'drizzle-orm'
import { randomUUID as uuid } from 'node:crypto'

// In-memory L0 store (backed by LangGraph checkpoints in production)
const l0Store = new Map<string, Message[]>()

export interface Message {
  id: string
  role: 'user' | 'assistant'
  content: string
  miniRoundIndex: number
  tokens: number
  createdAt: Date
}

export interface SummaryChunk {
  id: string
  sessionId: string
  ordinal: number
  text: string
  topicTags: string[]
  coveredMiniRounds: [number, number]
  createdAt: Date
}

export interface Topic {
  id: string
  name: string
  status: 'ongoing' | 'resolved' | 'tabled' | 'contradicted'
  firstMentionedAt: number
  lastMentionedAt: number
  description: string
  linkedBookEntityIds: string[]
}

export interface Decision {
  id: string
  statement: string
  reasoning: string
  miniRoundIndex: number
}

export interface OpenQuestion {
  id: string
  question: string
  raisedAt: number
  context: string
}

export interface StructuredMemory {
  sessionId: string
  topics: Topic[]
  decisions: Decision[]
  openQuestions: OpenQuestion[]
  updatedAt: Date
}

const L0_TOKEN_LIMIT = 4000
const L0_MINI_ROUNDS_LIMIT = 6

export function getActiveContext(sessionId: string): Message[] {
  return l0Store.get(sessionId) ?? []
}

export function appendMessages(sessionId: string, messages: Message[]): void {
  const current = getActiveContext(sessionId)
  l0Store.set(sessionId, [...current, ...messages])
}

export function getRecentSummaries(_sessionId: string, limit?: number): SummaryChunk[] {
  // In production: query Postgres chat_summaries table
  void limit
  return []
}

export async function recallSemantic(
  _sessionId: string,
  _query: string,
  opts?: { k?: number; minScore?: number; excludeIds?: string[] },
): Promise<SummaryChunk[]> {
  // In production: pgvector similarity search on chat_summaries.embedding
  void opts
  return []
}

export function getStructuredMemory(_sessionId: string): StructuredMemory {
  // In production: query Postgres structured_memory table
  return {
    sessionId: _sessionId,
    topics: [],
    decisions: [],
    openQuestions: [],
    updatedAt: new Date(),
  }
}

export async function updateStructuredMemory(
  sessionId: string,
  data: Partial<StructuredMemory>,
): Promise<void> {
  // In production: upsert into structured_memory table
  void sessionId
  void data
}
