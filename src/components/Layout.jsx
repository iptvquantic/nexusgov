import { useEffect, useState } from 'react';
import { NavLink, useLocation, useNavigate } from 'react-router-dom';
import {
  LayoutDashboard, Target, ShoppingCart, HandCoins, Wallet, Landmark, Truck, BarChart3, Settings, Shield,
  LogOut, Menu as MenuIcone, X, ChevronsLeft, ChevronsRight, Clock, CreditCard,
} from 'lucide-react';
import { useAuth } from '../lib/auth';

const MENU = [
  { to: '/', icone: LayoutDashboard, rotulo: 'Painel', fim: true },
  { to: '/oportunidades', icone: Target, rotulo: 'Oportunidades' },
  { to: '/vendas', icone: ShoppingCart, rotulo: 'Vendas / Empenhos' },
  { to: '/recebimentos', icone: HandCoins, rotulo: 'A receber' },
  { to: '/caixa', icone: Wallet, rotulo: 'Caixa e despesas' },
  { to: '/orgaos', icone: Landmark, rotulo: 'Órgãos' },
  { to: '/fornecedores', icone: Truck, rotulo: 'Fornecedores' },
  { to: '/relatorios', icone: BarChart3, rotulo: 'Relatórios' },
  { to: '/configuracoes', icone: Settings, rotulo: 'Configurações' },
];

export function Logo({ mini = false }) {
  return (
    <div className="flex items-center gap-2.5 min-w-0">
      <div className="w-9 h-9 rounded-xl bg-marca-600 flex items-center justify-center shrink-0 shadow-lg shadow-marca-900/40">
        <span className="text-white font-extrabold text-lg leading-none">N</span>
      </div>
      {!mini && (
        <div className="min-w-0">
          <div className="font-extrabold text-white leading-none tracking-tight">NexusGov</div>
          <div className="text-[10px] text-slate-500 mt-0.5 uppercase tracking-wider">Vendas para governo</div>
        </div>
      )}
    </div>
  );
}

export default function Layout({ children }) {
  const { usuario, sair } = useAuth();
  const nav = useNavigate();
  const loc = useLocation();
  const [aberto, setAberto] = useState(false);
  const [recolhido, setRecolhido] = useState(() => { try { return localStorage.getItem('nx_menu') === '1'; } catch { return false; } });

  useEffect(() => { setAberto(false); }, [loc.pathname]);
  const alternar = () => setRecolhido((r) => { try { localStorage.setItem('nx_menu', r ? '0' : '1'); } catch { /* */ } return !r; });

  const itens = usuario?.is_admin ? [...MENU, { to: '/admin', icone: Shield, rotulo: 'Painel do dono' }] : MENU;
  const trial = usuario?.plano === 'trial';
  const dias = usuario?.dias_restantes;

  const Navegacao = ({ mini }) => (
    <nav className="flex-1 overflow-y-auto px-2 py-3 space-y-0.5">
      {itens.map(({ to, icone: I, rotulo, fim }) => (
        <NavLink key={to} to={to} end={fim} title={mini ? rotulo : undefined}
          className={({ isActive }) => `flex items-center rounded-xl text-sm font-medium transition ${mini ? 'justify-center h-10' : 'gap-3 px-3 h-10'}
            ${isActive ? 'bg-marca-600/15 text-marca-300 ring-1 ring-marca-500/30' : 'text-slate-400 hover:text-white hover:bg-white/[0.04]'}`}>
          <I size={18} className="shrink-0" />
          {!mini && <span className="truncate">{rotulo}</span>}
        </NavLink>
      ))}
    </nav>
  );

  const Rodape = ({ mini }) => (
    <div className="border-t border-borda p-2 space-y-1">
      {trial && !mini && (
        <button onClick={() => nav('/planos')} className="w-full text-left rounded-xl bg-amber-500/10 border border-amber-500/30 px-3 py-2 hover:bg-amber-500/15">
          <div className="flex items-center gap-1.5 text-xs font-semibold text-amber-300"><Clock size={12} />Teste grátis: {dias} dia{dias === 1 ? '' : 's'}</div>
          <div className="text-[11px] text-amber-200/70">Ver planos</div>
        </button>
      )}
      <button onClick={() => nav('/configuracoes')} title={mini ? usuario?.nome : undefined}
        className={`w-full flex items-center rounded-xl hover:bg-white/[0.04] ${mini ? 'justify-center h-10' : 'gap-2.5 px-2 py-2'}`}>
        <span className="w-8 h-8 rounded-full bg-marca-600/20 border border-marca-500/40 flex items-center justify-center text-marca-300 text-xs font-bold shrink-0">
          {(usuario?.nome || '?').charAt(0).toUpperCase()}
        </span>
        {!mini && (
          <span className="min-w-0 text-left">
            <span className="block text-xs font-semibold text-white truncate">{usuario?.nome}</span>
            <span className="block text-[11px] text-slate-500 truncate">{usuario?.empresa || usuario?.email}</span>
          </span>
        )}
      </button>
      <button onClick={() => { sair(); nav('/entrar'); }} title="Sair"
        className={`w-full flex items-center rounded-xl text-xs text-slate-500 hover:text-red-300 hover:bg-red-500/10 ${mini ? 'justify-center h-9' : 'gap-2 px-3 h-9'}`}>
        <LogOut size={15} />{!mini && 'Sair'}
      </button>
    </div>
  );

  return (
    <div className="min-h-screen lg:flex">
      {/* Lateral (computador) */}
      <aside className={`hidden lg:flex flex-col sticky top-0 h-screen bg-painel border-r border-borda transition-[width] duration-200 ${recolhido ? 'w-[72px]' : 'w-64'}`}>
        <div className={`h-16 flex items-center border-b border-borda ${recolhido ? 'justify-center' : 'px-4 justify-between'}`}>
          <Logo mini={recolhido} />
        </div>
        <Navegacao mini={recolhido} />
        <Rodape mini={recolhido} />
        <button onClick={alternar} aria-label={recolhido ? 'Expandir menu' : 'Recolher menu'}
          className="absolute -right-3 top-[76px] w-6 h-6 rounded-full bg-painel2 border border-borda text-slate-400 hover:text-white flex items-center justify-center shadow">
          {recolhido ? <ChevronsRight size={13} /> : <ChevronsLeft size={13} />}
        </button>
      </aside>

      {/* Gaveta (celular) */}
      {aberto && <div className="lg:hidden fixed inset-0 z-40 bg-black/60" onClick={() => setAberto(false)} />}
      <aside className={`lg:hidden fixed z-50 inset-y-0 left-0 w-72 max-w-[85vw] bg-painel border-r border-borda flex flex-col transition-transform duration-200 ${aberto ? 'translate-x-0' : '-translate-x-full'}`}>
        <div className="h-16 flex items-center justify-between px-4 border-b border-borda">
          <Logo />
          <button onClick={() => setAberto(false)} className="p-2 text-slate-400" aria-label="Fechar menu"><X size={20} /></button>
        </div>
        <Navegacao />
        <Rodape />
      </aside>

      <div className="flex-1 min-w-0 flex flex-col">
        <header className="lg:hidden sticky top-0 z-30 h-14 flex items-center gap-3 px-3 bg-fundo/90 backdrop-blur border-b border-borda">
          <button onClick={() => setAberto(true)} className="p-2 rounded-lg text-slate-300 hover:bg-white/5" aria-label="Abrir menu"><MenuIcone size={20} /></button>
          <Logo />
          {trial && <button onClick={() => nav('/planos')} className="ml-auto chip text-amber-300 bg-amber-500/10 border-amber-500/30"><CreditCard size={11} />{dias}d grátis</button>}
        </header>
        <main className="flex-1 min-w-0 px-3 sm:px-5 lg:px-8 py-5 lg:py-7 max-w-[1400px] w-full mx-auto">{children}</main>
      </div>
    </div>
  );
}
