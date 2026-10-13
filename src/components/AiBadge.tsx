import React from 'react'
import { cn } from '@/lib/utils'

export interface AiBadgeProps {
  className?: string
}

/**
 * Selo "IA · sugestão" da identidade visual Planta (Item 9).
 * IBM Plex Mono 500, 12 px, texto primary sobre accent, 4 px de raio,
 * com o símbolo da marca de 12 px antes (SVG do cômodo com porta aberta).
 * Sem brilho, varinha ou gradiente.
 */
export const AiBadge: React.FC<AiBadgeProps> = ({ className }) => {
  return (
    <span
      className={cn(
        'inline-flex items-center gap-1.5 px-2 py-0.5 rounded-[4px] bg-accent text-primary text-[12px] leading-[16px] font-medium tracking-tight select-none',
        className,
      )}
      style={{
        fontFamily: "'IBM Plex Mono', ui-monospace, monospace",
      }}
    >
      <svg
        viewBox="0 0 48 48"
        fill="none"
        className="w-3 h-3 shrink-0 text-primary"
        aria-hidden="true"
      >
        <path
          d="M22 42H6V6h36v36h-4"
          stroke="currentColor"
          strokeWidth="4"
          strokeLinecap="square"
        />
        <path d="M38 42V26" stroke="currentColor" strokeWidth="4" strokeLinecap="square" />
        <path d="M22 42a16 16 0 0 1 16-16" stroke="currentColor" strokeWidth="2" />
      </svg>
      <span>IA · sugestão</span>
    </span>
  )
}
