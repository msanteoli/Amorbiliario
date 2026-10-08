import React from 'react'
import { useTheme, ThemePreference } from '@/contexts/ThemeContext'
import { cn } from '@/lib/utils'

interface ThemeToggleProps {
  className?: string
  size?: 'sm' | 'default'
  large?: boolean
}

export const ThemeToggle: React.FC<ThemeToggleProps> = ({
  className,
  size = 'default',
  large = false,
}) => {
  const { theme, setTheme } = useTheme()

  const options: { value: ThemePreference; label: string }[] = [
    { value: 'auto', label: 'Automático' },
    { value: 'light', label: 'Claro' },
    { value: 'dark', label: 'Escuro' },
  ]

  return (
    <div
      role="radiogroup"
      aria-label="Escolha do tema"
      className={cn(
        'inline-flex items-center rounded-full border border-line bg-secondary/80 p-0.5 gap-0.5',
        large && 'p-1',
        className,
      )}
    >
      {options.map((opt) => {
        const isSelected = theme === opt.value
        return (
          <button
            key={opt.value}
            type="button"
            role="radio"
            aria-checked={isSelected}
            onClick={() => setTheme(opt.value)}
            className={cn(
              'rounded-full font-normal transition-all duration-150 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2 focus-visible:ring-offset-background',
              large
                ? 'h-11 min-h-[44px] px-4 text-xs sm:text-sm inline-flex items-center justify-center'
                : size === 'sm'
                  ? 'px-2.5 py-1 text-xs'
                  : 'px-3 py-1.5 text-xs sm:text-sm',
              isSelected
                ? 'bg-primary text-primary-foreground font-normal shadow-none'
                : 'text-muted-foreground hover:text-foreground hover:bg-secondary',
            )}
          >
            {opt.label}
          </button>
        )
      })}
    </div>
  )
}
