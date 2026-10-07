/* Toaster Component - A component that displays a toaster (a component that displays a toast) - from shadcn/ui (exposes Toaster) */
import './sonner.css'
import { useTheme } from 'next-themes'
import { Toaster as Sonner } from 'sonner'

type ToasterProps = React.ComponentProps<typeof Sonner>

const Toaster = ({ ...props }: ToasterProps) => {
  const { theme = 'system' } = useTheme()

  return (
    <Sonner
      theme={theme as ToasterProps['theme']}
      className="toaster group"
      toastOptions={{
        classNames: {
          toast:
            'group toast group-[.toaster]:bg-popover group-[.toaster]:text-popover-foreground group-[.toaster]:border-border group-[.toaster]:rounded-lg group-[.toaster]:shadow-none font-normal',
          description: 'group-[.toast]:text-muted-foreground font-normal',
          actionButton:
            'group-[.toast]:bg-primary group-[.toast]:text-primary-foreground rounded-full font-normal',
          cancelButton:
            'group-[.toast]:bg-secondary group-[.toast]:text-foreground rounded-full font-normal',
        },
      }}
      {...props}
    />
  )
}

export { Toaster }
