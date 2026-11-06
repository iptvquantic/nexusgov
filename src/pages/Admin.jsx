import { useEffect, useState } from 'react';
import { Check, Copy, KeyRound, Loader2, Save, Search, ShieldCheck, UserCheck, UserX, X } from 'lucide-react';
import { api } from '../lib/api';
import { useAuth } from '../lib/auth';
import { Cabecalho, Campo, ErroCaixa, Kpi, Modal, Spinner, useConfirm, useDados, useToast } from '../components/ui';
import { usePlanos } from './Planos';
import { data, dataHora, dinheiro } from '../lib/fmt';

const PLANOS = [['mensal', 'Mensal (+31d)'], ['trimestral', 'Trimestral (+93d)'], ['anual', 'Anual (+366d)'], ['vitalicio', 'Vitalício'], ['trial', 'Mais teste (+15d)']];

export default function Admin() {
  const { usuario: eu } = useAuth();
  const avisar = useToast();
  const confirmar = useConfirm();
  const [busca, setBusca] = useState('');
  const [liberar, setLiberar] = useState(null);
  const [link, setLink] = useState(null);
  const { dados, erro, recarregar } = useDados(() => api('/admin/usuarios'), []);

  if (erro) return <ErroCaixa erro={erro} tentar={recarregar} />;
  const b = busca.toLowerCase();
  const lista = (dados?.usuarios || []).filter((u) => !b || [u.nome, u.email, u.empresa].some((x) => (x || '').toLowerCase().includes(b)));
  const ativos = (dados?.usuarios || []).filter((u) => u.plano_ativo && !u.is_admin);
  const pagantes = ativos.filter((u) => ['mensal', 'trimestral', 'anual', 'vitalicio'].includes(u.plano));

  const ativar = async (u) => {
    if (u.ativo && !(await confirmar(`Bloquear o acesso de ${u.email}?`, { perigo: true, botao: 'Bloquear' }))) return;
    try { await api(`/admin/usuarios/${u.id}/ativo`, { method: 'POST', body: { ativo: !u.ativo } }); avisar(u.ativo ? 'Bloqueado.' : 'Desbloqueado.'); recarregar(); } catch (e) { avisar(e.message, 'erro'); }
  };
  const gerarLink = async (u) => {
    try { const r = await api(`/admin/usuarios/${u.id}/link-senha`, { method: 'POST' }); setLink(r); } catch (e) { avisar(e.message, 'erro'); }
  };
  const recusar = async (s) => {
    try { await api(`/admin/solicitacoes/${s.id}/recusar`, { method: 'POST' }); avisar('Solicitação recusada.'); recarregar(); } catch (e) { avisar(e.message, 'erro'); }
  };

  return (
    <div className="fade-in">
      <Cabecalho titulo="Painel do dono" sub="Clientes do NexusGov, liberação de planos e configurações de venda." />

      {dados && (
        <div className="grid grid-cols-2 lg:grid-cols-4 gap-3 mb-4">
          <Kpi titulo="Clientes" valor={dados.usuarios.length - 1} icone={ShieldCheck} />
          <Kpi titulo="Com acesso ativo" valor={ativos.length} tom="verde" />
          <Kpi titulo="Pagantes" valor={pagantes.length} tom="roxo" />
          <Kpi titulo="Pedidos de liberação" valor={dados.solicitacoes.length} tom={dados.solicitacoes.length ? 'ambar' : 'cinza'} />
        </div>
      )}

      {dados?.solicitacoes?.length > 0 && (
        <div className="card p-4 mb-4 border-amber-500/40">
          <h2 className="font-semibold text-amber-200 mb-3">Clientes dizendo que já pagaram</h2>
          <div className="space-y-2">
            {dados.solicitacoes.map((s) => (
              <div key={s.id} className="flex flex-col sm:flex-row sm:items-center justify-between gap-2 rounded-xl bg-painel2 border border-borda px-3 py-2.5">
                <div className="min-w-0"><p className="text-sm text-white truncate">{s.nome} · {s.email}</p><p className="text-[11px] text-slate-500">Plano {s.plano} · {dataHora(s.criado_em)}{s.obs ? ` · ${s.obs}` : ''}</p></div>
                <div className="flex gap-2 shrink-0">
                  <button className="btn-ok btn-sm" onClick={() => setLiberar({ id: s.usuario_id, email: s.email, plano: s.plano })}><Check size={13} />Liberar</button>
                  <button className="btn-sec btn-sm" onClick={() => recusar(s)}><X size={13} />Recusar</button>
                </div>
              </div>
            ))}
          </div>
          <p className="text-[11px] text-slate-500 mt-2">Confira o pagamento no PagSeguro antes de liberar.</p>
        </div>
      )}

      <div className="relative mb-3"><Search size={15} className="absolute left-3 top-1/2 -translate-y-1/2 text-slate-500" /><input className="input pl-9" placeholder="Buscar cliente…" value={busca} onChange={(e) => setBusca(e.target.value)} /></div>

      {!dados ? <div className="flex justify-center py-16"><Spinner tamanho={28} /></div> : (
        <div className="card overflow-hidden mb-6"><div className="overflow-x-auto">
          <table className="tabela">
            <thead><tr><th>Cliente</th><th>Plano</th><th className="hidden md:table-cell">Uso</th><th className="hidden lg:table-cell">Último acesso</th><th className="text-right">Ações</th></tr></thead>
            <tbody>
              {lista.map((u) => (
                <tr key={u.id} className={!u.ativo ? 'opacity-50' : ''}>
                  <td className="max-w-[240px]"><p className="text-slate-200 truncate">{u.nome}{u.is_admin && <span className="ml-1.5 text-[10px] text-marca-300">ADMIN</span>}</p><p className="text-[11px] text-slate-500 truncate">{u.email}{u.empresa ? ` · ${u.empresa}` : ''}</p></td>
                  <td className="whitespace-nowrap"><span className={`chip ${u.plano_ativo ? 'text-emerald-300 bg-emerald-500/10 border-emerald-500/30' : 'text-red-300 bg-red-500/10 border-red-500/30'}`}>{u.plano}</span>
                    <p className="text-[11px] text-slate-500 mt-0.5">{u.plano === 'vitalicio' || u.is_admin ? 'sem vencimento' : `até ${data(u.plano_expira_em)}`}</p></td>
                  <td className="hidden md:table-cell text-xs text-slate-400">{u.vendas} venda(s)<br /><span className="num">{dinheiro(u.valor_vendas)}</span></td>
                  <td className="hidden lg:table-cell text-xs text-slate-400">{u.ultimo_login ? dataHora(u.ultimo_login) : 'nunca'}<br />desde {data(u.criado_em)}</td>
                  <td className="text-right whitespace-nowrap">
                    <button title="Liberar / renovar plano" onClick={() => setLiberar(u)} className="p-1.5 rounded-lg text-emerald-300 hover:bg-emerald-500/10"><UserCheck size={16} /></button>
                    <button title="Gerar link de nova senha" onClick={() => gerarLink(u)} className="p-1.5 rounded-lg text-marca-300 hover:bg-marca-500/10"><KeyRound size={16} /></button>
                    {u.id !== eu.id && <button title={u.ativo ? 'Bloquear' : 'Desbloquear'} onClick={() => ativar(u)} className="p-1.5 rounded-lg text-red-300 hover:bg-red-500/10"><UserX size={16} /></button>}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div></div>
      )}

      <Sistema />

      {liberar && <ModalLiberar u={liberar} fechar={() => setLiberar(null)} pronto={() => { setLiberar(null); recarregar(); }} />}
      {link && (
        <Modal titulo="Link para criar nova senha" aberto fechar={() => setLink(null)} largura="max-w-lg">
          <p className="text-sm text-slate-400 mb-2">Envie para <b className="text-white">{link.email}</b> (WhatsApp ou e-mail). Vale por 48 horas.</p>
          <div className="flex gap-2"><input className="input num text-xs" readOnly value={link.link} onFocus={(e) => e.target.select()} />
            <button className="btn-pri shrink-0" onClick={() => { navigator.clipboard?.writeText(link.link); avisar('Link copiado.'); }}><Copy size={15} />Copiar</button></div>
        </Modal>
      )}
    </div>
  );
}

function ModalLiberar({ u, fechar, pronto }) {
  const avisar = useToast();
  const [plano, setPlano] = useState(['mensal', 'trimestral', 'anual'].includes(u.plano) ? u.plano : 'mensal');
  const [enviando, setEnviando] = useState(false);
  const ir = async () => {
    setEnviando(true);
    try { await api(`/admin/usuarios/${u.id}/plano`, { method: 'POST', body: { plano } }); avisar('Plano liberado.'); pronto(); } catch (e) { avisar(e.message, 'erro'); setEnviando(false); }
  };
  return (
    <Modal titulo="Liberar / renovar plano" aberto fechar={fechar} largura="max-w-sm"
      rodape={<><button className="btn-sec" onClick={fechar}>Voltar</button><button className="btn-ok" disabled={enviando} onClick={ir}>{enviando && <Loader2 size={15} className="animate-spin" />}Liberar</button></>}>
      <p className="text-sm text-slate-400 mb-3">{u.email}</p>
      <div className="space-y-1.5">{PLANOS.map(([k, r]) => (
        <label key={k} className={`flex items-center gap-2 rounded-xl border px-3 py-2 cursor-pointer text-sm ${plano === k ? 'border-marca-500 bg-marca-500/10 text-white' : 'border-borda text-slate-300'}`}>
          <input type="radio" name="plano" checked={plano === k} onChange={() => setPlano(k)} className="accent-blue-500" />{r}
        </label>
      ))}</div>
      <p className="text-[11px] text-slate-500 mt-2">Os dias são somados ao vencimento atual (não perde dias já pagos).</p>
    </Modal>
  );
}

function Sistema() {
  const avisar = useToast();
  const d = usePlanos();
  const [f, setF] = useState(null);
  const [enviando, setEnviando] = useState(false);
  useEffect(() => {
    if (!d) return;
    const p = Object.fromEntries((d.planos || []).map((x) => [x.id, x]));
    setF({
      preco_mensal: p.mensal?.preco || '', link_mensal: p.mensal?.link || '', preco_trimestral: p.trimestral?.preco || '', link_trimestral: p.trimestral?.link || '',
      preco_anual: p.anual?.preco || '', link_anual: p.anual?.link || '', whatsapp_suporte: d.whatsapp_suporte || '', email_suporte: d.email_suporte || '',
    });
  }, [d]);
  if (!f) return null;
  const m = (k) => (e) => setF({ ...f, [k]: e.target.value });
  const salvar = async () => {
    setEnviando(true);
    try { await api('/admin/sistema', { method: 'PUT', body: f }); avisar('Configurações de venda salvas — já aparecem na página de planos.'); } catch (e) { avisar(e.message, 'erro'); } finally { setEnviando(false); }
  };
  return (
    <div className="card p-4 sm:p-5 space-y-4">
      <h2 className="font-semibold text-white">Planos e links de pagamento (PagSeguro)</h2>
      <p className="text-xs text-slate-500">Se algum link der erro (403/página não encontrada), gere um novo no PagSeguro em “Link de pagamento” e cole aqui.</p>
      {['mensal', 'trimestral', 'anual'].map((p) => (
        <div key={p} className="grid sm:grid-cols-6 gap-3">
          <Campo rotulo={`Preço ${p}`} className="sm:col-span-1"><input className="input num" value={f[`preco_${p}`]} onChange={m(`preco_${p}`)} placeholder="14,90" /></Campo>
          <Campo rotulo={`Link ${p}`} className="sm:col-span-5"><input className="input text-xs" value={f[`link_${p}`]} onChange={m(`link_${p}`)} placeholder="https://pag.ae/…" /></Campo>
        </div>
      ))}
      <div className="grid sm:grid-cols-2 gap-3">
        <Campo rotulo="WhatsApp do suporte" dica="Com DDD, ex.: 11999990000"><input className="input" value={f.whatsapp_suporte} onChange={m('whatsapp_suporte')} /></Campo>
        <Campo rotulo="E-mail do suporte"><input className="input" value={f.email_suporte} onChange={m('email_suporte')} /></Campo>
      </div>
      <div className="flex justify-end"><button className="btn-pri" disabled={enviando} onClick={salvar}>{enviando ? <Loader2 size={15} className="animate-spin" /> : <Save size={15} />}Salvar</button></div>
    </div>
  );
}
