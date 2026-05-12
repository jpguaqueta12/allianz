import { useEffect, useRef, useState } from 'react'
import { Send, Loader2, Bot, Sparkles } from 'lucide-react'
import { useChatStore } from '../../stores/chatStore'
import { useDashboardStore } from '../../stores/dashboardStore'
import { MessageBubble } from './MessageBubble'
import { ToolCallCard } from './ToolCallCard'
import { useSSE } from '../../hooks/useSSE'
import { startChat } from '../../services/api'
import { SSEEvent } from '../../types'
import { PageHeader, StatusBadge } from '../ui/Corporate'

const SUGGESTIONS = [
  'Dame un resumen operativo de Mejora Continua y Fábrica',
  '¿Qué tickets tienen alertas rojas o amarillas?',
  '¿Quién está sobrecargado en el PI activo?',
  'Muestra los tickets planificados de Fábrica',
  'Busca el detalle del ticket IBLCDM-22569',
]

export function ChatPanel() {
  const { data: dashData } = useDashboardStore()
  const piNombre = dashData?.pi_activo?.nombre ?? 'Planificador'

  const {
    sessionId, messages, streaming, streamingContent, pendingToolCalls,
    addUserMessage, startStreaming, appendToken, addToolCall, updateToolResult,
    finalizeAssistant, handleError,
  } = useChatStore()

  const [input, setInput] = useState('')
  const [streamUrl, setStreamUrl] = useState<string | null>(null)
  const bottomRef = useRef<HTMLDivElement>(null)

  useEffect(() => {
    bottomRef.current?.scrollIntoView({ behavior: 'smooth' })
  }, [messages, streamingContent, pendingToolCalls])

  useSSE(streamUrl, (event: SSEEvent) => {
    if (event.type === 'token' && event.content) {
      appendToken(event.content)
    } else if (event.type === 'tool_start' && event.tool) {
      addToolCall(event.tool, event.input ?? {})
    } else if (event.type === 'tool_end' && event.tool && event.output) {
      updateToolResult(event.tool, event.output)
    } else if (event.type === 'complete') {
      finalizeAssistant(event.full_response ?? streamingContent)
      setStreamUrl(null)
    } else if (event.type === 'error') {
      handleError(event.message ?? 'Error desconocido')
      setStreamUrl(null)
    }
  })

  const send = async (text?: string) => {
    const msg = text ?? input.trim()
    if (!msg || !sessionId || streaming) return
    setInput('')
    addUserMessage(msg)
    startStreaming()
    try {
      const resp = await startChat(sessionId, msg)
      setStreamUrl(resp.stream_url)
    } catch (e) {
      handleError('Error al conectar con el agente')
    }
  }

  return (
    <div className="flex h-full flex-col bg-corporate-surface">
      <PageHeader
        title={`Planificador Allianz ${piNombre}`}
        subtitle="Desarrollado por NTT DATA para gestión operativa de backlog, capacidad, riesgos y acciones pendientes"
        meta={(
          <>
            <StatusBadge tone="green">Sesión activa</StatusBadge>
            <StatusBadge>Datos en vivo</StatusBadge>
          </>
        )}
      />

      <div className="flex-1 overflow-y-auto p-5">
        <div className="mx-auto max-w-5xl space-y-4">
        {messages.length === 0 && !streaming && (
          <div className="flex min-h-[520px] flex-col items-center justify-center gap-6 text-center">
            <div className="flex max-w-lg flex-col items-center">
              <div className="mb-4 flex h-12 w-12 items-center justify-center rounded-md border border-blue-100 bg-blue-50 text-allianz-blue">
                <Bot size={24} />
              </div>
              <h2 className="text-lg font-semibold text-corporate-ink">Planificador Allianz {piNombre}</h2>
              <p className="mt-2 text-sm text-corporate-muted">Consulta el estado del PI, valida riesgos y prepara cambios con aprobación explícita.</p>
            </div>
            <div className="grid w-full max-w-2xl grid-cols-1 gap-2 md:grid-cols-2">
              {SUGGESTIONS.map((s) => (
                <button
                  key={s}
                  onClick={() => send(s)}
                  className="flex items-start gap-2 rounded-md border border-corporate-line bg-white px-4 py-3 text-left text-sm text-corporate-ink transition-colors hover:border-allianz-blue hover:bg-blue-50"
                >
                  <Sparkles size={14} className="mt-0.5 flex-shrink-0 text-allianz-blue" />
                  {s}
                </button>
              ))}
            </div>
          </div>
        )}

        {messages.map((m, i) => (
          <MessageBubble key={i} message={m} />
        ))}

        {/* Live tool calls */}
        {streaming && pendingToolCalls.map((tc, i) => (
          <ToolCallCard key={i} tool={tc.tool} input={tc.input} output={tc.output} />
        ))}

        {/* Streaming response */}
        {streaming && streamingContent && (
          <MessageBubble
            message={{ role: 'assistant', content: '', timestamp: new Date() }}
            streaming
            streamContent={streamingContent}
          />
        )}

        {streaming && !streamingContent && pendingToolCalls.length === 0 && (
          <div className="flex gap-3">
            <div className="flex h-8 w-8 items-center justify-center rounded-md bg-allianz-blue text-sm font-bold text-white">AI</div>
            <div className="flex items-center gap-2 rounded-md border border-corporate-line bg-white px-4 py-3">
              <Loader2 size={16} className="animate-spin text-allianz-blue" />
              <span className="text-sm text-corporate-muted">Procesando solicitud</span>
            </div>
          </div>
        )}

        <div ref={bottomRef} />
        </div>
      </div>

      <div className="border-t border-corporate-line bg-white p-4">
        <div className="mx-auto flex max-w-5xl items-end gap-2">
          <textarea
            className="max-h-32 min-h-[48px] flex-1 resize-none rounded-md border border-corporate-line px-4 py-3 text-sm focus:border-allianz-blue focus:outline-none focus:ring-2 focus:ring-allianz-blue/20"
            placeholder={`Escribe tu consulta sobre el ${piNombre}...`}
            value={input}
            onChange={(e) => setInput(e.target.value)}
            onKeyDown={(e) => {
              if (e.key === 'Enter' && !e.shiftKey) {
                e.preventDefault()
                send()
              }
            }}
            rows={1}
            disabled={streaming}
          />
          <button
            onClick={() => send()}
            disabled={!input.trim() || streaming || !sessionId}
            className="flex h-12 items-center gap-2 rounded-md bg-allianz-blue px-4 text-white transition-colors hover:bg-allianz-light disabled:cursor-not-allowed disabled:opacity-40"
            aria-label="Enviar mensaje"
          >
            {streaming ? <Loader2 size={18} className="animate-spin" /> : <Send size={18} />}
          </button>
        </div>
      </div>
    </div>
  )
}
