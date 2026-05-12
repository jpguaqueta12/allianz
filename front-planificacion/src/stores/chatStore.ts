import { create } from 'zustand'
import { ChatMessage, SSEEvent } from '../types'

interface ChatStore {
  sessionId: string | null
  messages: ChatMessage[]
  streaming: boolean
  streamingContent: string
  pendingToolCalls: { tool: string; input: Record<string, unknown>; output?: string }[]

  setSessionId: (id: string) => void
  addUserMessage: (content: string) => void
  startStreaming: () => void
  appendToken: (token: string) => void
  addToolCall: (tool: string, input: Record<string, unknown>) => void
  updateToolResult: (tool: string, output: string) => void
  finalizeAssistant: (full: string) => void
  handleError: (msg: string) => void
  reset: () => void
}

export const useChatStore = create<ChatStore>((set, get) => ({
  sessionId: null,
  messages: [],
  streaming: false,
  streamingContent: '',
  pendingToolCalls: [],

  setSessionId: (id) => set({ sessionId: id }),

  addUserMessage: (content) =>
    set((s) => ({
      messages: [...s.messages, { role: 'user', content, timestamp: new Date() }],
    })),

  startStreaming: () => set({ streaming: true, streamingContent: '', pendingToolCalls: [] }),

  appendToken: (token) =>
    set((s) => ({ streamingContent: s.streamingContent + token })),

  addToolCall: (tool, input) =>
    set((s) => ({
      pendingToolCalls: [...s.pendingToolCalls, { tool, input }],
    })),

  updateToolResult: (tool, output) =>
    set((s) => ({
      pendingToolCalls: s.pendingToolCalls.map((tc) =>
        tc.tool === tool && !tc.output ? { ...tc, output } : tc,
      ),
    })),

  finalizeAssistant: (full) =>
    set((s) => ({
      streaming: false,
      streamingContent: '',
      messages: [
        ...s.messages,
        {
          role: 'assistant',
          content: full,
          tool_calls: s.pendingToolCalls.map((tc) => ({
            tool: tc.tool,
            input: tc.input,
            output: tc.output ?? '',
          })),
          timestamp: new Date(),
        },
      ],
      pendingToolCalls: [],
    })),

  handleError: (msg) =>
    set((s) => ({
      streaming: false,
      streamingContent: '',
      messages: [
        ...s.messages,
        { role: 'assistant', content: `Error: ${msg}`, timestamp: new Date() },
      ],
    })),

  reset: () =>
    set({ sessionId: null, messages: [], streaming: false, streamingContent: '', pendingToolCalls: [] }),
}))
