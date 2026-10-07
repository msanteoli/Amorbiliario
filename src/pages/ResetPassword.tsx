import React, { useState } from 'react'
import { useSearchParams, useNavigate, Link } from 'react-router-dom'
import { confirmPasswordReset } from '@/services/auth'
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card'
import { Input } from '@/components/ui/input'
import { Button } from '@/components/ui/button'
import { Label } from '@/components/ui/label'
import { Alert, AlertDescription } from '@/components/ui/alert'
import { AlertCircle, CheckCircle2, Loader2, ArrowRight } from 'lucide-react'

export default function ResetPassword() {
  const [searchParams] = useSearchParams()
  const navigate = useNavigate()

  const token = searchParams.get('token') || ''

  const [password, setPassword] = useState('')
  const [passwordConfirm, setPasswordConfirm] = useState('')
  const [errorMessage, setErrorMessage] = useState<string | null>(null)
  const [success, setSuccess] = useState(false)
  const [isSubmitting, setIsSubmitting] = useState(false)

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault()
    setErrorMessage(null)

    if (!token) {
      setErrorMessage(
        "Este link não vale mais. Peça um novo ao administrador ou use 'Esqueci minha senha' no login.",
      )
      return
    }

    // Validações sem chamar o servidor
    if (password.length < 8) {
      setErrorMessage('A nova senha deve ter no mínimo 8 caracteres.')
      return
    }

    if (password !== passwordConfirm) {
      setErrorMessage('As senhas digitadas não são iguais.')
      return
    }

    setIsSubmitting(true)
    try {
      await confirmPasswordReset(token, password, passwordConfirm)
      setSuccess(true)
    } catch {
      setErrorMessage(
        "Este link não vale mais. Peça um novo ao administrador ou use 'Esqueci minha senha' no login.",
      )
    } finally {
      setIsSubmitting(false)
    }
  }

  return (
    <div className="flex min-h-screen flex-col items-center justify-center bg-muted/40 p-4">
      <div className="w-full max-w-sm">
        <div className="mb-6 text-center">
          <div className="mx-auto mb-2 flex h-12 w-12 items-center justify-center rounded-lg bg-primary text-primary-foreground font-normal text-2xl">
            I
          </div>
          <h1 className="text-2xl font-normal tracking-tight text-foreground">Imobdigital</h1>
          <p className="text-sm text-muted-foreground">Redefinição de senha</p>
        </div>

        <Card>
          <CardHeader className="space-y-1">
            <CardTitle className="text-xl">Crie sua senha</CardTitle>
            <CardDescription>
              {success
                ? 'Sua senha foi redefinida com sucesso.'
                : 'Defina a nova senha para acessar sua conta no sistema.'}
            </CardDescription>
          </CardHeader>
          <CardContent>
            {success ? (
              <div className="space-y-4">
                <Alert className="bg-emerald-50 text-emerald-900 border-emerald-300 py-3">
                  <CheckCircle2 className="h-4 w-4 text-emerald-600" />
                  <AlertDescription className="text-sm font-medium">
                    Senha criada. Agora é só entrar.
                  </AlertDescription>
                </Alert>

                <Button
                  onClick={() => navigate('/login', { replace: true })}
                  className="w-full gap-2"
                >
                  <span>Ir para o login</span>
                  <ArrowRight className="h-4 w-4" />
                </Button>
              </div>
            ) : (
              <form onSubmit={handleSubmit} className="space-y-4">
                {errorMessage && (
                  <Alert variant="destructive" className="py-2.5">
                    <AlertCircle className="h-4 w-4" />
                    <AlertDescription className="text-sm font-medium">
                      {errorMessage}
                    </AlertDescription>
                  </Alert>
                )}

                {!token && (
                  <Alert variant="destructive" className="py-2.5">
                    <AlertCircle className="h-4 w-4" />
                    <AlertDescription className="text-sm font-medium">
                      Este link não vale mais. Peça um novo ao administrador ou use 'Esqueci minha
                      senha' no login.
                    </AlertDescription>
                  </Alert>
                )}

                <div className="space-y-2">
                  <Label htmlFor="password">Nova senha</Label>
                  <Input
                    id="password"
                    type="password"
                    placeholder="Mínimo de 8 caracteres"
                    autoComplete="new-password"
                    required
                    value={password}
                    onChange={(e) => setPassword(e.target.value)}
                    disabled={isSubmitting || !token}
                  />
                </div>

                <div className="space-y-2">
                  <Label htmlFor="password-confirm">Repita a nova senha</Label>
                  <Input
                    id="password-confirm"
                    type="password"
                    placeholder="Repita a senha digitada"
                    autoComplete="new-password"
                    required
                    value={passwordConfirm}
                    onChange={(e) => setPasswordConfirm(e.target.value)}
                    disabled={isSubmitting || !token}
                  />
                </div>

                <Button type="submit" className="w-full" disabled={isSubmitting || !token}>
                  {isSubmitting ? (
                    <>
                      <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                      Salvando senha...
                    </>
                  ) : (
                    'Salvar senha'
                  )}
                </Button>

                <div className="text-center pt-2">
                  <Link
                    to="/login"
                    className="text-xs text-muted-foreground hover:text-foreground underline underline-offset-4"
                  >
                    Voltar para o login
                  </Link>
                </div>
              </form>
            )}
          </CardContent>
        </Card>
      </div>
    </div>
  )
}
