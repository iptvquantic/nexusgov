import { useEffect, useState } from 'react';
import { Link, useLocation, useNavigate } from 'react-router-dom';
import {
  ArrowRight, CheckCircle2, Eye, EyeOff, FileText, HandCoins, Target, TrendingUp, Truck, BellRing, Landmark, Loader2, ShieldCheck, Smartphone,
} from 'lucide-react';
import { api } from '../lib/api';
import { useAuth } from '../lib/auth';
import { useToast } from '../components/ui';
import { Logo } from '../components/Layout';
import { CardsPlanos } from './Planos';

const RECURSOS = [
  { i: FileText, t: 'Empenho em PDF vira venda', d: 'Anexe a Nota de Empenho do Compras.gov.br: órgão, UASG, itens, quantidades e valores são preenchidos sozinhos.' },
  { i: TrendingUp, t: 'Lucro real de cada venda', d: 'Custo do fornecedor + frete por item. Veja na hora quanto cada empenho deu de lucro ou prejuízo.' },
  { i: Target, t: 'Oportunidades e cotações', d: 'Organize dispensas e pregões por data da sessão, calcule o preço com a margem que você quer e acompanhe o resultado.' },
  { i: Truck, t: 'Entrega, NF e pagamento', d: 'Etapas de cada venda com prazo de entrega, nota fiscal (importa o XML) e previsão de pagamento do governo.' },
  { i: BellRing, t: 'Alertas que evitam multa', d: 'Entrega vencendo, pagamento atrasado, venda sem custo, limite do MEI chegando: tudo no painel.' },
  { i: Landmark, t: 'Órgãos e fornecedores', d: 'Quanto cada órgão compra e em quantos dias costuma pagar; quem é seu melhor fornecedor de cada produto.' },
];

const PASSOS = [
  ['1', 'Cadastre a oportunidade', 'Dispensa ou pregão, data da sessão e os itens com o custo do fornecedor.'],
  ['2', 'Ganhou? Anexe o empenho', 'A venda nasce com os itens; acompanhe compra, entrega e nota fiscal.'],
  ['3', 'Receba e veja o lucro', 'Registre o pagamento do governo: caixa, lucro e relatórios se atualizam sozinhos.'],
];

function Formulario() {
  const loc = useLocation();
  const nav = useNavigate();
  const avisar = useToast();
  const { entrar } = useAuth();
  const [aba, setAba] = useState(loc.hash === '#criar' ? 'cadastro' : 'login');
  const [f, setF] = useState({ nome: '', empresa: '', email: '', senha: '' });
  const [ver, setVer] = useState(false);
  const [enviando, setEnviando] = useState(false);
  const [msgEsqueci, setMsgEsqueci] = useState(null);
  const set = (k) => (e) => setF((x) => ({ ...x, [k]: e.target.value }));

  useEffect(() => { if (loc.hash === '#criar') setAba('cadastro'); }, [loc.hash]);

  const enviar = async (e) => {
    e.preventDefault();
    setEnviando(true);
    try {
      if (aba === 'esqueci') {
        const r = await api('/auth/esqueci', { method: 'POST', body: { email: f.email } });
        setMsgEsqueci(r.email_configurado
          ? 'Se o e-mail tiver conta, enviamos um link para criar nova senha (veja também o spam).'
          : 'Pedido registrado. Fale com o suporte para receber o link de nova senha.');
        return;
      }
      const r = await api(aba === 'login' ? '/auth/login' : '/auth/cadastro', { method: 'POST', body: f });
      entrar(r.token, r.usuario);
      if (!r.usuario.plano_ativo) { nav('/planos?expirado=1'); return; }
      avisar(aba === 'login' ? `Bem-vindo de volta, ${r.usuario.nome.split(' ')[0]}!` : 'Conta criada! Seus dias grátis já começaram.');
      nav(loc.state?.de || '/', { replace: true });
    } catch (err) {
      avisar(err.message, 'erro');
    } finally {
      setEnviando(false);
    }
  };

  return (
    <div className="card p-5 sm:p-7 shadow-2xl shadow-black/40 w-full">
      {aba !== 'esqueci' ? (
        <div className="grid grid-cols-2 gap-1 bg-painel2 rounded-xl p-1 mb-5" role="tablist">
          {[['login', 'Entrar'], ['cadastro', 'Criar conta grátis']].map(([id, r]) => (
            <button key={id} role="tab" aria-selected={aba === id} onClick={() => setAba(id)}
              className={`py-2 rounded-lg text-sm font-semibold transition ${aba === id ? 'bg-marca-600 text-white' : 'text-slate-400 hover:text-white'}`}>{r}</button>
          ))}
        </div>
      ) : (
        <button onClick={() => { setAba('login'); setMsgEsqueci(null); }} className="text-sm text-slate-400 hover:text-white mb-4">← Voltar para entrar</button>
      )}

      <form onSubmit={enviar} className="space-y-3.5">
        {aba === 'cadastro' && (
          <>
            <p className="text-sm text-emerald-300 bg-emerald-500/10 border border-emerald-500/25 rounded-xl px-3 py-2 flex items-center gap-2">
              <CheckCircle2 size={15} /> 15 dias grátis, sem cartão de crédito.
            </p>
            <label className="block"><span className="label">Seu nome</span><input className="input" value={f.nome} onChange={set('nome')} required autoComplete="name" /></label>
            <label className="block"><span className="label">Empresa (opcional)</span><input className="input" value={f.empresa} onChange={set('empresa')} placeholder="Ex.: Top Flex Comércio" /></label>
          </>
        )}
        {aba === 'esqueci' && <h2 className="text-lg font-bold text-white">Esqueci minha senha</h2>}
        <label className="block"><span className="label">E-mail</span>
          <input className="input" type="email" value={f.email} onChange={set('email')} required autoComplete="email" placeholder="voce@empresa.com" />
        </label>
        {aba !== 'esqueci' && (
          <label className="block">
            <span className="label flex justify-between">
              <span>Senha</span>
              {aba === 'login' && <button type="button" onClick={() => setAba('esqueci')} className="normal-case tracking-normal text-marca-400 hover:text-marca-300 font-medium">Esqueci minha senha</button>}
            </span>
            <div className="relative">
              <input className="input pr-10" type={ver ? 'text' : 'password'} value={f.senha} onChange={set('senha')} required minLength={aba === 'cadastro' ? 6 : 1}
                autoComplete={aba === 'login' ? 'current-password' : 'new-password'} placeholder={aba === 'cadastro' ? 'Mínimo 6 caracteres' : ''} />
              <button type="button" onClick={() => setVer(!ver)} className="absolute right-3 top-1/2 -translate-y-1/2 text-slate-500 hover:text-slate-300" aria-label="Mostrar senha">
                {ver ? <EyeOff size={16} /> : <Eye size={16} />}
              </button>
            </div>
          </label>
        )}
        {msgEsqueci && <p className="text-sm text-marca-200 bg-marca-500/10 border border-marca-500/30 rounded-xl px-3 py-2">{msgEsqueci}</p>}
        <button className="btn-pri w-full py-3" disabled={enviando}>
          {enviando ? <Loader2 size={17} className="animate-spin" /> : <ArrowRight size={17} />}
          {aba === 'login' ? 'Entrar' : aba === 'cadastro' ? 'Começar meus 15 dias grátis' : 'Enviar link'}
        </button>
      </form>
    </div>
  );
}

export default function Entrar() {
  return (
    <div className="min-h-screen bg-fundo">
      <div className="absolute inset-x-0 top-0 h-[560px] bg-[radial-gradient(ellipse_at_top,rgba(37,99,235,0.22),transparent_65%)] pointer-events-none" />
      <header className="relative max-w-6xl mx-auto px-4 sm:px-6 h-16 flex items-center justify-between">
        <Logo />
        <nav className="flex items-center gap-1 text-sm">
          <a href="#recursos" className="hidden sm:inline px-3 py-2 text-slate-400 hover:text-white">Recursos</a>
          <a href="#planos" className="px-3 py-2 text-slate-400 hover:text-white">Planos</a>
          <a href="#criar" className="btn-pri btn-sm">Testar grátis</a>
        </nav>
      </header>

      <section className="relative max-w-6xl mx-auto px-4 sm:px-6 pt-6 sm:pt-14 pb-14 grid lg:grid-cols-[1.15fr_1fr] gap-10 items-start">
        <div className="pt-2">
          <span className="chip text-marca-300 bg-marca-500/10 border-marca-500/30 mb-4"><ShieldCheck size={12} /> Feito para quem vende para órgãos públicos</span>
          <h1 className="text-3xl sm:text-5xl font-extrabold text-white leading-[1.08] tracking-tight">
            Do empenho ao dinheiro na conta,<br className="hidden sm:block" /> <span className="text-marca-400">sem perder nenhum prazo.</span>
          </h1>
          <p className="text-base sm:text-lg text-slate-400 mt-5 max-w-xl">
            Controle dispensas, pregões, empenhos, entregas, notas fiscais e recebimentos em um só lugar — e veja o lucro de cada venda, já descontado custo e frete.
          </p>
          <ul className="mt-6 grid sm:grid-cols-2 gap-2.5 text-sm text-slate-300 max-w-xl">
            {['Importa o PDF do empenho', 'Lucro e margem por venda', 'Alerta de entrega e pagamento', 'Limite do MEI sempre à vista'].map((t) => (
              <li key={t} className="flex items-center gap-2"><CheckCircle2 size={16} className="text-emerald-400 shrink-0" />{t}</li>
            ))}
          </ul>
          <div className="mt-6 flex items-center gap-2 text-xs text-slate-500"><Smartphone size={14} /> Funciona no celular e no computador.</div>
        </div>
        <div id="criar" className="w-full max-w-md lg:ml-auto scroll-mt-20"><Formulario /></div>
      </section>

      <section id="recursos" className="relative max-w-6xl mx-auto px-4 sm:px-6 py-12 scroll-mt-10">
        <h2 className="text-2xl sm:text-3xl font-bold text-white text-center">Tudo o que a venda pública exige</h2>
        <p className="text-slate-400 text-center mt-2 mb-8">Pensado a partir da rotina real de dispensa eletrônica e pregão.</p>
        <div className="grid sm:grid-cols-2 lg:grid-cols-3 gap-4">
          {RECURSOS.map(({ i: I, t, d }) => (
            <div key={t} className="card p-5">
              <div className="w-10 h-10 rounded-xl bg-marca-500/10 text-marca-300 flex items-center justify-center mb-3"><I size={19} /></div>
              <h3 className="font-semibold text-white">{t}</h3>
              <p className="text-sm text-slate-400 mt-1.5 leading-relaxed">{d}</p>
            </div>
          ))}
        </div>
      </section>

      <section className="max-w-6xl mx-auto px-4 sm:px-6 py-12">
        <div className="card p-6 sm:p-8 grid md:grid-cols-3 gap-6">
          {PASSOS.map(([n, t, d]) => (
            <div key={n} className="flex gap-4">
              <span className="w-9 h-9 rounded-full bg-marca-600 text-white font-bold flex items-center justify-center shrink-0">{n}</span>
              <div><h3 className="font-semibold text-white">{t}</h3><p className="text-sm text-slate-400 mt-1">{d}</p></div>
            </div>
          ))}
        </div>
      </section>

      <section id="planos" className="max-w-6xl mx-auto px-4 sm:px-6 py-12 scroll-mt-10">
        <h2 className="text-2xl sm:text-3xl font-bold text-white text-center">Planos simples</h2>
        <p className="text-slate-400 text-center mt-2 mb-8">Comece com 15 dias grátis. Depois, escolha o plano. Sem fidelidade.</p>
        <CardsPlanos acaoTeste={<a href="#criar" className="btn-ok w-full">Começar grátis <HandCoins size={16} /></a>} />
      </section>

      <footer className="border-t border-borda mt-8">
        <div className="max-w-6xl mx-auto px-4 sm:px-6 py-6 flex flex-col sm:flex-row gap-2 justify-between text-xs text-slate-500">
          <span>© {new Date().getFullYear()} NexusGov</span>
          <span><Link to="/planos" className="hover:text-slate-300">Planos</Link> · <a href="#criar" className="hover:text-slate-300">Criar conta</a></span>
        </div>
      </footer>
    </div>
  );
}
