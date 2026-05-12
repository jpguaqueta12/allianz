import { ChatMessage } from '../../types'
import clsx from 'clsx'
import { Bot, User } from 'lucide-react'

interface Props { message: ChatMessage; streaming?: boolean; streamContent?: string }

export function MessageBubble({ message, streaming, streamContent }: Props) {
  const isUser = message.role === 'user'
  const content = streaming ? streamContent ?? '' : message.content

  return (
    <div className={clsx('flex gap-3', isUser ? 'justify-end' : 'justify-start')}>
      {!isUser && (
        <div className="flex h-8 w-8 flex-shrink-0 items-center justify-center rounded-md bg-allianz-blue text-white">
          <Bot size={16} />
        </div>
      )}
      <div className={clsx('max-w-[78%] space-y-2')}>
        {/* Bubble */}
        <div className={clsx(
          'rounded-md px-4 py-3 text-sm leading-relaxed whitespace-pre-wrap shadow-sm',
          isUser
            ? 'bg-allianz-blue text-white'
            : 'border border-corporate-line bg-white text-corporate-ink'
        )}>
          {content}
          {streaming && <span className="inline-block w-1 h-4 bg-allianz-blue ml-0.5 animate-pulse" />}
        </div>

        <p className="px-1 text-xs text-corporate-muted">
          {message.timestamp.toLocaleTimeString('es-CO', { hour: '2-digit', minute: '2-digit' })}
        </p>
      </div>

      {isUser && (
        <div className="flex h-8 w-8 flex-shrink-0 items-center justify-center rounded-md bg-corporate-line text-corporate-muted">
          <User size={15} />
        </div>
      )}
    </div>
  )
}
