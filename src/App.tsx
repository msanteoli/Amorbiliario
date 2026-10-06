import { BrowserRouter, Routes, Route, Navigate } from 'react-router-dom'
import { Toaster } from '@/components/ui/toaster'
import { Toaster as Sonner } from '@/components/ui/sonner'
import { TooltipProvider } from '@/components/ui/tooltip'
import { AuthProvider } from '@/contexts/AuthContext'
import { ProtectedRoute, AdminRoute } from '@/components/ProtectedRoute'
import { AppLayout } from '@/components/AppLayout'
import { UnderConstructionPage } from '@/components/UnderConstructionPage'

import Login from '@/pages/Login'
import BuscarPage from '@/pages/BuscarPage'
import ImovelPublicoPage from '@/pages/ImovelPublicoPage'
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
import Agenda from '@/pages/Agenda'
import Admin from '@/pages/Admin'
import NotFound from '@/pages/NotFound'

const App = () => (
  <BrowserRouter>
    <AuthProvider>
      <TooltipProvider>
        <Toaster />
        <Sonner />
        <Routes>
          {/* Public login route */}
          <Route path="/login" element={<Login />} />

          {/* Public site routes (fora de ProtectedRoute e de AppLayout) */}
          <Route path="/buscar" element={<BuscarPage />} />
          <Route path="/buscar/:codigo" element={<ImovelPublicoPage />} />

          {/* Root route redirects to /hoje */}
          <Route path="/" element={<Navigate to="/hoje" replace />} />

          {/* Protected routes */}
          <Route element={<ProtectedRoute />}>
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
              <Route path="/agenda" element={<Agenda />} />

              {/* Admin-only route */}
              <Route element={<AdminRoute />}>
                <Route path="/admin" element={<Admin />} />
              </Route>
            </Route>
          </Route>

          {/* 404 route */}
          <Route path="*" element={<NotFound />} />
        </Routes>
      </TooltipProvider>
    </AuthProvider>
  </BrowserRouter>
)

export default App
