import { useNavigate } from 'react-router-dom'
import { useAuth } from '@/contexts/AuthContext'
import { Button } from '@/components/ui/button'
import { ShieldAlert } from 'lucide-react'

export function NoAccessScreen() {
  const { logout } = useAuth()
  const navigate = useNavigate()

  const handleLogout = () => {
    logout()
    navigate('/login', { replace: true })
  }

  return (
    <div className="flex min-h-screen flex-col items-center justify-center bg-background px-4 text-center">
      <div className="mx-auto flex max-w-md flex-col items-center gap-4">
        <div className="flex h-16 w-16 items-center justify-center rounded-full bg-destructive/10 text-destructive">
          <ShieldAlert className="h-8 w-8" />
        </div>
        <h1 className="text-2xl font-semibold tracking-tight text-foreground">
          Sem acesso. Fale com o administrador.
        </h1>
        <p className="text-sm text-muted-foreground">
          Seu usuário não possui um perfil habilitado para acessar os módulos do sistema.
        </p>
        <Button onClick={handleLogout} variant="outline" className="mt-2">
          Sair
        </Button>
      </div>
    </div>
  )
}
