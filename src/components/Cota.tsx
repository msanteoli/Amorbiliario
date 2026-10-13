import React from 'react'
import { cn } from '@/lib/utils'

export interface CotaProps {
  title: string
  count?: number | string | null
  isAttention?: boolean
  className?: string
  action?: React.ReactNode
}

/**
 * Cota: componente de cabeçalho técnico da identidade Planta.
 * Título da seção (20 px, 600) à esquerda, um traço horizontal de 1 px em line
 * com batentes verticais de 9 px nas duas pontas ocupando o espaço do meio,
 * e o número à direita em .dado 500 (em attention quando for atraso).
 * Bloco sem número usa só o título.
 */
export const Cota: React.FC<CotaProps> = ({
  title,
  count,
  isAttention = false,
  className,
  action,
}) => {
  const hasCount = count !== undefined && count !== null

  return (
    <div className={cn('flex items-center gap-3 w-full py-1', className)}>
      <h2 className="text-[20px] leading-[28px] font-semibold text-foreground tracking-[-0.01em] shrink-0">
        {title}
      </h2>

      {hasCount ? (
        <>
          {/* Linha de cota com batentes verticais de 9px nas duas pontas */}
          <div className="relative flex-1 flex items-center min-w-[24px]" aria-hidden="true">
            <span className="w-px h-[9px] bg-line shrink-0" />
            <span className="flex-1 h-px bg-line" />
            <span className="w-px h-[9px] bg-line shrink-0" />
          </div>

          <span
            className={cn('numero shrink-0', isAttention ? 'text-attention' : 'text-foreground')}
          >
            {count}
          </span>
        </>
      ) : null}

      {action && <div className="shrink-0 ml-1">{action}</div>}
    </div>
  )
}
