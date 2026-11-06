import { useRef, useState } from 'react';
import { Link, useNavigate, useParams } from 'react-router-dom';
import {
  ArrowLeft, Ban, Building2, Check, CheckCircle2, CircleDollarSign, FileCode2, FileText, Loader2, Mail, Pencil, Phone,
  Plus, RotateCcw, Trash2, Truck, MapPin, Package,
} from 'lucide-react';
import { api } from '../lib/api';
import { Campo, CampoValor, Carregando, ChipVenda, ErroCaixa, Lucro, Modal, useConfirm, useDados, useToast } from '../components/ui';
import { ETAPAS, STATUS_VENDA, corLucro, data, diasAte, dinheiro, hojeIso, numeroBr, pct } from '../lib/fmt';

const ACAO_PROXIMA = {
  empenhada: { rotulo: 'Marcar como comprada', status: 'comprada', dica: 'Já fez o pedido ao fornecedor?' },
  comprada: { rotulo: 'Saiu para entrega', status: 'em_transito', dica: 'O produto já foi despachado?' },
  em_transito: { rotulo: 'Confirmar entrega', status: 'entregue', dica: 'O órgão recebeu o material?' },
  entregue: { rotulo: 'Lançar nota fiscal', nf: true, dica: 'Emita a NF e informe aqui para prever o pagamento.' },
  faturada: { rotulo: 'Registrar pagamento', receber: true, dica: 'O órgão pagou? Registre o valor recebido.' },
};

export default function VendaDetalhe() {
  const { id } = useParams();
  const nav = useNavigate();
  const avisar = useToast();
  const confirmar = useConfirm();
  const { dados, erro, recarregar } = useDados(() => api(`/vendas/${id}`), [id]);
  const [ocupado, setOcupado] = useState(false);
  const [modal, setModal] = useState(null); // 'receber' | 'nf' | 'entrega'

  if (erro) return <ErroCaixa erro={erro} tentar={recarregar} />;
  if (!dados) return <Carregando />;
  const { venda: v, itens, recebimentos, orgao } = dados;
  const passo = STATUS_VENDA[v.status]?.passo ?? 0;
  const cancelada = v.status === 'cancelada';

  const patch = async (body, msg) => {
    setOcupado(true);
    try { await api(`/vendas/${id}`, { method: 'PATCH', body }); if (msg) avisar(msg); await recarregar(); } catch (e) { avisar(e.message, 'erro'); } finally { setOcupado(false); }
  };
  const proxima = ACAO_PROXIMA[v.status];
  const executarProxima = () => {
    if (!proxima) return;
    if (proxima.nf) return setModal('nf');
    if (proxima.receber) return setModal('receber');
    if (proxima.status === 'entregue') return setModal('entrega');
    patch({ status: proxima.status }, `Etapa: ${STATUS_VENDA[proxima.status].rotulo}`);
  };
  const irPara = async (st) => {
    if (st === v.status) return;
    if (st === 'paga' && v.saldo_receber > 0.01) return setModal('receber');
    if (st === 'faturada' && !v.nf_numero) return setModal('nf');
    patch({ status: st }, `Etapa: ${STATUS_VENDA[st].rotulo}`);
  };
  const cancelar = async () => {
    if (cancelada) return patch({ status: 'empenhada' }, 'Venda reativada.');
    if (await confirmar('A venda fica marcada como cancelada e sai dos totais. Você pode reativar depois.', { titulo: 'Cancelar venda?', botao: 'Cancelar venda', perigo: true })) patch({ status: 'cancelada' }, 'Venda cancelada.');
  };
  const excluir = async () => {
    if (!(await confirmar('Apaga a venda, itens, recebimentos e lançamentos de caixa ligados a ela. Não dá para desfazer.', { titulo: 'Excluir venda?', botao: 'Excluir', perigo: true }))) return;
    try { await api(`/vendas/${id}`, { method: 'DELETE' }); avisar('Venda excluída.'); nav('/vendas'); } catch (e) { avisar(e.message, 'erro'); }
  };
  const apagarReceb = async (r) => {
    if (!(await confirmar(`Apagar o recebimento de ${dinheiro(r.valor)} de ${data(r.data)}? O lançamento no caixa também sai.`, { perigo: true, botao: 'Apagar' }))) return;
    try { await api(`/vendas/${id}/recebimentos/${r.id}`, { method: 'DELETE' }); avisar('Recebimento apagado.'); recarregar(); } catch (e) { avisar(e.message, 'erro'); }
  };

  const dE = diasAte(v.data_limite_entrega);
  const dP = diasAte(v.data_prev_pagamento);
  const emEntrega = ['empenhada', 'comprada', 'em_transito'].includes(v.status);
  const recebidoPct = v.valor_total > 0 ? Math.min(100, (v.valor_recebido / v.valor_total) * 100) : 0;

  return (
    <div className="fade-in space-y-4 pb-6">
      {/* topo */}
      <div className="flex items-start gap-3">
        <button onClick={() => nav(-1)} className="p-2 rounded-lg bg-painel2 border border-borda text-slate-400 hover:text-white shrink-0" aria-label="Voltar"><ArrowLeft size={18} /></button>
        <div className="min-w-0 flex-1">
          <div className="flex flex-wrap items-center gap-2"><ChipVenda status={v.status} /><span className="text-xs text-slate-500 num">{v.numero_empenho || 'sem empenho'}</span>{v.portal && <span className="text-xs text-slate-500">· {v.portal}</span>}{v.modalidade && <span className="text-xs text-slate-500">· {v.modalidade}</span>}</div>
          <h1 className="text-lg sm:text-2xl font-bold text-white mt-1 break-words">{v.objeto}</h1>
          <p className="text-sm text-slate-400 truncate">{v.orgao_nome || 'Órgão não informado'}{v.orgao_uasg ? ` · UASG ${v.orgao_uasg}` : ''}</p>
        </div>
        <div className="hidden sm:flex gap-2 shrink-0">
          <Link to={`/vendas/${id}/editar`} className="btn-sec"><Pencil size={15} />Editar</Link>
        </div>
      </div>

      {/* etapas */}
      <div className="card p-4">
        <div className="flex items-center overflow-x-auto pb-1">
          {ETAPAS.map((st, i) => {
            const feito = !cancelada && passo >= i;
            const atual = !cancelada && passo === i;
            return (
              <div key={st} className="flex items-center shrink-0">
                <button disabled={ocupado || cancelada} onClick={() => irPara(st)} title={`Mudar para ${STATUS_VENDA[st].rotulo}`}
                  className={`flex flex-col items-center gap-1 px-1.5 group ${cancelada ? 'opacity-40' : ''}`}>
                  <span className={`w-8 h-8 rounded-full flex items-center justify-center text-xs font-bold border-2 transition
                    ${atual ? 'bg-marca-600 border-marca-400 text-white ring-4 ring-marca-500/20' : feito ? 'bg-emerald-600/80 border-emerald-500 text-white' : 'bg-painel2 border-borda text-slate-500 group-hover:border-marca-500'}`}>
                    {feito && !atual ? <Check size={14} /> : i + 1}
                  </span>
                  <span className={`text-[10px] sm:text-[11px] font-medium whitespace-nowrap ${atual ? 'text-white' : 'text-slate-500'}`}>{STATUS_VENDA[st].rotulo}</span>
                </button>
                {i < ETAPAS.length - 1 && <span className={`h-0.5 w-5 sm:w-12 lg:w-16 mb-5 ${!cancelada && passo > i ? 'bg-emerald-500' : 'bg-borda'}`} />}
              </div>
            );
          })}
        </div>
        {!cancelada && proxima && (
          <div className="mt-3 flex flex-col sm:flex-row sm:items-center justify-between gap-2 rounded-xl bg-marca-500/[0.07] border border-marca-500/25 px-4 py-3">
            <p className="text-sm text-slate-300">{proxima.dica}</p>
            <button className="btn-pri btn-sm sm:btn" disabled={ocupado} onClick={executarProxima}>{ocupado ? <Loader2 size={15} className="animate-spin" /> : <CheckCircle2 size={15} />}{proxima.rotulo}</button>
          </div>
        )}
        {cancelada && <p className="mt-3 text-sm text-slate-400">Esta venda está cancelada e não entra nos totais.</p>}
      </div>

      <div className="grid lg:grid-cols-3 gap-4">
        {/* coluna principal */}
        <div className="lg:col-span-2 space-y-4 min-w-0">
          {/* resultado */}
          <div className={`card p-4 sm:p-5 border-2 ${v.lucro === null ? '' : v.lucro >= 0 ? 'border-emerald-500/30' : 'border-red-500/40'}`}>
            <div className="grid grid-cols-2 sm:grid-cols-4 gap-4">
              <div><p className="label">Valor da venda</p><p className="num text-lg sm:text-xl font-bold text-marca-300">{dinheiro(v.valor_total)}</p></div>
              <div><p className="label">Custo total</p><p className="num text-lg sm:text-xl font-bold text-amber-300">{dinheiro(v.custo_total)}</p>
                <p className="text-[11px] text-slate-500">produtos {dinheiro(v.custo_produtos)}{v.frete > 0 ? ` + frete ${dinheiro(v.frete)}` : ' · frete CIF'}{v.outros_custos > 0 ? ` + outros ${dinheiro(v.outros_custos)}` : ''}</p></div>
              <div><p className="label">{v.lucro !== null && v.lucro < 0 ? 'Prejuízo' : 'Lucro'}</p><p className={`num text-2xl font-extrabold ${corLucro(v.lucro)}`}>{v.lucro === null ? '—' : dinheiro(v.lucro)}</p>
                {v.lucro === null && <Link to={`/vendas/${id}/editar`} className="text-[11px] text-amber-300 underline">informe o custo</Link>}</div>
              <div><p className="label">Margem</p><p className={`num text-lg sm:text-xl font-bold ${corLucro(v.lucro)}`}>{pct(v.margem)}</p>
                {v.itens_sem_custo > 0 && v.lucro !== null && <p className="text-[11px] text-amber-300">{v.itens_sem_custo} item(ns) sem custo</p>}</div>
            </div>
          </div>

          {/* itens */}
          <div className="card overflow-hidden">
            <div className="px-4 sm:px-5 py-3 border-b border-borda flex items-center justify-between"><h2 className="font-semibold text-white flex items-center gap-2"><Package size={16} className="text-marca-400" />Itens ({itens.length})</h2>
              <Link to={`/vendas/${id}/editar`} className="text-xs text-marca-300 hover:underline">editar custos</Link></div>
            <div className="divide-y divide-borda">
              {itens.map((it, i) => {
                const tv = it.quantidade * it.valor_unit;
                const tc = it.custo_unit === null ? null : it.quantidade * it.custo_unit;
                const l = tc === null ? null : tv - tc;
                return (
                  <div key={it.id} className="px-4 sm:px-5 py-3">
                    <p className="text-sm text-slate-200"><span className="text-slate-500 mr-1.5">{i + 1}.</span>{it.descricao}</p>
                    <div className="flex flex-wrap gap-x-5 gap-y-1 mt-1.5 text-xs">
                      <span className="text-slate-400">{numeroBr(it.quantidade, 3)} {it.unidade || 'UN'} × <b className="num text-slate-300">{dinheiro(it.valor_unit)}</b> = <b className="num text-marca-300">{dinheiro(tv)}</b></span>
                      <span className="text-slate-400">custo {it.custo_unit === null ? <i className="text-amber-300/80">não informado</i> : <b className="num text-amber-300">{dinheiro(tc)}</b>}</span>
                      {l !== null && <span className="text-slate-400">lucro <b className={`num ${corLucro(l)}`}>{dinheiro(l)}</b></span>}
                    </div>
                    {it.fornecedor_nome && (
                      <div className="flex flex-wrap items-center gap-x-3 gap-y-1 mt-1.5 text-[11px] text-slate-500">
                        <span className="text-slate-400">Fornecedor: {it.fornecedor_nome}</span>
                        {it.fornecedor_telefone && <a className="inline-flex items-center gap-1 text-marca-300 hover:underline" href={`https://wa.me/55${it.fornecedor_telefone.replace(/\D/g, '').replace(/^55/, '')}`} target="_blank" rel="noreferrer"><Phone size={11} />{it.fornecedor_telefone}</a>}
                        {it.fornecedor_email && <a className="inline-flex items-center gap-1 text-marca-300 hover:underline" href={`mailto:${it.fornecedor_email}`}><Mail size={11} />{it.fornecedor_email}</a>}
                      </div>
                    )}
                  </div>
                );
              })}
            </div>
          </div>

          {/* recebimentos */}
          <div className="card overflow-hidden">
            <div className="px-4 sm:px-5 py-3 border-b border-borda flex items-center justify-between gap-2">
              <h2 className="font-semibold text-white flex items-center gap-2"><CircleDollarSign size={16} className="text-emerald-400" />Recebimentos</h2>
              {!cancelada && v.saldo_receber > 0.01 && <button className="btn-ok btn-sm" onClick={() => setModal('receber')}><Plus size={14} />Registrar</button>}
            </div>
            <div className="px-4 sm:px-5 py-3">
              <div className="flex justify-between text-xs mb-1.5"><span className="text-slate-400">Recebido <b className="num text-emerald-300">{dinheiro(v.valor_recebido)}</b></span><span className="text-slate-400">Falta <b className="num text-amber-300">{dinheiro(v.saldo_receber)}</b></span></div>
              <div className="h-2 rounded-full bg-painel2 overflow-hidden"><div className="h-full bg-emerald-500 rounded-full transition-all" style={{ width: `${recebidoPct}%` }} /></div>
            </div>
            {recebimentos.length > 0 && (
              <div className="divide-y divide-borda border-t border-borda">
                {recebimentos.map((r) => (
                  <div key={r.id} className="px-4 sm:px-5 py-2.5 flex items-center justify-between gap-2 text-sm">
                    <div className="min-w-0"><p className="num text-emerald-300 font-semibold">{dinheiro(r.valor)}</p><p className="text-[11px] text-slate-500 truncate">{data(r.data)} · {r.forma}{r.obs ? ` · ${r.obs}` : ''}</p></div>
                    <button onClick={() => apagarReceb(r)} className="p-1.5 rounded-lg text-slate-500 hover:text-red-300 hover:bg-red-500/10" aria-label="Apagar recebimento"><Trash2 size={14} /></button>
                  </div>
                ))}
              </div>
            )}
          </div>

          {v.obs && <div className="card p-4 sm:p-5"><p className="label">Observações</p><p className="text-sm text-slate-300 whitespace-pre-wrap">{v.obs}</p></div>}
        </div>

        {/* coluna lateral */}
        <div className="space-y-4 min-w-0">
          {/* prazos */}
          <div className="card p-4 space-y-3 text-sm">
            <h2 className="font-semibold text-white flex items-center gap-2"><Truck size={16} className="text-marca-400" />Entrega e pagamento</h2>
            <Linha r="Data do empenho" v={data(v.data_empenho)} />
            <Linha r="Prazo de entrega" v={v.data_limite_entrega ? <span className={emEntrega && dE < 0 ? 'text-red-400 font-semibold' : emEntrega && dE <= 5 ? 'text-amber-300' : ''}>{data(v.data_limite_entrega)}{emEntrega && dE !== null ? ` (${dE < 0 ? `${-dE}d atrasada` : dE === 0 ? 'hoje' : `${dE}d`})` : ''}</span> : '—'} />
            <Linha r="Entregue em" v={data(v.data_entrega)} />
            <Linha r="Nota fiscal" v={v.nf_numero ? `${v.nf_numero} · ${data(v.nf_data)}` : <button className="text-marca-300 underline" onClick={() => setModal('nf')}>lançar NF</button>} />
            <Linha r="Previsão de pagamento" v={v.data_prev_pagamento ? <span className={v.status === 'faturada' && dP < 0 ? 'text-red-400 font-semibold' : ''}>{data(v.data_prev_pagamento)}{v.status === 'faturada' && dP !== null ? ` (${dP < 0 ? `${-dP}d atrasado` : `${dP}d`})` : ''}</span> : '—'} />
            {v.local_entrega && <p className="text-xs text-slate-400 flex gap-1.5 pt-1 border-t border-borda"><MapPin size={13} className="shrink-0 mt-0.5" />{v.local_entrega}</p>}
          </div>

          {/* pagamentos a fazer */}
          <div className="card p-4 space-y-2 text-sm">
            <h2 className="font-semibold text-white mb-1">Contas desta venda</h2>
            <Toggle ativo={v.fornecedor_pago} disabled={ocupado || v.custo_produtos <= 0} onClick={() => patch({ fornecedor_pago: !v.fornecedor_pago }, v.fornecedor_pago ? 'Desmarcado.' : 'Fornecedor pago — saída lançada no caixa.')}
              titulo="Fornecedor pago" sub={v.custo_produtos > 0 ? `${dinheiro(v.custo_produtos)}${v.fornecedor_pago_em ? ` · ${data(v.fornecedor_pago_em)}` : ''}` : 'informe o custo primeiro'} />
            {v.frete > 0 && <Toggle ativo={v.frete_pago} disabled={ocupado} onClick={() => patch({ frete_pago: !v.frete_pago }, v.frete_pago ? 'Desmarcado.' : 'Frete pago — saída lançada no caixa.')}
              titulo="Frete pago" sub={`${dinheiro(v.frete)}${v.frete_pago_em ? ` · ${data(v.frete_pago_em)}` : ''}`} />}
            <p className="text-[11px] text-slate-500">Ao marcar, a saída vai para o caixa automaticamente.</p>
          </div>

          {/* órgão */}
          {orgao && (
            <div className="card p-4 text-sm space-y-1.5">
              <h2 className="font-semibold text-white flex items-center gap-2 mb-1"><Building2 size={16} className="text-marca-400" />Órgão</h2>
              <p className="text-slate-200">{orgao.nome}</p>
              {orgao.cnpj && <p className="text-xs text-slate-500 num">CNPJ {orgao.cnpj}</p>}
              {(orgao.municipio || orgao.uf) && <p className="text-xs text-slate-500">{[orgao.municipio, orgao.uf].filter(Boolean).join(' / ')}</p>}
              {orgao.telefone && <p className="text-xs text-slate-400 flex items-center gap-1"><Phone size={11} />{orgao.telefone}</p>}
              {orgao.email && <a href={`mailto:${orgao.email}`} className="text-xs text-marca-300 flex items-center gap-1"><Mail size={11} />{orgao.email}</a>}
            </div>
          )}

          {/* dados */}
          <div className="card p-4 text-sm space-y-2">
            <h2 className="font-semibold text-white flex items-center gap-2 mb-1"><FileText size={16} className="text-marca-400" />Dados da contratação</h2>
            <Linha r="Processo" v={v.processo || '—'} />
            <Linha r="Nº da compra" v={v.numero_compra || '—'} />
            <Linha r="Modalidade" v={v.modalidade || '—'} />
            <Linha r="Portal" v={v.portal || '—'} />
          </div>

          <div className="flex flex-wrap gap-2">
            <Link to={`/vendas/${id}/editar`} className="btn-sec flex-1 sm:hidden"><Pencil size={15} />Editar</Link>
            <button onClick={cancelar} disabled={ocupado} className="btn-sec flex-1">{cancelada ? <><RotateCcw size={15} />Reativar</> : <><Ban size={15} />Cancelar venda</>}</button>
            <button onClick={excluir} className="btn-perigo flex-1"><Trash2 size={15} />Excluir</button>
          </div>
        </div>
      </div>

      <ModalReceber aberto={modal === 'receber'} fechar={() => setModal(null)} venda={v} pronto={() => { setModal(null); recarregar(); }} />
      <ModalNf aberto={modal === 'nf'} fechar={() => setModal(null)} venda={v} pronto={() => { setModal(null); recarregar(); }} />
      <ModalEntrega aberto={modal === 'entrega'} fechar={() => setModal(null)} salvar={async (d) => { setModal(null); await patch({ status: 'entregue', data_entrega: d }, 'Entrega confirmada.'); }} />
    </div>
  );
}

const Linha = ({ r, v }) => <div className="flex justify-between gap-3"><span className="text-slate-500 shrink-0">{r}</span><span className="text-slate-200 text-right min-w-0 break-words">{v}</span></div>;

function Toggle({ ativo, onClick, titulo, sub, disabled }) {
  return (
    <button disabled={disabled} onClick={onClick} className={`w-full flex items-center gap-3 rounded-xl border px-3 py-2.5 text-left transition disabled:opacity-50 ${ativo ? 'border-emerald-500/40 bg-emerald-500/[0.07]' : 'border-borda bg-painel2 hover:border-slate-500'}`}>
      <span className={`w-5 h-5 rounded-md border-2 flex items-center justify-center shrink-0 ${ativo ? 'bg-emerald-500 border-emerald-500' : 'border-slate-500'}`}>{ativo && <Check size={12} className="text-white" />}</span>
      <span className="min-w-0"><span className="block text-slate-200 font-medium">{titulo}</span><span className="block text-[11px] text-slate-500 num truncate">{sub}</span></span>
    </button>
  );
}

export function ModalReceber({ aberto, fechar, venda, pronto }) {
  const avisar = useToast();
  const [f, setF] = useState({});
  const [enviando, setEnviando] = useState(false);
  const valor = f.valor === undefined ? venda?.saldo_receber : f.valor;
  const salvar = async () => {
    setEnviando(true);
    try {
      await api(`/vendas/${venda.id}/recebimentos`, { method: 'POST', body: { valor, data: f.data || hojeIso(), forma: f.forma || 'Ordem bancária', obs: f.obs } });
      avisar('Recebimento registrado e lançado no caixa.');
      setF({});
      pronto();
    } catch (e) { avisar(e.message, 'erro'); } finally { setEnviando(false); }
  };
  if (!venda) return null;
  return (
    <Modal titulo="Registrar recebimento" aberto={aberto} fechar={fechar} largura="max-w-md"
      rodape={<><button className="btn-sec" onClick={fechar}>Voltar</button><button className="btn-ok" disabled={enviando || !valor} onClick={salvar}>{enviando && <Loader2 size={15} className="animate-spin" />}Registrar</button></>}>
      <div className="space-y-3">
        <p className="text-sm text-slate-400">{venda.objeto} — falta receber <b className="num text-amber-300">{dinheiro(venda.saldo_receber)}</b></p>
        <Campo rotulo="Valor recebido"><CampoValor value={valor} onChange={(x) => setF({ ...f, valor: x })} autoFocus /></Campo>
        <div className="grid grid-cols-2 gap-3">
          <Campo rotulo="Data"><input type="date" className="input" value={f.data || hojeIso()} onChange={(e) => setF({ ...f, data: e.target.value })} /></Campo>
          <Campo rotulo="Forma"><select className="input" value={f.forma || 'Ordem bancária'} onChange={(e) => setF({ ...f, forma: e.target.value })}>{['Ordem bancária', 'PIX', 'Transferência', 'Boleto', 'Outro'].map((x) => <option key={x}>{x}</option>)}</select></Campo>
        </div>
        <Campo rotulo="Observação (opcional)"><input className="input" value={f.obs || ''} onChange={(e) => setF({ ...f, obs: e.target.value })} placeholder="ex.: OB 2026OB000123" /></Campo>
      </div>
    </Modal>
  );
}

function ModalNf({ aberto, fechar, venda, pronto }) {
  const avisar = useToast();
  const arq = useRef(null);
  const [f, setF] = useState({});
  const [enviando, setEnviando] = useState(false);
  const lerXml = async (file) => {
    if (!file) return;
    const form = new FormData(); form.append('arquivo', file);
    setEnviando(true);
    try {
      const { nf } = await api('/importar/nfe', { method: 'POST', form });
      setF({ nf_numero: nf.numero, nf_data: nf.data_emissao, nf_chave: nf.chave, _valor: nf.valor_total });
      avisar(`NF ${nf.numero} lida do XML.`, 'info');
    } catch (e) { avisar(e.message, 'erro'); } finally { setEnviando(false); if (arq.current) arq.current.value = ''; }
  };
  const salvar = async () => {
    setEnviando(true);
    try {
      await api(`/vendas/${venda.id}`, { method: 'PATCH', body: { nf_numero: f.nf_numero, nf_data: f.nf_data || hojeIso(), nf_chave: f.nf_chave || null, data_prev_pagamento: f.data_prev_pagamento || null } });
      avisar('NF lançada. Previsão de pagamento calculada.');
      setF({});
      pronto();
    } catch (e) { avisar(e.message, 'erro'); } finally { setEnviando(false); }
  };
  if (!venda) return null;
  return (
    <Modal titulo="Nota fiscal" aberto={aberto} fechar={fechar} largura="max-w-md"
      rodape={<><button className="btn-sec" onClick={fechar}>Voltar</button><button className="btn-pri" disabled={enviando || !f.nf_numero} onClick={salvar}>{enviando && <Loader2 size={15} className="animate-spin" />}Salvar NF</button></>}>
      <div className="space-y-3">
        <input ref={arq} type="file" accept=".xml,text/xml,application/xml" className="hidden" onChange={(e) => lerXml(e.target.files[0])} />
        <button className="btn-sec w-full border-dashed" onClick={() => arq.current?.click()} disabled={enviando}><FileCode2 size={16} />Ler do XML da NF-e (opcional)</button>
        {f._valor !== undefined && Math.abs(f._valor - venda.valor_total) > 0.05 && <p className="text-xs text-amber-300">Atenção: o valor da NF ({dinheiro(f._valor)}) é diferente do valor da venda ({dinheiro(venda.valor_total)}).</p>}
        <div className="grid grid-cols-2 gap-3">
          <Campo rotulo="Número da NF"><input className="input num" value={f.nf_numero || ''} onChange={(e) => setF({ ...f, nf_numero: e.target.value })} placeholder="ex.: 1234" /></Campo>
          <Campo rotulo="Data de emissão"><input type="date" className="input" value={f.nf_data || hojeIso()} onChange={(e) => setF({ ...f, nf_data: e.target.value })} /></Campo>
        </div>
        <Campo rotulo="Previsão de pagamento" dica="Em branco = data da NF + seus dias padrão (Configurações)."><input type="date" className="input" value={f.data_prev_pagamento || ''} onChange={(e) => setF({ ...f, data_prev_pagamento: e.target.value })} /></Campo>
        {f.nf_chave && <p className="text-[11px] text-slate-500 num break-all">Chave: {f.nf_chave}</p>}
      </div>
    </Modal>
  );
}

function ModalEntrega({ aberto, fechar, salvar }) {
  const [d, setD] = useState(hojeIso());
  return (
    <Modal titulo="Confirmar entrega" aberto={aberto} fechar={fechar} largura="max-w-sm"
      rodape={<><button className="btn-sec" onClick={fechar}>Voltar</button><button className="btn-pri" onClick={() => salvar(d)}>Confirmar</button></>}>
      <Campo rotulo="Data em que o órgão recebeu"><input type="date" className="input" value={d} onChange={(e) => setD(e.target.value)} /></Campo>
    </Modal>
  );
}
