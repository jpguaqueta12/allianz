import { Loader2 } from 'lucide-react'

interface Props {
  tool: string
  input: Record<string, unknown>
  output?: string
}

export function ToolCallCard({ tool, input, output }: Props) {
  void tool
  void input
  const label = output ? 'Información consultada' : 'Consultando información'

  return (
    <div className="flex justify-start">
      <div className="max-w-[78%] rounded-md border border-corporate-line bg-white px-4 py-2 text-xs shadow-sm">
        <div className="flex items-center gap-2 font-medium text-corporate-muted">
          <Loader2 size={12} className={output ? 'text-green-600' : 'animate-spin text-allianz-blue'} />
          <span>{label}</span>
        </div>
      </div>
    </div>
  )
}
