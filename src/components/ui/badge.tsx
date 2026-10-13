/* Badge Component primitives - A component that displays a badge - from shadcn/ui (exposes Badge, badgeVariants) */
import * as React from 'react'
import { cva, type VariantProps } from 'class-variance-authority'

import { cn } from '@/lib/utils'

const badgeVariants = cva(
  'inline-flex items-center gap-1.5 h-6 rounded-full border px-2.5 font-sans text-xs font-medium bg-card transition-colors duration-150 ease-out focus:outline-none focus:ring-2 focus:ring-ring focus:ring-offset-2 focus:ring-offset-background',
  {
    variants: {
      variant: {
        default: 'border-line text-body',
        secondary: 'border-line text-body',
        outline: 'border-line text-body',
        destructive: 'border-destructive text-destructive',
        success: 'border-success text-success',
        attention: 'border-attention text-attention',
        info: 'border-info text-info',
      },
    },
    defaultVariants: {
      variant: 'default',
    },
  },
)

const dotColorByVariant: Record<string, string> = {
  default: 'bg-line',
  secondary: 'bg-line',
  outline: 'bg-line',
  destructive: 'bg-destructive',
  success: 'bg-success',
  attention: 'bg-attention',
  info: 'bg-info',
}

export interface BadgeProps
  extends React.HTMLAttributes<HTMLDivElement>, VariantProps<typeof badgeVariants> {
  hideDot?: boolean
}

function Badge({ className, variant, children, hideDot = false, ...props }: BadgeProps) {
  const currentVariant = variant || 'default'
  const dotColor = dotColorByVariant[String(currentVariant)] || 'bg-line'

  return (
    <div className={cn(badgeVariants({ variant }), className)} {...props}>
      {!hideDot && (
        <span className={cn('w-1.5 h-1.5 rounded-full shrink-0', dotColor)} aria-hidden="true" />
      )}
      <span className="truncate">{children}</span>
    </div>
  )
}

export { Badge, badgeVariants }
