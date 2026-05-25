import Link from 'next/link'
import { ArrowLeft, Key, Sliders } from 'lucide-react'
import { Button } from '@/components/ui/button'

export default function SettingsPage() {
  return (
    <div>
      <header className="border-b border-sapphire-800/40">
        <div className="flex h-14 items-center px-6 max-w-4xl mx-auto w-full gap-3">
          <Button variant="ghost" size="icon" asChild>
            <Link href="/">
              <ArrowLeft className="h-4 w-4" />
            </Link>
          </Button>
          <h1 className="font-sans font-medium text-sapphire-100">Settings</h1>
        </div>
      </header>

      <main className="max-w-4xl mx-auto px-6 py-12">
        <div className="grid gap-8">
          <section className="rounded-sm border border-sapphire-700/40 bg-sapphire-900/60 p-6">
            <div className="flex items-center gap-3 mb-6">
              <Sliders className="h-5 w-5 text-sapphire-300" />
              <h2 className="font-sans font-semibold text-sapphire-100">Retrieval</h2>
            </div>
            <div className="grid gap-4 sm:grid-cols-2">
              {[
                { label: 'Low-level entity search (top-k)', value: '12' },
                { label: 'Low-level neighbor depth', value: '1' },
                { label: 'Neighbors per entity', value: '8' },
                { label: 'Chunks per entity', value: '3' },
                { label: 'High-level theme search (top-k)', value: '5' },
                { label: 'Entities per theme', value: '5' },
                { label: 'Entity merge threshold', value: '0.92' },
                { label: 'Context token budget', value: '3000' },
              ].map((setting) => (
                <div
                  key={setting.label}
                  className="rounded-sm border border-sapphire-700/40 bg-sapphire-900/40 p-3"
                >
                  <p className="text-sm font-medium text-sapphire-100">{setting.label}</p>
                  <p className="text-sm font-mono tabular-nums text-ink-300 mt-0.5">
                    {setting.value}
                  </p>
                </div>
              ))}
            </div>
          </section>

          <section className="rounded-sm border border-sapphire-700/40 bg-sapphire-900/60 p-6">
            <div className="flex items-center gap-3 mb-6">
              <Key className="h-5 w-5 text-sapphire-300" />
              <h2 className="font-sans font-semibold text-sapphire-100">API Keys</h2>
            </div>
            <div className="space-y-3">
              {[
                'DEEPSEEK_API_KEY',
                'VOYAGE_API_KEY',
                'LLAMAPARSE_API_KEY',
                'DATABASE_URL',
              ].map((key) => (
                <div
                  key={key}
                  className="flex items-center justify-between rounded-sm border border-sapphire-700/40 bg-sapphire-900/40 p-3"
                >
                  <p className="text-sm font-medium font-mono text-sapphire-100">{key}</p>
                  <span className="inline-flex items-center rounded-sm border border-success-500/30 bg-success-500/10 px-2 py-0.5 text-xs font-medium text-success-500 font-mono">
                    Set
                  </span>
                </div>
              ))}
            </div>
          </section>
        </div>
      </main>
    </div>
  )
}
