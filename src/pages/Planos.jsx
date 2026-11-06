import { useEffect, useState } from 'react';
import { Link, useNavigate, useSearchParams } from 'react-router-dom';
import { ArrowLeft, CheckCircle2, Clock, Crown, ExternalLink, Loader2, Star, Zap, MessageCircle } from 'lucide-react';
import { api } from '../lib/api';
import { useAuth } from '../lib/auth';
import { useToast } from '../components/ui';
import { Logo } from '../components/Layout';

const ICONES = { mensal: Zap, trimestral: Star, anual: Crown };
const RECURSOS = ['Vendas, empenhos e oportunidades ilimitados', 'Leitura automática do PDF do empenho e do XML da NF', 'Lucro e margem por venda', 'Alertas de entrega, pagamento e limite MEI', 'Relatórios e exportação para Excel', 'Celular e computador'];

export function usePlanos() {
  const [d, setD] = useState(null);
  useEffect(() => { api('/publico/planos').then(setD).catch(() => setD({ planos: [] })); }, []);
  return d;
}

export function CardsPlanos({ acaoTeste, aoEscolher }) {
  const d = usePlanos();
  if (!d) return <div className="flex justify-center py-10"><Loader2 className="animate-spin text-marca-400" /></div>;
  return (
    <div className="grid md:grid-cols-3 gap-4 items-stretch">
      {d.planos.map((p) => {
        const I = ICONES[p.id] || Zap;
        return (
          <div key={p.id} className={`card p-6 flex flex-col relative ${p.destaque ? 'ring-2 ring-marca-500 md:-translate-y-2' : ''}`}>
            {p.destaque && <span className="absolute -top-3 left-1/2 -translate-x-1/2 chip bg-marca-600 border-marca-500 text-white">Mais escolhido</span>}
            <div className="flex items-center gap-2 text-white font-bold"><I size={18} className="text-marca-400" />{p.nome}</div>
            <div className="mt-4 flex items-baseline gap-1">
              <span className="text-3xl font-extrabold text-white">R$ {p.preco}</span>
              <span className="text-sm text-slate-400">{p.periodo}</span>
            </div>
            <ul className="mt-5 space-y-2 text-sm text-slate-300 flex-1">
              {RECURSOS.map((r) => <li key={r} className="flex gap-2"><CheckCircle2 size={15} className="text-emerald-400 mt-0.5 shrink-0" />{r}</li>)}
            </ul>
            <div className="mt-6 space-y-2">
              {acaoTeste || (
                <a href={p.link} target="_blank" rel="noreferrer" onClick={() => aoEscolher && aoEscolher(p.id)}
                  className={p.destaque ? 'btn-pri w-full' : 'btn-sec w-full'}>Assinar {p.nome} <ExternalLink size={14} /></a>
              )}
              <p className="text-[11px] text-slate-500 text-center">Pagamento seguro pelo PagBank</p>
            </div>
          </div>
        );
      })}
    </div>
  );
}

export default function Planos() {
  const [sp] = useSearchParams();
  const expirado = sp.get('expirado') === '1';
  const { usuario, sair, setUsuario } = useAuth();
  const avisar = useToast();
  const nav = useNavigate();
  const d = usePlanos();
  const [escolhido, setEscolhido] = useState(null);
  const [enviando, setEnviando] = useState(false);

  const informar = async () => {
    setEnviando(true);
    try {
      await api('/auth/plano/solicitar', { method: 'POST', body: { plano: escolhido } });
      avisar('Recebemos o aviso! Seu acesso será liberado assim que o pagamento for confirmado.');
      setEscolhido(null);
    } catch (e) { avisar(e.message, 'erro'); } finally { setEnviando(false); }
  };

  const verificar = async () => {
    try { const r = await api('/auth/me'); setUsuario(r.usuario); if (r.usuario.plano_ativo) nav('/'); else avisar('Ainda não liberado. Assim que confirmarmos o pagamento, seu acesso volta.', 'info'); } catch (e) { avisar(e.message, 'erro'); }
  };

  const zap = d?.whatsapp_suporte?.replace(/\D/g, '');

  return (
    <div className="min-h-screen bg-fundo px-4 py-6 sm:py-10">
      <div className="max-w-5xl mx-auto">
        <div className="flex items-center justify-between mb-8">
          <Logo />
          {usuario?.plano_ativo ? <Link to="/" className="btn-sec btn-sm"><ArrowLeft size={14} />Voltar ao sistema</Link>
            : usuario ? <button onClick={() => { sair(); nav('/entrar'); }} className="btn-sec btn-sm">Sair</button>
              : <Link to="/entrar" className="btn-sec btn-sm">Entrar</Link>}
        </div>

        {expirado && usuario && !usuario.plano_ativo && (
          <div className="card border-amber-500/40 bg-amber-500/5 p-5 mb-8 flex gap-3">
            <Clock className="text-amber-400 shrink-0" />
            <div>
              <p className="font-semibold text-amber-200">Seu período de acesso terminou</p>
              <p className="text-sm text-slate-400 mt-1">Seus dados estão guardados. Escolha um plano abaixo; depois de pagar, clique em <b>"Já paguei"</b> para liberarmos seu acesso.</p>
            </div>
          </div>
        )}

        <div className="text-center mb-8">
          <h1 className="text-2xl sm:text-4xl font-extrabold text-white">Escolha seu plano</h1>
          <p className="text-slate-400 mt-2">{usuario?.plano === 'trial' && usuario?.plano_ativo ? `Você ainda tem ${usuario.dias_restantes} dia(s) grátis.` : '15 dias grátis para novas contas. Sem fidelidade.'}</p>
        </div>

        <CardsPlanos aoEscolher={(id) => usuario && setEscolhido(id)} acaoTeste={!usuario ? <Link to="/entrar#criar" className="btn-ok w-full">Criar conta grátis</Link> : null} />

        {usuario && (
          <div className="card p-5 sm:p-6 mt-8">
            <h2 className="font-semibold text-white">Já pagou?</h2>
            <p className="text-sm text-slate-400 mt-1">Avise qual plano você pagou. A liberação é feita após a confirmação do PagBank (normalmente no mesmo dia).</p>
            <div className="flex flex-wrap gap-2 mt-4">
              {['mensal', 'trimestral', 'anual'].map((p) => (
                <button key={p} onClick={() => setEscolhido(p)} className={`btn-sm btn ${escolhido === p ? 'bg-marca-600 text-white' : 'bg-painel2 border border-borda text-slate-300'}`}>{p[0].toUpperCase() + p.slice(1)}</button>
              ))}
              <button disabled={!escolhido || enviando} onClick={informar} className="btn-ok btn-sm">{enviando ? <Loader2 size={14} className="animate-spin" /> : <CheckCircle2 size={14} />}Já paguei</button>
              {!usuario.plano_ativo && <button onClick={verificar} className="btn-sec btn-sm">Verificar liberação</button>}
              {zap && <a className="btn-sec btn-sm" href={`https://wa.me/${zap.length <= 11 ? '55' + zap : zap}?text=${encodeURIComponent(`Olá! Paguei o NexusGov. Meu e-mail: ${usuario.email}`)}`} target="_blank" rel="noreferrer"><MessageCircle size={14} />WhatsApp</a>}
            </div>
            {d?.email_suporte && <p className="text-xs text-slate-500 mt-3">Dúvidas: {d.email_suporte}</p>}
          </div>
        )}
      </div>
    </div>
  );
}
