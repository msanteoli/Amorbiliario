import React, { createContext, useContext, useEffect, useState, useCallback } from 'react'
import pb from '@/lib/pocketbase/client'
import { RecordModel } from 'pocketbase'

export type UserRole = 'admin' | 'sdr' | 'corretor' | 'agente' | 'outro' | string

export interface AuthUser extends RecordModel {
  name?: string
  role?: UserRole
  organization_id?: string
  active?: boolean
  email?: string
}

interface AuthContextType {
  user: AuthUser | null
  token: string | null
  isAuthenticated: boolean
  isLoading: boolean
  login: (email: string, password: string) => Promise<void>
  logout: () => void
}

const AuthContext = createContext<AuthContextType | undefined>(undefined)

export function AuthProvider({ children }: { children: React.ReactNode }) {
  const [user, setUser] = useState<AuthUser | null>(() => {
    return (pb.authStore.record as AuthUser | null) ?? null
  })
  const [token, setToken] = useState<string | null>(() => {
    return pb.authStore.token || null
  })
  const [isLoading, setIsLoading] = useState<boolean>(true)

  useEffect(() => {
    const unsub = pb.authStore.onChange((newToken, newModel) => {
      setToken(newToken || null)
      setUser((newModel as AuthUser | null) ?? null)
    })

    // Validate current token if present
    if (pb.authStore.isValid && pb.authStore.token) {
      pb.collection('users')
        .authRefresh()
        .then((res) => {
          setUser((res.record as AuthUser | null) ?? null)
          setToken(res.token)
        })
        .catch(() => {
          pb.authStore.clear()
          setUser(null)
          setToken(null)
        })
        .finally(() => {
          setIsLoading(false)
        })
    } else {
      pb.authStore.clear()
      setUser(null)
      setToken(null)
      setIsLoading(false)
    }

    return () => {
      unsub()
    }
  }, [])

  const login = useCallback(async (email: string, password: string) => {
    const res = await pb.collection('users').authWithPassword<AuthUser>(email, password)
    setUser(res.record)
    setToken(res.token)
  }, [])

  const logout = useCallback(() => {
    pb.authStore.clear()
    setUser(null)
    setToken(null)
  }, [])

  // Strict requirement: isAuthenticated depends on pb.authStore.isValid and valid token
  const isAuthenticated = Boolean(token && pb.authStore.isValid)

  return (
    <AuthContext.Provider
      value={{
        user,
        token,
        isAuthenticated,
        isLoading,
        login,
        logout,
      }}
    >
      {children}
    </AuthContext.Provider>
  )
}

export function useAuth() {
  const context = useContext(AuthContext)
  if (!context) {
    throw new Error('useAuth must be used within an AuthProvider')
  }
  return context
}
