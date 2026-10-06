import { BrowserRouter, Routes, Route, Navigate } from 'react-router-dom'
import { Toaster } from '@/components/ui/toaster'
import { Toaster as Sonner } from '@/components/ui/sonner'
import { TooltipProvider } from '@/components/ui/tooltip'
import { AuthProvider } from '@/contexts/AuthContext'
import { ProtectedRoute, AdminRoute } from '@/components/ProtectedRoute'
import { AppLayout } from '@/components/AppLayout'

import Login from '@/pages/Login'
import Hoje from '@/pages/Hoje'
import Leads from '@/pages/Leads'
import Clientes from '@/pages/Clientes'
import NovoCliente from '@/pages/NovoCliente'
import ClienteDetalhe from '@/pages/ClienteDetalhe'
import EditarCliente from '@/pages/EditarCliente'
import Imoveis from '@/pages/Imoveis'
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

          {/* Root route redirects to /hoje */}
          <Route path="/" element={<Navigate to="/hoje" replace />} />

          {/* Protected routes */}
          <Route element={<ProtectedRoute />}>
            <Route element={<AppLayout />}>
              <Route path="/hoje" element={<Hoje />} />
              <Route path="/leads" element={<Leads />} />
              <Route path="/clientes" element={<Clientes />} />
              <Route path="/clientes/novo" element={<NovoCliente />} />
              <Route path="/clientes/:id" element={<ClienteDetalhe />} />
              <Route path="/clientes/:id/editar" element={<EditarCliente />} />
              <Route path="/imoveis" element={<Imoveis />} />
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
