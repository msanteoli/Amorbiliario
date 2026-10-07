import React, { createContext, useContext, useEffect, useState } from 'react'

export type ThemePreference = 'auto' | 'light' | 'dark'
export type ResolvedTheme = 'light' | 'dark'

interface ThemeContextValue {
  theme: ThemePreference
  resolvedTheme: ResolvedTheme
  setTheme: (theme: ThemePreference) => void
}

const STORAGE_KEY = 'imobdigital-theme'

const ThemeContext = createContext<ThemeContextValue | undefined>(undefined)

function getStoredTheme(): ThemePreference {
  try {
    const item = localStorage.getItem(STORAGE_KEY)
    if (item === 'light' || item === 'dark' || item === 'auto') {
      return item
    }
  } catch {
    // localStorage bloqueado ou indisponível
  }
  return 'auto'
}

function getSystemTheme(): ResolvedTheme {
  if (
    typeof window !== 'undefined' &&
    window.matchMedia &&
    window.matchMedia('(prefers-color-scheme: dark)').matches
  ) {
    return 'dark'
  }
  return 'light'
}

export const ThemeProvider: React.FC<{ children: React.ReactNode }> = ({ children }) => {
  const [theme, setThemeState] = useState<ThemePreference>(() => getStoredTheme())
  const [resolvedTheme, setResolvedTheme] = useState<ResolvedTheme>(() => {
    const pref = getStoredTheme()
    return pref === 'auto' ? getSystemTheme() : pref
  })

  // Sincroniza e aplica a classe no elemento <html>
  useEffect(() => {
    const root = document.documentElement

    const applyTheme = () => {
      let active: ResolvedTheme = 'light'
      if (theme === 'auto') {
        active = getSystemTheme()
      } else {
        active = theme
      }

      setResolvedTheme(active)
      if (active === 'dark') {
        root.classList.add('dark')
      } else {
        root.classList.remove('dark')
      }
    }

    applyTheme()

    // Se estiver em 'auto', reagir quando o aparelho/sistema operacional mudar
    if (theme === 'auto') {
      const mediaQuery = window.matchMedia('(prefers-color-scheme: dark)')
      const handleChange = () => applyTheme()

      if (mediaQuery.addEventListener) {
        mediaQuery.addEventListener('change', handleChange)
        return () => mediaQuery.removeEventListener('change', handleChange)
      } else if (mediaQuery.addListener) {
        mediaQuery.addListener(handleChange)
        return () => mediaQuery.removeListener(handleChange)
      }
    }
  }, [theme])

  const setTheme = (newTheme: ThemePreference) => {
    setThemeState(newTheme)
    try {
      localStorage.setItem(STORAGE_KEY, newTheme)
    } catch {
      // Bloqueio de armazenamento
    }
  }

  return (
    <ThemeContext.Provider value={{ theme, resolvedTheme, setTheme }}>
      {children}
    </ThemeContext.Provider>
  )
}

export function useTheme() {
  const context = useContext(ThemeContext)
  if (!context) {
    throw new Error('useTheme deve ser usado dentro de um ThemeProvider')
  }
  return context
}
