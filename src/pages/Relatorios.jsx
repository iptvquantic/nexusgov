import { useState } from 'react';
import { Link } from 'react-router-dom';
import { Download, Printer } from 'lucide-react';
import { api } from '../lib/api';
import { Abas, Cabecalho, ChipVenda, ErroCaixa, Lucro, Spinner, useDados } from '../components/ui';
import { baixarCsv, corLucro, data, dinheiro, hojeIso, pct } from '../lib/fmt';

const ano = new Date().getFullYear();

export default function Relatorios() {
  const [p, setP] = useState({ de: `${ano}-01-01`, ate: hojeIso() });
  const [aba, setAba] = useState('orgao');
  const { dados, erro, recarregar } = useDados(() => api(`/painel/relatorio?de=${p.de}&ate=${p.ate}`), [p.de, p.ate]);
  const atalho = (k) => {
    const d = new Date();
    const iso = (x) => x.toISOString().slice(0, 10);
    if (k === 'mes') setP({ de: iso(new Date(d.getFullYear(), d.getMonth(), 1)), ate: hojeIso() });
    if (k === 'tri') setP({ de: iso(new Date(d.getFullYear(), Math.floor(d.getMonth() / 3) * 3, 1)), ate: hojeIso() });
    if (k === 'ano') setP({ de: `${d.getFullYear()}-01-01`, ate: hojeIso() });
    if (k === 'anoant') setP({ de: `${d.getFullYear() - 1}-01-01`, ate: `${d.getFullYear() - 1}-12-31` });
    if (k === '12m') { const a = new Date(d); a.setFullYear(a.getFullYear() - 1); setP({ de: iso(a), ate: hojeIso() }); }
  };
  const t = dados?.totais;
  const grupos = { orgao: dados?.por_orgao, portal: dados?.por_portal, modalidade: dados?.por_modalidade };

  return (
    <div className="fade-in">
      <Cabecalho titulo="Relatórios" sub="Resultado do período: vendas, custos, lucro, despesas e de onde vem o dinheiro.">
        <button className="btn-sec" onClick={() => window.print()}><Printer size={16} />Imprimir / PDF</button>
        <button className="btn-pri" disabled={!dados?.vendas?.length} onClick={() => baixarCsv(`relatorio_${p.de}_${p.ate}.csv`, dados.vendas.map((v) => ({
          Data: data(v.data_empenho), Empenho: v.numero_empenho, Objeto: v.objeto, Orgao: v.orgao_nome, Portal: v.portal, Modalidade: v.modalidade, Etapa: v.status,
          Valor: v.valor_total, 'Custo produtos': v.custo_produtos, Frete: v.frete, Outros: v.outros_custos, 'Custo total': v.custo_total, Lucro: v.lucro, Margem: v.margem,
          Recebido: v.valor_recebido, 'A receber': v.saldo_receber, NF: v.nf_numero,
        })))}><Download size={16} />Excel</button>
      </Cabecalho>

      <div className="card p-3 sm:p-4 mb-4 flex flex-col sm:flex-row sm:items-center gap-3 print:hidden">
        <div className="flex flex-wrap gap-1.5">{[['mes', 'Este mês'], ['tri', 'Trimestre'], ['ano', 'Este ano'], ['12m', '12 meses'], ['anoant', 'Ano passado']].map(([k, r]) => <button key={k} className="btn-sec btn-sm" onClick={() => atalho(k)}>{r}</button>)}</div>
        <div className="grid grid-cols-2 gap-2 sm:ml-auto">
          <input type="date" className="input" value={p.de} onChange={(e) => setP({ ...p, de: e.target.value })} aria-label="De" />
          <input type="date" className="input" value={p.ate} onChange={(e) => setP({ ...p, ate: e.target.value })} aria-label="Até" />
        </div>
      </div>

      {erro ? <ErroCaixa erro={erro} tentar={recarregar} /> : !dados ? <div className="flex justify-center py-16"><Spinner tamanho={28} /></div> : (
        <div className="space-y-4">
          <p className="text-xs text-slate-500">Período {data(dados.periodo.de)} a {data(dados.periodo.ate)} · pela data do empenho</p>
          {/* DRE simples */}
          <div className="card p-4 sm:p-6">
            <h2 className="font-semibold text-white mb-4">Resultado do período</h2>
            <div className="space-y-2 text-sm max-w-xl">
              <LinhaDre r={`Vendas (${t.vendas})`} v={t.vendido} cor="text-marca-300" />
              <LinhaDre r="(−) Custos (produtos + frete + outros)" v={-t.custo} cor="text-amber-300" />
              <LinhaDre r="= Lucro bruto das vendas" v={t.lucro_bruto} cor={corLucro(t.lucro_bruto)} forte extra={t.margem !== null ? `margem ${pct(t.margem)}` : null} />
              <LinhaDre r="(−) Despesas lançadas no caixa (DAS, contador…)" v={-t.despesas} cor="text-red-300" />
              <div className={`flex justify-between items-baseline gap-3 rounded-xl px-4 py-3 mt-2 border-2 ${t.resultado >= 0 ? 'border-emerald-500/40 bg-emerald-500/[0.06]' : 'border-red-500/40 bg-red-500/[0.06]'}`}>
                <span className="font-semibold text-white">= Lucro líquido</span><span className={`num text-xl font-extrabold ${corLucro(t.resultado)}`}>{dinheiro(t.resultado)}</span>
              </div>
            </div>
            <div className="grid grid-cols-2 sm:grid-cols-3 gap-3 mt-5 pt-4 border-t border-borda text-sm">
              <div><p className="label">Recebido no período</p><p className="num font-bold text-emerald-300">{dinheiro(t.recebido_periodo)}</p></div>
              <div><p className="label">Ainda a receber</p><p className="num font-bold text-amber-300">{dinheiro(t.a_receber)}</p></div>
              {t.vendas_sem_custo > 0 && <div><p className="label">Vendas sem custo</p><Link to="/vendas?situacao=sem_custo" className="num font-bold text-amber-300 underline">{t.vendas_sem_custo} — informar</Link></div>}
            </div>
          </div>

          <div className="grid lg:grid-cols-2 gap-4">
            <div className="card p-4 min-w-0">
              <div className="mb-3"><Abas abas={[{ id: 'orgao', rotulo: 'Por órgão' }, { id: 'portal', rotulo: 'Por portal' }, { id: 'modalidade', rotulo: 'Por modalidade' }]} valor={aba} mudar={setAba} /></div>
              <Ranking linhas={grupos[aba] || []} />
            </div>
            <div className="card p-4 min-w-0">
              <h2 className="font-semibold text-white mb-3">Despesas por categoria</h2>
              {dados.despesas.length === 0 ? <p className="text-sm text-slate-500">Nenhuma despesa lançada no período.</p> : (
                <div className="space-y-2">{dados.despesas.map((d) => <div key={d.categoria} className="flex justify-between text-sm"><span className="text-slate-300">{d.categoria} <span className="text-slate-500 text-xs">({d.qtd})</span></span><span className="num text-red-300">{dinheiro(d.valor)}</span></div>)}</div>
              )}
              <h2 className="font-semibold text-white mt-6 mb-3">Compras por fornecedor</h2>
              {dados.por_fornecedor.length === 0 ? <p className="text-sm text-slate-500">—</p> : (
                <div className="space-y-2">{dados.por_fornecedor.map((f) => <div key={f.nome} className="flex justify-between gap-3 text-sm"><span className="text-slate-300 truncate">{f.nome} <span className="text-slate-500 text-xs">({f.vendas})</span></span><span className="num text-amber-300 shrink-0">{dinheiro(f.comprado)}</span></div>)}</div>
              )}
            </div>
          </div>

          <div className="card overflow-hidden">
            <h2 className="font-semibold text-white px-4 pt-4 pb-2">Vendas do período ({dados.vendas.length})</h2>
            <div className="overflow-x-auto">
              <table className="tabela">
                <thead><tr><th>Data</th><th>Venda</th><th>Etapa</th><th className="text-right">Valor</th><th className="text-right">Custo</th><th className="text-right">Lucro</th></tr></thead>
                <tbody>
                  {dados.vendas.map((v) => (
                    <tr key={v.id}>
                      <td className="num whitespace-nowrap">{data(v.data_empenho)}</td>
                      <td className="max-w-[280px]"><Link to={`/vendas/${v.id}`}><p className="text-slate-200 truncate">{v.objeto}</p><p className="text-[11px] text-slate-500 truncate">{v.orgao_nome}</p></Link></td>
                      <td><ChipVenda status={v.status} /></td>
                      <td className="text-right num text-marca-300">{dinheiro(v.valor_total)}</td>
                      <td className="text-right num text-amber-300">{v.lucro === null ? '—' : dinheiro(v.custo_total)}</td>
                      <td className="text-right"><Lucro valor={v.lucro} margem={v.margem} /></td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}

const LinhaDre = ({ r, v, cor, forte, extra }) => (
  <div className={`flex justify-between items-baseline gap-3 ${forte ? 'pt-2 border-t border-borda' : ''}`}>
    <span className={forte ? 'text-white font-semibold' : 'text-slate-400'}>{r}{extra && <span className="text-xs text-slate-500 ml-2">{extra}</span>}</span>
    <span className={`num ${forte ? 'font-bold' : ''} ${cor}`}>{dinheiro(v)}</span>
  </div>
);

function Ranking({ linhas }) {
  if (!linhas.length) return <p className="text-sm text-slate-500">Sem vendas no período.</p>;
  const max = Math.max(1, ...linhas.map((l) => l.valor || 0));
  return (
    <div className="space-y-3">
      {linhas.map((l, i) => (
        <div key={i}>
          <div className="flex justify-between gap-3 text-sm"><span className="text-slate-300 truncate">{l.nome || '—'} <span className="text-slate-500 text-xs">({l.vendas})</span></span>
            <span className="shrink-0 text-right"><span className="num text-marca-300">{dinheiro(l.valor)}</span> <span className={`num text-xs ${corLucro(l.lucro)}`}>{l.lucro === null ? '' : `lucro ${dinheiro(l.lucro)}`}</span></span></div>
          <div className="h-1.5 rounded-full bg-painel2 mt-1"><div className="h-full rounded-full bg-marca-500" style={{ width: `${(l.valor / max) * 100}%` }} /></div>
        </div>
      ))}
    </div>
  );
}
