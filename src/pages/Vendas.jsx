import { useEffect, useMemo, useState } from 'react';
import { Link, useNavigate, useSearchParams } from 'react-router-dom';
import { Download, FileUp, Plus, Search, ShoppingCart, X } from 'lucide-react';
import { api } from '../lib/api';
import { Abas, Cabecalho, ChipVenda, ErroCaixa, Lucro, Spinner, Vazio, useDados } from '../components/ui';
import { PORTAIS, STATUS_VENDA, baixarCsv, data, diasAte, dinheiro } from '../lib/fmt';

const SITUACOES = {
  entrega_atrasada: 'Entrega atrasada', pagamento_atrasado: 'Pagamento atrasado', sem_custo: 'Sem custo informado',
  prejuizo: 'Com prejuízo', fornecedor_a_pagar: 'Fornecedor a pagar',
};

export default function Vendas() {
  const [sp, setSp] = useSearchParams();
  const nav = useNavigate();
  const [busca, setBusca] = useState(sp.get('busca') || '');
  const filtros = Object.fromEntries(sp.entries());
  const chave = sp.toString();
  const { dados, carregando, erro, recarregar } = useDados(() => api(`/vendas?${chave}`), [chave]);

  useEffect(() => {
    const t = setTimeout(() => { if ((sp.get('busca') || '') !== busca) mudar('busca', busca); }, 350);
    return () => clearTimeout(t);
  }, [busca]); // eslint-disable-line

  const mudar = (k, val) => {
    const n = new URLSearchParams(sp);
    if (val) n.set(k, val); else n.delete(k);
    setSp(n, { replace: true });
  };

  const abas = useMemo(() => [
    { id: '', rotulo: 'Todas' }, { id: 'abertas', rotulo: 'Em andamento' },
    ...Object.entries(STATUS_VENDA).map(([id, s]) => ({ id, rotulo: s.rotulo })),
  ], []);

  const exportar = () => baixarCsv(`vendas_nexusgov_${new Date().toISOString().slice(0, 10)}.csv`, (dados?.vendas || []).map((v) => ({
    Data: data(v.data_empenho), Empenho: v.numero_empenho, Objeto: v.objeto, Orgao: v.orgao_nome, UASG: v.orgao_uasg, Portal: v.portal,
    Modalidade: v.modalidade, Etapa: STATUS_VENDA[v.status]?.rotulo, Valor: v.valor_total, Custo: v.custo_total, Lucro: v.lucro, Margem: v.margem,
    Recebido: v.valor_recebido, 'A receber': v.saldo_receber, NF: v.nf_numero, 'Data NF': data(v.nf_data), 'Prev. pagamento': data(v.data_prev_pagamento),
  })));

  const t = dados?.totais;

  return (
    <div className="fade-in">
      <Cabecalho titulo="Vendas e empenhos" sub="Cada venda com etapa, prazo, recebimento e lucro.">
        <button className="btn-sec" onClick={exportar} disabled={!dados?.vendas?.length}><Download size={16} />Excel</button>
        <Link to="/vendas/nova" className="btn-sec"><Plus size={16} />Manual</Link>
        <Link to="/vendas/nova?importar=1" className="btn-pri"><FileUp size={16} />Importar empenho</Link>
      </Cabecalho>

      <div className="card p-3 sm:p-4 space-y-3 mb-4">
        <Abas abas={abas} valor={filtros.status || ''} mudar={(v) => mudar('status', v)} />
        <div className="grid sm:grid-cols-4 gap-2">
          <div className="relative sm:col-span-2">
            <Search size={15} className="absolute left-3 top-1/2 -translate-y-1/2 text-slate-500" />
            <input className="input pl-9" placeholder="Buscar objeto, empenho, órgão, UASG, item, NF…" value={busca} onChange={(e) => setBusca(e.target.value)} />
          </div>
          <select className="input" value={filtros.portal || ''} onChange={(e) => mudar('portal', e.target.value)}>
            <option value="">Todos os portais</option>{PORTAIS.map((p) => <option key={p}>{p}</option>)}
          </select>
          <select className="input" value={filtros.ordem || ''} onChange={(e) => mudar('ordem', e.target.value)}>
            <option value="">Mais recentes</option><option value="valor">Maior valor</option><option value="lucro">Maior lucro</option>
            <option value="entrega">Prazo de entrega</option><option value="pagamento">Previsão de pagamento</option>
          </select>
        </div>
        <div className="flex flex-wrap gap-1.5">
          {Object.entries(SITUACOES).map(([k, r]) => (
            <button key={k} onClick={() => mudar('situacao', filtros.situacao === k ? '' : k)}
              className={`chip ${filtros.situacao === k ? 'bg-marca-600 border-marca-500 text-white' : 'bg-painel2 border-borda text-slate-400 hover:text-white'}`}>
              {r}{filtros.situacao === k && <X size={11} />}
            </button>
          ))}
        </div>
      </div>

      {t && (
        <div className="grid grid-cols-2 sm:grid-cols-5 gap-2 mb-4">
          {[['Vendas', t.quantidade, 'text-white', false], ['Valor', t.valor_total, 'text-marca-300', true], ['Recebido', t.recebido, 'text-emerald-300', true],
            ['A receber', t.a_receber, 'text-amber-300', true], ['Lucro', t.lucro, t.lucro >= 0 ? 'text-emerald-400' : 'text-red-400', true]].map(([r, val, c, m]) => (
            <div key={r} className="rounded-xl bg-painel border border-borda px-3 py-2.5"><p className="text-[10px] uppercase tracking-wider text-slate-500 font-semibold">{r}</p><p className={`num font-bold ${c} truncate`}>{m ? dinheiro(val) : val}</p></div>
          ))}
        </div>
      )}

      {erro ? <ErroCaixa erro={erro} tentar={recarregar} /> : !dados ? <div className="flex justify-center py-16"><Spinner tamanho={28} /></div> : dados.vendas.length === 0 ? (
        <div className="card"><Vazio icone={ShoppingCart} titulo="Nenhuma venda encontrada" texto={chave ? 'Tente outro filtro.' : 'Importe o PDF do seu primeiro empenho.'}
          acao={<Link to="/vendas/nova?importar=1" className="btn-pri"><FileUp size={16} />Importar empenho</Link>} /></div>
      ) : (
        <>
          {/* tabela (computador) */}
          <div className={`card overflow-hidden hidden md:block ${carregando ? 'opacity-60' : ''}`}>
            <div className="overflow-x-auto">
              <table className="tabela">
                <thead><tr><th>Venda</th><th>Órgão</th><th>Etapa</th><th className="text-right">Valor</th><th className="text-right">Lucro</th><th className="text-right">A receber</th><th>Prazo</th></tr></thead>
                <tbody>
                  {dados.vendas.map((v) => {
                    const dE = diasAte(v.data_limite_entrega);
                    const emEntrega = ['empenhada', 'comprada', 'em_transito'].includes(v.status);
                    const dP = diasAte(v.data_prev_pagamento);
                    return (
                      <tr key={v.id} className="cursor-pointer" onClick={() => nav(`/vendas/${v.id}`)}>
                        <td className="max-w-[260px]"><p className="font-medium text-white truncate">{v.objeto}</p><p className="text-[11px] text-slate-500 num">{v.numero_empenho || 'sem empenho'} · {data(v.data_empenho)}</p></td>
                        <td className="max-w-[220px]"><p className="text-slate-300 truncate">{v.orgao_nome || '—'}</p><p className="text-[11px] text-slate-500">{v.orgao_uasg ? `UASG ${v.orgao_uasg} · ` : ''}{v.portal}</p></td>
                        <td><ChipVenda status={v.status} /></td>
                        <td className="text-right num text-marca-300">{dinheiro(v.valor_total)}</td>
                        <td className="text-right"><Lucro valor={v.lucro} margem={v.margem} /></td>
                        <td className="text-right num">{v.saldo_receber > 0 && v.status !== 'cancelada' ? <span className="text-amber-300">{dinheiro(v.saldo_receber)}</span> : <span className="text-slate-600">—</span>}</td>
                        <td className="text-xs whitespace-nowrap">
                          {emEntrega && v.data_limite_entrega ? <span className={dE < 0 ? 'text-red-400 font-semibold' : dE <= 5 ? 'text-amber-300' : 'text-slate-400'}>Entrega {data(v.data_limite_entrega)}</span>
                            : v.status === 'faturada' && v.data_prev_pagamento ? <span className={dP < 0 ? 'text-red-400 font-semibold' : 'text-slate-400'}>Pgto {data(v.data_prev_pagamento)}</span>
                              : <span className="text-slate-600">—</span>}
                        </td>
                      </tr>
                    );
                  })}
                </tbody>
              </table>
            </div>
          </div>
          {/* cartões (celular) */}
          <div className="md:hidden space-y-2">
            {dados.vendas.map((v) => (
              <Link key={v.id} to={`/vendas/${v.id}`} className="card p-4 block active:bg-white/[0.03]">
                <div className="flex items-start justify-between gap-2">
                  <div className="min-w-0"><p className="font-semibold text-white truncate">{v.objeto}</p><p className="text-xs text-slate-500 truncate">{v.orgao_nome || '—'}</p></div>
                  <ChipVenda status={v.status} />
                </div>
                <div className="grid grid-cols-3 gap-2 mt-3 text-xs">
                  <div><p className="text-slate-500">Valor</p><p className="num text-marca-300">{dinheiro(v.valor_total)}</p></div>
                  <div><p className="text-slate-500">Lucro</p><Lucro valor={v.lucro} /></div>
                  <div><p className="text-slate-500">A receber</p><p className="num text-amber-300">{v.saldo_receber > 0 ? dinheiro(v.saldo_receber) : '—'}</p></div>
                </div>
                <p className="text-[11px] text-slate-500 mt-2 num">{v.numero_empenho || 'sem empenho'} · {data(v.data_empenho)}</p>
              </Link>
            ))}
          </div>
        </>
      )}
    </div>
  );
}
