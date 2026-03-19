import { useState } from 'react'
import { Copy, Check } from 'lucide-react'

export function CopyableCode({ value }: { value: string }) {
  const [copied, setCopied] = useState(false)

  const copy = async () => {
    await navigator.clipboard.writeText(value)
    setCopied(true)
    setTimeout(() => setCopied(false), 2000)
  }

  return (
    <div className="flex items-center gap-2 rounded-lg bg-gray-900 px-4 py-3">
      <code className="flex-1 break-all font-mono text-sm text-green-400">{value}</code>
      <button
        onClick={copy}
        className="shrink-0 rounded p-1 text-gray-400 hover:text-white transition-colors"
        title="Copy to clipboard"
      >
        {copied ? <Check size={16} className="text-green-400" /> : <Copy size={16} />}
      </button>
    </div>
  )
}
