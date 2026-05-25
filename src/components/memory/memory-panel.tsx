'use client'

import { useMemoryPanel } from '@/hooks/use-memory-panel'
import { cn } from '@/lib/utils'
import { Lightbulb, CheckCircle2, HelpCircle, Circle } from 'lucide-react'

const STATUS_ICONS: Record<string, typeof Circle> = {
  ongoing: Circle,
  resolved: CheckCircle2,
  tabled: Circle,
  contradicted: Circle,
}

export function MemoryPanel({ sessionId }: { sessionId: string }) {
  const { memory, loading } = useMemoryPanel(sessionId)

  if (loading) {
    return <div className="p-4 text-sm text-ink-300">Loading memory...</div>
  }

  return (
    <div className="divide-y divide-sapphire-800/40">
      {memory?.topics && memory.topics.length > 0 && (
        <section className="p-4">
          <h3 className="font-sans text-xs font-semibold text-ink-400 uppercase tracking-wide mb-2">
            Active topics
          </h3>
          <div className="space-y-2">
            {memory.topics.map((topic) => {
              const Icon = STATUS_ICONS[topic.status] ?? Circle
              return (
                <div key={topic.id} className="flex items-start gap-2">
                  <Icon
                    className={cn(
                      'h-4 w-4 mt-0.5 shrink-0',
                      topic.status === 'resolved' && 'text-success-500',
                      topic.status === 'contradicted' && 'text-danger-500',
                      topic.status === 'ongoing' && 'text-sapphire-300',
                    )}
                  />
                  <div>
                    <p className="text-sm font-medium text-sapphire-100">{topic.name}</p>
                    <p className="text-xs text-ink-300">{topic.description}</p>
                  </div>
                </div>
              )
            })}
          </div>
        </section>
      )}

      {memory?.decisions && memory.decisions.length > 0 && (
        <section className="p-4">
          <h3 className="font-sans text-xs font-semibold text-ink-400 uppercase tracking-wide mb-2">
            Decisions
          </h3>
          <div className="space-y-2">
            {memory.decisions.map((d) => (
              <div key={d.id} className="flex items-start gap-2">
                <CheckCircle2 className="h-4 w-4 mt-0.5 text-gold-400 shrink-0" />
                <p className="text-sm text-sapphire-100">{d.statement}</p>
              </div>
            ))}
          </div>
        </section>
      )}

      {memory?.openQuestions && memory.openQuestions.length > 0 && (
        <section className="p-4">
          <h3 className="font-sans text-xs font-semibold text-ink-400 uppercase tracking-wide mb-2">
            Open questions
          </h3>
          <div className="space-y-2">
            {memory.openQuestions.map((q) => (
              <div key={q.id} className="flex items-start gap-2">
                <HelpCircle className="h-4 w-4 mt-0.5 text-gold-400 shrink-0" />
                <p className="text-sm text-sapphire-100">{q.question}</p>
              </div>
            ))}
          </div>
        </section>
      )}

      {(!memory ||
        (!memory.topics?.length &&
          !memory.decisions?.length &&
          !memory.openQuestions?.length)) && (
        <div className="p-4 text-sm text-center">
          <Lightbulb className="h-6 w-6 mx-auto mb-2 text-sapphire-300/30" />
          <p className="text-ink-300">Memory builds as you chat.</p>
          <p className="text-xs text-ink-400 mt-1">
            Topics, decisions, and questions will appear here.
          </p>
        </div>
      )}
    </div>
  )
}
