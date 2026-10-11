import { BrowserRouter, Routes, Route, Navigate } from 'react-router-dom'
import { Toaster } from '@/components/ui/toaster'
import { Toaster as Sonner } from '@/components/ui/sonner'
import { TooltipProvider } from '@/components/ui/tooltip'
import { ThemeProvider } from '@/contexts/ThemeContext'
import { AuthProvider } from '@/contexts/AuthContext'
import { ProtectedRoute, AdminRoute, BackupRoute } from '@/components/ProtectedRoute'
import { AppLayout } from '@/components/AppLayout'

import Login from '@/pages/Login'
import ResetPassword from '@/pages/ResetPassword'
import BuscarPage from '@/pages/BuscarPage'
import ImovelPublicoPage from '@/pages/ImovelPublicoPage'
import Privacidade from '@/pages/Privacidade'
import GoogleRetorno from '@/pages/GoogleRetorno'
import Hoje from '@/pages/Hoje'
import Leads from '@/pages/Leads'
import NovoLead from '@/pages/NovoLead'
import LeadDetalhe from '@/pages/LeadDetalhe'
import Clientes from '@/pages/Clientes'
import NovoCliente from '@/pages/NovoCliente'
import ClienteDetalhe from '@/pages/ClienteDetalhe'
import EditarCliente from '@/pages/EditarCliente'
import Imoveis from '@/pages/Imoveis'
import NovoImovel from '@/pages/NovoImovel'
import ImovelDetalhe from '@/pages/ImovelDetalhe'
import EditarImovel from '@/pages/EditarImovel'
import Condominios from '@/pages/Condominios'
import CondominioDetalhe from '@/pages/CondominioDetalhe'
import Agenda from '@/pages/Agenda'
import Backup from '@/pages/Backup'
import Admin from '@/pages/Admin'
import ImportarImoveis from '@/pages/ImportarImoveis'
import Portais from '@/pages/Portais'
import NotFound from '@/pages/NotFound'

const App = () => (
  <BrowserRouter>
    <ThemeProvider>
      <AuthProvider>
        <TooltipProvider>
          <Toaster />
          <Sonner />
          <Routes>
            {/* Public login & reset password routes */}
            <Route path="/login" element={<Login />} />
            <Route path="/reset-password" element={<ResetPassword />} />

            {/* Public site routes (fora de ProtectedRoute e de AppLayout) */}
            <Route path="/buscar" element={<BuscarPage />} />
            <Route path="/buscar/:codigo" element={<ImovelPublicoPage />} />
            <Route path="/privacidade" element={<Privacidade />} />

            {/* Root route: responde na mesma página inicial pública (/ e /buscar) */}
            <Route path="/" element={<BuscarPage />} />

            {/* Protected routes */}
            <Route element={<ProtectedRoute />}>
              {/* Rota de retorno da conexão Google (sem AppLayout, página limpa focada na autorização) */}
              <Route path="/google/retorno" element={<GoogleRetorno />} />

              <Route element={<AppLayout />}>
                <Route path="/hoje" element={<Hoje />} />
                <Route path="/leads" element={<Leads />} />
                <Route path="/leads/novo" element={<NovoLead />} />
                <Route path="/leads/:id" element={<LeadDetalhe />} />
                <Route path="/clientes" element={<Clientes />} />
                <Route path="/clientes/novo" element={<NovoCliente />} />
                <Route path="/clientes/:id" element={<ClienteDetalhe />} />
                <Route path="/clientes/:id/editar" element={<EditarCliente />} />
                <Route path="/imoveis" element={<Imoveis />} />
                <Route path="/imoveis/novo" element={<NovoImovel />} />
                <Route path="/imoveis/:id" element={<ImovelDetalhe />} />
                <Route path="/imoveis/:id/editar" element={<EditarImovel />} />
                <Route path="/condominios" element={<Condominios />} />
                <Route path="/condominios/:id" element={<CondominioDetalhe />} />
                <Route path="/agenda" element={<Agenda />} />
                {/* Backup: Admin & SDR route */}
                <Route element={<BackupRoute />}>
                  <Route path="/backup" element={<Backup />} />
                </Route>
                {/* Admin-only route */}
                <Route element={<AdminRoute />}>
                  <Route path="/admin" element={<Admin />} />
                  <Route path="/admin/importar-imoveis" element={<ImportarImoveis />} />
                  <Route path="/portais" element={<Portais />} />
                </Route>
              </Route>
            </Route>

            {/* 404 route */}
            <Route path="*" element={<NotFound />} />
          </Routes>
        </TooltipProvider>
      </AuthProvider>
    </ThemeProvider>
  </BrowserRouter>
)

export default App
