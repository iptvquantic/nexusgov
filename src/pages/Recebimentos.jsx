import { useState } from 'react';
import { Link } from 'react-router-dom';
import { CircleDollarSign, Download, HandCoins } from 'lucide-react';
import { api } from '../lib/api';
import { Abas, Cabecalho, ChipVenda, ErroCaixa, Kpi, Spinner, Vazio, useDados } from '../components/ui';
import { ModalReceber } from './VendaDetalhe';
import { baixarCsv, data, diasAte, dinheiro } from '../lib/fmt';

export default function Recebimentos() {
  const [aba, setAba] = useState('receber');
  const [receber, setReceber] = useState(null);
  const { dados, erro, recarregar } = useDados(() => api('/recebimentos'), []);

  if (erro) return <ErroCaixa erro={erro} tentar={recarregar} />;
  const lista = dados?.a_receber || [];
  const total = lista.reduce((s, v) => s + v.saldo_receber, 0);
  const atrasado = lista.filter((v) => v.data_prev_pagamento && diasAte(v.data_prev_pagamento) < 0).reduce((s, v) => s + v.saldo_receber, 0);
  const em30 = lista.filter((v) => { const d = diasAte(v.data_prev_pagamento); return d !== null && d >= 0 && d <= 30; }).reduce((s, v) => s + v.saldo_receber, 0);

  return (
    <div className="fade-in">
      <Cabecalho titulo="A receber" sub="O que os órgãos ainda devem pagar e o histórico de pagamentos recebidos.">
        <button className="btn-sec" disabled={!dados} onClick={() => baixarCsv('recebimentos.csv', (aba === 'receber' ? lista : dados.recebimentos).map((r) => (aba === 'receber'
          ? { Objeto: r.objeto, Empenho: r.numero_empenho, Orgao: r.orgao_nome, Valor: r.valor_total, Recebido: r.valor_recebido, 'A receber': r.saldo_receber, NF: r.nf_numero, 'Previsao': data(r.data_prev_pagamento) }
          : { Data: data(r.data), Valor: r.valor, Forma: r.forma, Objeto: r.objeto, Empenho: r.numero_empenho, Orgao: r.orgao_nome, Obs: r.obs })))}><Download size={16} />Excel</button>
      </Cabecalho>

      <div className="grid grid-cols-2 lg:grid-cols-4 gap-3 mb-4">
        <Kpi titulo="Total a receber" valor={dinheiro(total)} sub={`${lista.length} venda(s)`} icone={HandCoins} tom="ambar" />
        <Kpi titulo="Atrasado" valor={dinheiro(atrasado)} sub="previsão já passou" tom="vermelho" />
        <Kpi titulo="Próximos 30 dias" valor={dinheiro(em30)} tom="marca" />
        <Kpi titulo="Já recebido" valor={dinheiro(dados?.total)} sub={`${dados?.recebimentos?.length || 0} pagamento(s)`} icone={CircleDollarSign} tom="verde" />
      </div>

      <div className="mb-3"><Abas abas={[{ id: 'receber', rotulo: 'A receber', qtd: lista.length }, { id: 'historico', rotulo: 'Histórico', qtd: dados?.recebimentos?.length }]} valor={aba} mudar={setAba} /></div>

      {!dados ? <div className="flex justify-center py-16"><Spinner tamanho={28} /></div> : aba === 'receber' ? (
        lista.length === 0 ? <div className="card"><Vazio icone={HandCoins} titulo="Nada a receber" texto="Todas as vendas estão pagas. 🎉" /></div> : (
          <div className="space-y-2">
            {lista.map((v) => {
              const d = diasAte(v.data_prev_pagamento);
              return (
                <div key={v.id} className="card p-4 flex flex-col sm:flex-row sm:items-center gap-3">
                  <Link to={`/vendas/${v.id}`} className="min-w-0 flex-1">
                    <div className="flex items-center gap-2 flex-wrap"><ChipVenda status={v.status} />{v.nf_numero && <span className="text-[11px] text-slate-500">NF {v.nf_numero}</span>}</div>
                    <p className="font-medium text-white truncate mt-1">{v.objeto}</p>
                    <p className="text-xs text-slate-500 truncate">{v.orgao_nome || '—'} · {v.numero_empenho || 'sem empenho'}</p>
                  </Link>
                  <div className="flex items-center justify-between sm:justify-end gap-4">
                    <div className="text-right">
                      <p className="num font-bold text-amber-300">{dinheiro(v.saldo_receber)}</p>
                      <p className={`text-[11px] ${d === null ? 'text-slate-500' : d < 0 ? 'text-red-400 font-semibold' : d <= 7 ? 'text-amber-300' : 'text-slate-400'}`}>
                        {v.data_prev_pagamento ? `${d < 0 ? `atrasado ${-d}d` : d === 0 ? 'hoje' : `em ${d}d`} · ${data(v.data_prev_pagamento)}` : 'sem NF ainda'}
                      </p>
                    </div>
                    <button className="btn-ok btn-sm shrink-0" onClick={() => setReceber(v)}>Recebi</button>
                  </div>
                </div>
              );
            })}
          </div>
        )
      ) : dados.recebimentos.length === 0 ? <div className="card"><Vazio titulo="Nenhum recebimento ainda" /></div> : (
        <div className="card overflow-hidden"><div className="overflow-x-auto">
          <table className="tabela">
            <thead><tr><th>Data</th><th>Venda</th><th className="hidden sm:table-cell">Forma</th><th className="text-right">Valor</th></tr></thead>
            <tbody>
              {dados.recebimentos.map((r) => (
                <tr key={r.id}>
                  <td className="num whitespace-nowrap">{data(r.data)}</td>
                  <td className="max-w-[300px]"><Link to={`/vendas/${r.venda_id}`} className="block"><p className="text-slate-200 truncate">{r.objeto}</p><p className="text-[11px] text-slate-500 truncate">{r.orgao_nome}</p></Link></td>
                  <td className="hidden sm:table-cell text-slate-400">{r.forma}</td>
                  <td className="text-right num text-emerald-300 font-semibold">{dinheiro(r.valor)}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div></div>
      )}
      {receber && <ModalReceber aberto venda={receber} fechar={() => setReceber(null)} pronto={() => { setReceber(null); recarregar(); }} />}
    </div>
  );
}
