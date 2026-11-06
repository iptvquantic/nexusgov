import { useEffect, useState } from 'react';
import { Link } from 'react-router-dom';
import { Building, CreditCard, KeyRound, Loader2, LogOut, Smartphone } from 'lucide-react';
import { api } from '../lib/api';
import { useAuth } from '../lib/auth';
import { Cabecalho, Campo, CampoValor, useToast } from '../components/ui';
import { data } from '../lib/fmt';

export default function Configuracoes() {
  const { usuario, setUsuario, sair } = useAuth();
  const avisar = useToast();
  const [f, setF] = useState({ ...usuario });
  const [s, setS] = useState({ atual: '', nova: '', nova2: '' });
  const [ocupado, setOcupado] = useState('');
  const [instalar, setInstalar] = useState(null);
  useEffect(() => {
    const h = (e) => { e.preventDefault(); setInstalar(e); };
    window.addEventListener('beforeinstallprompt', h);
    return () => window.removeEventListener('beforeinstallprompt', h);
  }, []);
  const m = (k) => (e) => setF({ ...f, [k]: e?.target ? e.target.value : e });

  const salvar = async (e) => {
    e.preventDefault(); setOcupado('perfil');
    try { const r = await api('/auth/perfil', { method: 'PUT', body: f }); setUsuario(r.usuario); avisar('Dados salvos.'); } catch (err) { avisar(err.message, 'erro'); } finally { setOcupado(''); }
  };
  const trocarSenha = async (e) => {
    e.preventDefault();
    if (s.nova !== s.nova2) return avisar('As senhas novas não são iguais.', 'erro');
    setOcupado('senha');
    try { await api('/auth/senha', { method: 'POST', body: { atual: s.atual, nova: s.nova } }); avisar('Senha alterada.'); setS({ atual: '', nova: '', nova2: '' }); } catch (err) { avisar(err.message, 'erro'); } finally { setOcupado(''); }
  };

  const planoTxt = usuario.plano === 'vitalicio' ? 'Vitalício' : usuario.plano === 'trial' ? 'Teste grátis' : usuario.plano ? usuario.plano[0].toUpperCase() + usuario.plano.slice(1) : '—';

  return (
    <div className="fade-in max-w-3xl">
      <Cabecalho titulo="Configurações" sub="Seus dados, empresa e preferências de cálculo." />
      <div className="space-y-4">
        <div className="card p-4 sm:p-5 flex flex-col sm:flex-row sm:items-center justify-between gap-3">
          <div className="flex items-center gap-3"><span className="w-10 h-10 rounded-xl bg-marca-500/15 text-marca-300 flex items-center justify-center"><CreditCard size={18} /></span>
            <div><p className="font-semibold text-white">Plano {planoTxt}</p><p className="text-xs text-slate-400">{usuario.plano === 'vitalicio' || usuario.is_admin ? 'Sem vencimento' : `Vence em ${data(usuario.plano_expira_em)}${usuario.dias_restantes !== null ? ` · ${Math.max(0, usuario.dias_restantes)} dia(s)` : ''}`}</p></div></div>
          {usuario.plano !== 'vitalicio' && !usuario.is_admin && <Link to="/planos" className="btn-pri">Renovar / mudar plano</Link>}
        </div>

        <form onSubmit={salvar} className="card p-4 sm:p-5 space-y-4">
          <h2 className="font-semibold text-white flex items-center gap-2"><Building size={16} className="text-marca-400" />Você e sua empresa</h2>
          <div className="grid sm:grid-cols-2 gap-3">
            <Campo rotulo="Seu nome"><input className="input" value={f.nome || ''} onChange={m('nome')} /></Campo>
            <Campo rotulo="E-mail (login)"><input className="input opacity-60" value={f.email || ''} disabled /></Campo>
            <Campo rotulo="Empresa / razão social"><input className="input" value={f.empresa || ''} onChange={m('empresa')} /></Campo>
            <Campo rotulo="CNPJ"><input className="input num" value={f.cnpj || ''} onChange={m('cnpj')} /></Campo>
            <Campo rotulo="Telefone / WhatsApp"><input className="input" value={f.telefone || ''} onChange={m('telefone')} /></Campo>
          </div>
          <h3 className="font-semibold text-white pt-2">Cálculos</h3>
          <div className="grid sm:grid-cols-2 gap-3">
            <Campo rotulo="Limite anual de faturamento" dica="MEI: R$ 81.000. O painel avisa quando você se aproxima."><CampoValor value={f.limite_mei} onChange={m('limite_mei')} /></Campo>
            <Campo rotulo="Dias para o órgão pagar após a NF" dica="Usado para prever a data de pagamento (padrão 30)."><input type="number" min={0} max={365} className="input" value={f.dias_pagamento_padrao ?? 30} onChange={m('dias_pagamento_padrao')} /></Campo>
          </div>
          <p className="text-xs text-slate-500">O sistema não calcula imposto sozinho. Lance o DAS e outros tributos em <Link to="/caixa" className="text-marca-300 underline">Caixa e despesas</Link> — eles entram no lucro líquido dos relatórios.</p>
          <div className="flex justify-end"><button className="btn-pri" disabled={ocupado === 'perfil'}>{ocupado === 'perfil' && <Loader2 size={15} className="animate-spin" />}Salvar</button></div>
        </form>

        <form onSubmit={trocarSenha} className="card p-4 sm:p-5 space-y-3">
          <h2 className="font-semibold text-white flex items-center gap-2"><KeyRound size={16} className="text-marca-400" />Alterar senha</h2>
          <div className="grid sm:grid-cols-3 gap-3">
            <Campo rotulo="Senha atual"><input type="password" className="input" required value={s.atual} onChange={(e) => setS({ ...s, atual: e.target.value })} autoComplete="current-password" /></Campo>
            <Campo rotulo="Nova senha"><input type="password" className="input" required minLength={6} value={s.nova} onChange={(e) => setS({ ...s, nova: e.target.value })} autoComplete="new-password" /></Campo>
            <Campo rotulo="Repita a nova"><input type="password" className="input" required minLength={6} value={s.nova2} onChange={(e) => setS({ ...s, nova2: e.target.value })} autoComplete="new-password" /></Campo>
          </div>
          <div className="flex justify-end"><button className="btn-sec" disabled={ocupado === 'senha'}>{ocupado === 'senha' && <Loader2 size={15} className="animate-spin" />}Alterar senha</button></div>
        </form>

        <div className="card p-4 sm:p-5 flex flex-col sm:flex-row sm:items-center justify-between gap-3">
          <div className="flex items-center gap-3"><Smartphone size={18} className="text-marca-400" /><div><p className="font-semibold text-white">Usar como aplicativo</p><p className="text-xs text-slate-400">No celular: menu do navegador → “Adicionar à tela inicial”.</p></div></div>
          {instalar && <button className="btn-sec" onClick={() => { instalar.prompt(); setInstalar(null); }}>Instalar</button>}
        </div>

        <button className="btn-perigo w-full sm:w-auto" onClick={sair}><LogOut size={16} />Sair da conta</button>
      </div>
    </div>
  );
}
