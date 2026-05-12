import { useEffect, useRef } from 'react'
import { SSEEvent } from '../types'

export function useSSE(url: string | null, onEvent: (e: SSEEvent) => void) {
  const esRef = useRef<EventSource | null>(null)

  useEffect(() => {
    if (!url) return
    const es = new EventSource(url)
    esRef.current = es

    es.onmessage = (e) => {
      try {
        const event: SSEEvent = JSON.parse(e.data)
        onEvent(event)
        if (event.type === 'complete' || event.type === 'error') {
          es.close()
        }
      } catch {
        // ignore parse errors
      }
    }

    es.onerror = () => {
      es.close()
    }

    return () => {
      es.close()
      esRef.current = null
    }
  }, [url])
}
