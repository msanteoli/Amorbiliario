/* Badge Component primitives - A component that displays a badge - from shadcn/ui (exposes Badge, badgeVariants) */
import * as React from 'react'
import { cva, type VariantProps } from 'class-variance-authority'

import { cn } from '@/lib/utils'

const badgeVariants = cva(
  'inline-flex items-center rounded-full border px-2.5 py-0.5 font-mono text-[11px] font-normal uppercase tracking-[0.08em] transition-colors duration-150 ease-out focus:outline-none focus:ring-2 focus:ring-ring focus:ring-offset-2 focus:ring-offset-background bg-transparent',
  {
    variants: {
      variant: {
        default: 'border-border text-muted-foreground',
        secondary: 'border-border text-muted-foreground',
        outline: 'border-border text-foreground',
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

export interface BadgeProps
  extends React.HTMLAttributes<HTMLDivElement>, VariantProps<typeof badgeVariants> {}

function Badge({ className, variant, ...props }: BadgeProps) {
  return <div className={cn(badgeVariants({ variant }), className)} {...props} />
}

export { Badge, badgeVariants }
