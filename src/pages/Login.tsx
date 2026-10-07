import React, { useState } from 'react'
import { useNavigate, Navigate } from 'react-router-dom'
import { useAuth } from '@/contexts/AuthContext'
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card'
import { Input } from '@/components/ui/input'
import { Button } from '@/components/ui/button'
import { Label } from '@/components/ui/label'
import { Alert, AlertDescription } from '@/components/ui/alert'
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog'
import { requestPasswordReset } from '@/services/auth'
import { AlertCircle, Loader2, CheckCircle2 } from 'lucide-react'
import { ThemeToggle } from '@/components/ThemeToggle'

export default function Login() {
  const { login, isAuthenticated } = useAuth()
  const navigate = useNavigate()

  const [email, setEmail] = useState('')
  const [password, setPassword] = useState('')
  const [errorMessage, setErrorMessage] = useState<string | null>(null)
  const [isSubmitting, setIsSubmitting] = useState(false)

  // Modal Esqueci minha senha
  const [forgotModalOpen, setForgotModalOpen] = useState(false)
  const [forgotEmail, setForgotEmail] = useState('')
  const [forgotSubmitting, setForgotSubmitting] = useState(false)
  const [forgotSuccessMessage, setForgotSuccessMessage] = useState<string | null>(null)

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
    <div className="relative flex min-h-screen flex-col items-center justify-center bg-background p-4">
      <div className="absolute top-4 right-4">
        <ThemeToggle size="sm" />
      </div>

      <div className="w-full max-w-sm">
        <div className="mb-6 text-center">
          <div className="mx-auto mb-3 flex h-12 w-12 items-center justify-center rounded-lg bg-primary text-primary-foreground font-normal text-2xl">
            I
          </div>
          <h1 className="text-2xl font-normal tracking-tight text-foreground">Imobdigital</h1>
          <p className="text-sm text-muted-foreground mt-1">Sistema de gestão para imobiliárias</p>
        </div>

        <Card>
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
                <div className="flex items-center justify-between">
                  <Label htmlFor="password">Senha</Label>
                  <button
                    type="button"
                    onClick={() => {
                      setForgotEmail(email)
                      setForgotSuccessMessage(null)
                      setForgotModalOpen(true)
                    }}
                    className="text-xs text-primary hover:underline font-medium"
                  >
                    Esqueci minha senha
                  </button>
                </div>
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

      {/* Modal Esqueci minha senha */}
      <Dialog open={forgotModalOpen} onOpenChange={setForgotModalOpen}>
        <DialogContent className="sm:max-w-md">
          <DialogHeader>
            <DialogTitle>Recuperar senha</DialogTitle>
            <DialogDescription>
              Informe o e-mail da sua conta para receber o link de criação de uma nova senha.
            </DialogDescription>
          </DialogHeader>

          {forgotSuccessMessage ? (
            <div className="space-y-4 py-2">
              <Alert className="bg-emerald-50 text-emerald-900 border-emerald-300">
                <CheckCircle2 className="h-4 w-4 text-emerald-600" />
                <AlertDescription className="text-sm font-medium">
                  {forgotSuccessMessage}
                </AlertDescription>
              </Alert>

              <DialogFooter>
                <Button
                  type="button"
                  onClick={() => setForgotModalOpen(false)}
                  className="w-full sm:w-auto"
                >
                  Fechar
                </Button>
              </DialogFooter>
            </div>
          ) : (
            <form
              onSubmit={async (e) => {
                e.preventDefault()
                const trimmed = forgotEmail.trim().toLowerCase()
                if (!trimmed) return

                setForgotSubmitting(true)
                try {
                  await requestPasswordReset(trimmed)
                } catch {
                  // Independentemente do resultado, nunca revela se o e-mail existe
                } finally {
                  setForgotSubmitting(false)
                  setForgotSuccessMessage(
                    'Se o e-mail estiver cadastrado, enviamos um link para criar uma nova senha.',
                  )
                }
              }}
              className="space-y-4"
            >
              <div className="space-y-2">
                <Label htmlFor="forgot-email">E-mail cadastrado</Label>
                <Input
                  id="forgot-email"
                  type="email"
                  placeholder="seu@email.com"
                  required
                  value={forgotEmail}
                  onChange={(e) => setForgotEmail(e.target.value)}
                  disabled={forgotSubmitting}
                />
              </div>

              <DialogFooter className="gap-2 sm:gap-0">
                <Button
                  type="button"
                  variant="outline"
                  onClick={() => setForgotModalOpen(false)}
                  disabled={forgotSubmitting}
                >
                  Cancelar
                </Button>
                <Button type="submit" disabled={forgotSubmitting} className="gap-2">
                  {forgotSubmitting && <Loader2 className="h-4 w-4 animate-spin" />}
                  <span>Enviar link</span>
                </Button>
              </DialogFooter>
            </form>
          )}
        </DialogContent>
      </Dialog>
    </div>
  )
}
