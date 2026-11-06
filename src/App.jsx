import { lazy, Suspense } from 'react';
import { BrowserRouter, Navigate, Route, Routes, useLocation } from 'react-router-dom';
import { AuthProvider, useAuth } from './lib/auth';
import { ToastProvider, ConfirmProvider, Carregando } from './components/ui';
import Layout from './components/Layout';
import Entrar from './pages/Entrar';
import Planos from './pages/Planos';
import RedefinirSenha from './pages/RedefinirSenha';

const Dashboard = lazy(() => import('./pages/Dashboard'));
const Oportunidades = lazy(() => import('./pages/Oportunidades'));
const Vendas = lazy(() => import('./pages/Vendas'));
const VendaForm = lazy(() => import('./pages/VendaForm'));
const VendaDetalhe = lazy(() => import('./pages/VendaDetalhe'));
const Recebimentos = lazy(() => import('./pages/Recebimentos'));
const Caixa = lazy(() => import('./pages/Caixa'));
const Orgaos = lazy(() => import('./pages/Orgaos'));
const Fornecedores = lazy(() => import('./pages/Fornecedores'));
const Relatorios = lazy(() => import('./pages/Relatorios'));
const Configuracoes = lazy(() => import('./pages/Configuracoes'));
const Admin = lazy(() => import('./pages/Admin'));

function Protegida({ children }) {
  const { usuario, carregando } = useAuth();
  const loc = useLocation();
  if (carregando) return <div className="min-h-screen flex items-center justify-center"><Carregando /></div>;
  if (!usuario) return <Navigate to="/entrar" replace state={{ de: loc.pathname }} />;
  if (!usuario.plano_ativo) return <Navigate to="/planos?expirado=1" replace />;
  return <Layout><Suspense fallback={<Carregando />}>{children}</Suspense></Layout>;
}

function Publica({ children }) {
  const { usuario, carregando } = useAuth();
  if (carregando) return <div className="min-h-screen flex items-center justify-center"><Carregando /></div>;
  if (usuario && usuario.plano_ativo) return <Navigate to="/" replace />;
  return children;
}

export default function App() {
  return (
    <AuthProvider>
      <ToastProvider>
        <ConfirmProvider>
          <BrowserRouter>
            <Routes>
              <Route path="/entrar" element={<Publica><Entrar /></Publica>} />
              <Route path="/login" element={<Navigate to="/entrar" replace />} />
              <Route path="/planos" element={<Planos />} />
              <Route path="/redefinir-senha" element={<RedefinirSenha />} />
              <Route path="/" element={<Protegida><Dashboard /></Protegida>} />
              <Route path="/oportunidades" element={<Protegida><Oportunidades /></Protegida>} />
              <Route path="/vendas" element={<Protegida><Vendas /></Protegida>} />
              <Route path="/vendas/nova" element={<Protegida><VendaForm /></Protegida>} />
              <Route path="/vendas/:id" element={<Protegida><VendaDetalhe /></Protegida>} />
              <Route path="/vendas/:id/editar" element={<Protegida><VendaForm /></Protegida>} />
              <Route path="/recebimentos" element={<Protegida><Recebimentos /></Protegida>} />
              <Route path="/caixa" element={<Protegida><Caixa /></Protegida>} />
              <Route path="/orgaos" element={<Protegida><Orgaos /></Protegida>} />
              <Route path="/fornecedores" element={<Protegida><Fornecedores /></Protegida>} />
              <Route path="/relatorios" element={<Protegida><Relatorios /></Protegida>} />
              <Route path="/configuracoes" element={<Protegida><Configuracoes /></Protegida>} />
              <Route path="/admin" element={<Protegida><Admin /></Protegida>} />
              <Route path="*" element={<Navigate to="/" replace />} />
            </Routes>
          </BrowserRouter>
        </ConfirmProvider>
      </ToastProvider>
    </AuthProvider>
  );
}
