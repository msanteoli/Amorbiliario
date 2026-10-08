import React from 'react'
import { MessageCircle } from 'lucide-react'

interface FloatingWhatsAppButtonProps {
  className?: string
}

export const FloatingWhatsAppButton: React.FC<FloatingWhatsAppButtonProps> = ({
  className = '',
}) => {
  // Ligar ao WhatsApp da imobiliária quando o número estiver cadastrado
  return (
    <button
      type="button"
      aria-label="Falar no WhatsApp"
      aria-disabled="true"
      title="Em breve"
      onClick={(e) => {
        // Por enquanto não faz nada: sem link, sem abrir janela, sem formulário, sem cadastro e sem evento de rastreamento
        e.preventDefault()
      }}
      className={`fixed right-4 bottom-4 z-40 w-14 h-14 rounded-full bg-primary text-primary-foreground flex items-center justify-center shadow-[0_6px_16px_rgba(0,0,0,0.12)] dark:shadow-none dark:border dark:border-border transition-transform hover:scale-105 active:scale-95 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2 focus-visible:ring-offset-background cursor-pointer ${className}`}
    >
      <MessageCircle className="h-7 w-7" aria-hidden="true" />
    </button>
  )
}
