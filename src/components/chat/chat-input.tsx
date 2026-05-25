'use client'

import { useState, useRef, useCallback, type KeyboardEvent } from 'react'
import { Button } from '@/components/ui/button'
import { ArrowUp, Loader2 } from 'lucide-react'

interface ChatInputProps {
  onSend: (message: string) => void
  disabled?: boolean
}

export function ChatInput({ onSend, disabled }: ChatInputProps) {
  const [input, setInput] = useState('')
  const textareaRef = useRef<HTMLTextAreaElement>(null)

  const handleSend = useCallback(() => {
    const trimmed = input.trim()
    if (!trimmed || disabled) return
    onSend(trimmed)
    setInput('')
    if (textareaRef.current) {
      textareaRef.current.style.height = 'auto'
    }
  }, [input, disabled, onSend])

  const handleKeyDown = useCallback(
    (e: KeyboardEvent<HTMLTextAreaElement>) => {
      if (e.key === 'Enter' && !e.shiftKey) {
        e.preventDefault()
        handleSend()
      }
    },
    [handleSend],
  )

  const handleInput = useCallback(() => {
    if (textareaRef.current) {
      textareaRef.current.style.height = 'auto'
      textareaRef.current.style.height = `${Math.min(textareaRef.current.scrollHeight, 200)}px`
    }
  }, [])

  return (
    <div className="border-t border-sapphire-800/40 bg-sapphire-950/60 backdrop-blur-sm p-4">
      <div className="max-w-3xl mx-auto">
        <div className="flex gap-3 items-end rounded-md border border-sapphire-700/40 bg-sapphire-900/60 p-1.5 transition-colors duration-180 focus-within:border-sapphire-500 focus-within:shadow-[0_0_0_3px_rgba(62,102,176,0.15)]">
          <textarea
            ref={textareaRef}
            value={input}
            onChange={(e) => setInput(e.target.value)}
            onInput={handleInput}
            onKeyDown={handleKeyDown}
            placeholder="Ask about the book..."
            disabled={disabled}
            rows={1}
            className="flex-1 resize-none bg-transparent px-3 py-2 font-sans text-sm text-sapphire-50 placeholder:text-ink-400 transition-colors duration-180 focus:outline-none disabled:opacity-40"
          />
          <Button
            size="icon"
            onClick={handleSend}
            disabled={disabled || !input.trim()}
            variant="primary"
            className="shrink-0 h-8 w-8"
          >
            {disabled ? (
              <Loader2 className="h-3.5 w-3.5 animate-spin" />
            ) : (
              <ArrowUp className="h-3.5 w-3.5" />
            )}
          </Button>
        </div>
        <p className="mt-2 text-center font-sans text-[11px] text-ink-500">
          Press <kbd className="font-mono text-ink-400">Enter</kbd> to send
          <span className="mx-1.5 text-ink-600">·</span>
          Shift+Enter for new line
        </p>
      </div>
    </div>
  )
}
