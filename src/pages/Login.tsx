import React, { useState } from 'react'
import { useNavigate, Navigate } from 'react-router-dom'
import { useAuth } from '@/contexts/AuthContext'
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card'
import { Input } from '@/components/ui/input'
import { Button } from '@/components/ui/button'
import { Label } from '@/components/ui/label'
import { Alert, AlertDescription } from '@/components/ui/alert'
import { AlertCircle, Loader2 } from 'lucide-react'

export default function Login() {
  const { login, isAuthenticated } = useAuth()
  const navigate = useNavigate()

  const [email, setEmail] = useState('')
  const [password, setPassword] = useState('')
  const [errorMessage, setErrorMessage] = useState<string | null>(null)
  const [isSubmitting, setIsSubmitting] = useState(false)

  // Redirect if already authenticated
  if (isAuthenticated) {
    return <Navigate to="/hoje" replace />
  }

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault()
    setErrorMessage(null)

    // Specification: Normalize email (trim spaces and convert to lowercase)
    const normalizedEmail = email.trim().toLowerCase()

    if (!normalizedEmail || !password) {
      setErrorMessage('E-mail ou senha incorretos.')
      return
    }

    setIsSubmitting(true)

    try {
      await login(normalizedEmail, password)
      navigate('/hoje', { replace: true })
    } catch (error: unknown) {
      // Check if server response says inactive account
      // "Se o servidor responder "Conta inativa. Fale com o administrador.", mostre essa frase."
      const inactivePhrase = 'Conta inativa. Fale com o administrador.'
      let isInactive = false

      if (error && typeof error === 'object') {
        const anyErr = error as {
          message?: string
          response?: { message?: string; data?: Record<string, unknown> }
        }

        const msg = anyErr.message || ''
        const respMsg = anyErr.response?.message || ''
        const respDataStr = anyErr.response?.data ? JSON.stringify(anyErr.response.data) : ''

        if (
          msg.includes(inactivePhrase) ||
          respMsg.includes(inactivePhrase) ||
          respDataStr.includes(inactivePhrase)
        ) {
          isInactive = true
        }
      }

      if (isInactive) {
        setErrorMessage(inactivePhrase)
      } else {
        // Specification: "Em qualquer falha de login, mostre exatamente "E-mail ou senha incorretos." (a mesma frase para e-mail inexistente e senha errada)."
        setErrorMessage('E-mail ou senha incorretos.')
      }
    } finally {
      setIsSubmitting(false)
    }
  }

  return (
    <div className="flex min-h-screen flex-col items-center justify-center bg-muted/40 p-4">
      <div className="w-full max-w-sm">
        <div className="mb-6 text-center">
          <div className="mx-auto mb-2 flex h-12 w-12 items-center justify-center rounded-xl bg-primary text-primary-foreground font-bold text-2xl shadow-sm">
            I
          </div>
          <h1 className="text-2xl font-bold tracking-tight text-foreground">Imobdigital</h1>
          <p className="text-sm text-muted-foreground">Sistema de gestão para imobiliárias</p>
        </div>

        <Card className="shadow-md">
          <CardHeader className="space-y-1">
            <CardTitle className="text-xl">Acessar conta</CardTitle>
            <CardDescription>Informe seu e-mail e senha para entrar no sistema.</CardDescription>
          </CardHeader>
          <CardContent>
            <form onSubmit={handleSubmit} className="space-y-4">
              {errorMessage && (
                <Alert variant="destructive" className="py-2.5">
                  <AlertCircle className="h-4 w-4" />
                  <AlertDescription className="text-sm font-medium">
                    {errorMessage}
                  </AlertDescription>
                </Alert>
              )}

              <div className="space-y-2">
                <Label htmlFor="email">E-mail</Label>
                <Input
                  id="email"
                  type="email"
                  placeholder="seu@email.com"
                  autoComplete="email"
                  required
                  value={email}
                  onChange={(e) => setEmail(e.target.value)}
                  disabled={isSubmitting}
                />
              </div>

              <div className="space-y-2">
                <Label htmlFor="password">Senha</Label>
                <Input
                  id="password"
                  type="password"
                  placeholder="••••••••"
                  autoComplete="current-password"
                  required
                  value={password}
                  onChange={(e) => setPassword(e.target.value)}
                  disabled={isSubmitting}
                />
              </div>

              <Button type="submit" className="w-full" disabled={isSubmitting}>
                {isSubmitting ? (
                  <>
                    <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                    Entrando...
                  </>
                ) : (
                  'Entrar'
                )}
              </Button>
            </form>
          </CardContent>
        </Card>
      </div>
    </div>
  )
}
