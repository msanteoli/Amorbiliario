import React from 'react'

export interface EnterProps<T extends React.ElementType = 'div'> {
  as?: T
  step?: number // 0 a 5; valores maiores que 5 são limitados a 5
  small?: boolean
  className?: string
  children?: React.ReactNode
  style?: React.CSSProperties
}

/**
 * Componente auxiliar para entrada de blocos em cascata no site público.
 * Aplica as classes CSS .pub-enter ou .pub-enter-sm e define a variável CSS --pub-i.
 */
export function Enter<T extends React.ElementType = 'div'>({
  as,
  step = 0,
  small = false,
  className = '',
  children,
  style,
  ...rest
}: EnterProps<T> & Omit<React.ComponentPropsWithoutRef<T>, keyof EnterProps<T>>) {
  const Component = as || 'div'
  const clampedStep = Math.min(Math.max(Math.floor(step), 0), 5)
  const animClass = small ? 'pub-enter-sm' : 'pub-enter'

  const combinedStyle: React.CSSProperties = {
    ...style,
    // Define a variável CSS inline para controlar o atraso do stagger
    ['--pub-i' as string]: clampedStep,
  }

  const combinedClassName = [animClass, className].filter(Boolean).join(' ')

  return (
    <Component className={combinedClassName} style={combinedStyle} {...rest}>
      {children}
    </Component>
  )
}

export default Enter
