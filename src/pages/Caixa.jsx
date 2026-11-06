import { useState } from 'react';
import { Link } from 'react-router-dom';
import { ArrowDownCircle, ArrowUpCircle, Download, Link2, Loader2, Pencil, Plus, Trash2, Wallet } from 'lucide-react';
import { api } from '../lib/api';
import { Abas, Cabecalho, Campo, CampoValor, ErroCaixa, Kpi, Modal, Spinner, Vazio, useConfirm, useDados, useToast } from '../components/ui';
import { baixarCsv, data, dinheiro, hojeIso } from '../lib/fmt';

const inicioMes = () => hojeIso().slice(0, 8) + '01';
const fimMes = () => { const d = new Date(); return new Date(d.getFullYear(), d.getMonth() + 1, 0).toISOString().slice(0, 10); };

export default function Caixa() {
  const avisar = useToast();
  const confirmar = useConfirm();
  const [f, setF] = useState({ de: inicioMes(), ate: fimMes(), tipo: '', categoria: '' });
  const [form, setForm] = useState(null);
  const qs = new URLSearchParams(Object.entries(f).filter(([, v]) => v)).toString();
  const { dados, erro, recarregar } = useDados(() => api(`/caixa?${qs}`), [qs]);

  const periodo = (tipo) => {
    const d = new Date();
    if (tipo === 'mes') setF({ ...f, de: inicioMes(), ate: fimMes() });
    if (tipo === 'mesant') { const a = new Date(d.getFullYear(), d.getMonth() - 1, 1); const b = new Date(d.getFullYear(), d.getMonth(), 0); setF({ ...f, de: a.toISOString().slice(0, 10), ate: b.toISOString().slice(0, 10) }); }
    if (tipo === 'ano') setF({ ...f, de: `${d.getFullYear()}-01-01`, ate: `${d.getFullYear()}-12-31` });
    if (tipo === 'tudo') setF({ ...f, de: '', ate: '' });
  };
  const excluir = async (m) => {
    if (!(await confirmar(`Excluir "${m.descricao}" (${dinheiro(m.valor)})?`, { perigo: true, botao: 'Excluir' }))) return;
    try { await api(`/caixa/${m.id}`, { method: 'DELETE' }); avisar('Excluído.'); recarregar(); } catch (e) { avisar(e.message, 'erro'); }
  };
  const t = dados?.totais;
  const cats = dados ? [...dados.categorias.saida, ...dados.categorias.entrada.filter((c) => !dados.categorias.saida.includes(c))] : [];
  const maxCat = Math.max(1, ...(dados?.por_categoria || []).map((c) => c.valor));

  return (
    <div className="fade-in">
      <Cabecalho titulo="Caixa e despesas" sub="Entradas e saídas. Recebimentos e pagamentos de fornecedor/frete entram sozinhos; impostos (DAS) você lança aqui.">
        <button className="btn-sec" disabled={!dados?.movimentos?.length} onClick={() => baixarCsv('caixa.csv', dados.movimentos.map((m) => ({ Data: data(m.data), Tipo: m.tipo, Categoria: m.categoria, Descricao: m.descricao, Valor: m.tipo === 'saida' ? -m.valor : m.valor, Origem: m.origem })))}><Download size={16} />Excel</button>
        <button className="btn-sec" onClick={() => setForm({ tipo: 'entrada', categoria: 'Aporte do dono', data: hojeIso(), repetir_meses: 1 })}><ArrowUpCircle size={16} />Entrada</button>
        <button className="btn-pri" onClick={() => setForm({ tipo: 'saida', categoria: 'DAS / Impostos', data: hojeIso(), repetir_meses: 1 })}><Plus size={16} />Despesa</button>
      </Cabecalho>

      {t && (
        <div className="grid grid-cols-2 lg:grid-cols-4 gap-3 mb-4">
          <Kpi titulo="Saldo em caixa" valor={dinheiro(t.saldo_geral)} sub="todos os lançamentos" icone={Wallet} tom={t.saldo_geral >= 0 ? 'marca' : 'vermelho'} />
          <Kpi titulo="Entradas no período" valor={dinheiro(t.entradas)} icone={ArrowUpCircle} tom="verde" />
          <Kpi titulo="Saídas no período" valor={dinheiro(t.saidas)} icone={ArrowDownCircle} tom="vermelho" />
          <Kpi titulo="Resultado do período" valor={dinheiro(t.resultado)} tom={t.resultado >= 0 ? 'verde' : 'vermelho'} />
        </div>
      )}

      <div className="card p-3 sm:p-4 mb-4 space-y-3">
        <div className="flex flex-wrap gap-1.5">
          {[['mes', 'Este mês'], ['mesant', 'Mês passado'], ['ano', 'Este ano'], ['tudo', 'Tudo']].map(([k, r]) => <button key={k} className="btn-sec btn-sm" onClick={() => periodo(k)}>{r}</button>)}
        </div>
        <div className="grid grid-cols-2 sm:grid-cols-4 gap-2">
          <input type="date" className="input" value={f.de} onChange={(e) => setF({ ...f, de: e.target.value })} aria-label="De" />
          <input type="date" className="input" value={f.ate} onChange={(e) => setF({ ...f, ate: e.target.value })} aria-label="Até" />
          <select className="input" value={f.tipo} onChange={(e) => setF({ ...f, tipo: e.target.value })}><option value="">Entradas e saídas</option><option value="entrada">Só entradas</option><option value="saida">Só saídas</option></select>
          <select className="input" value={f.categoria} onChange={(e) => setF({ ...f, categoria: e.target.value })}><option value="">Todas as categorias</option>{cats.map((c) => <option key={c}>{c}</option>)}</select>
        </div>
      </div>

      {erro ? <ErroCaixa erro={erro} tentar={recarregar} /> : !dados ? <div className="flex justify-center py-16"><Spinner tamanho={28} /></div> : (
        <div className="grid lg:grid-cols-3 gap-4">
          <div className="lg:col-span-2 card overflow-hidden min-w-0">
            {dados.movimentos.length === 0 ? <Vazio icone={Wallet} titulo="Nenhum lançamento no período" texto="Lance suas despesas (DAS, contador, internet…) para ver o lucro real." /> : (
              <div className="divide-y divide-borda">
                {dados.movimentos.map((m) => (
                  <div key={m.id} className="px-4 py-3 flex items-center gap-3">
                    <span className={`w-9 h-9 rounded-xl flex items-center justify-center shrink-0 ${m.tipo === 'entrada' ? 'bg-emerald-500/10 text-emerald-300' : 'bg-red-500/10 text-red-300'}`}>{m.tipo === 'entrada' ? <ArrowUpCircle size={17} /> : <ArrowDownCircle size={17} />}</span>
                    <div className="min-w-0 flex-1">
                      <p className="text-sm text-slate-200 truncate">{m.descricao}</p>
                      <p className="text-[11px] text-slate-500 truncate">{data(m.data)} · {m.categoria}{m.origem !== 'manual' && ' · automático'}</p>
                    </div>
                    <p className={`num font-semibold text-sm whitespace-nowrap ${m.tipo === 'entrada' ? 'text-emerald-300' : 'text-red-300'}`}>{m.tipo === 'entrada' ? '+' : '−'}{dinheiro(m.valor)}</p>
                    {m.origem === 'manual' ? (
                      <div className="flex shrink-0">
                        <button onClick={() => setForm({ ...m })} className="p-1.5 rounded-lg text-slate-500 hover:text-white hover:bg-white/5" aria-label="Editar"><Pencil size={14} /></button>
                        <button onClick={() => excluir(m)} className="p-1.5 rounded-lg text-slate-500 hover:text-red-300 hover:bg-red-500/10" aria-label="Excluir"><Trash2 size={14} /></button>
                      </div>
                    ) : m.venda_id ? <Link to={`/vendas/${m.venda_id}`} className="p-1.5 rounded-lg text-slate-500 hover:text-marca-300 shrink-0" title="Ver venda"><Link2 size={14} /></Link> : null}
                  </div>
                ))}
              </div>
            )}
          </div>
          <div className="card p-4 h-fit">
            <h2 className="font-semibold text-white mb-3">Saídas por categoria</h2>
            {dados.por_categoria.length === 0 ? <p className="text-sm text-slate-500">Sem saídas no período.</p> : (
              <div className="space-y-2.5">
                {dados.por_categoria.map((c) => (
                  <div key={c.categoria}>
                    <div className="flex justify-between text-xs mb-1"><span className="text-slate-300 truncate">{c.categoria}</span><span className="num text-slate-400">{dinheiro(c.valor)}</span></div>
                    <div className="h-1.5 rounded-full bg-painel2"><div className="h-full rounded-full bg-red-400/70" style={{ width: `${(c.valor / maxCat) * 100}%` }} /></div>
                  </div>
                ))}
              </div>
            )}
          </div>
        </div>
      )}
      {form && <FormLancamento inicial={form} categorias={dados?.categorias} fechar={() => setForm(null)} salvo={() => { setForm(null); recarregar(); }} />}
    </div>
  );
}

function FormLancamento({ inicial, categorias, fechar, salvo }) {
  const avisar = useToast();
  const [f, setF] = useState(inicial);
  const [enviando, setEnviando] = useState(false);
  const lista = categorias?.[f.tipo] || [];
  const salvar = async () => {
    setEnviando(true);
    try {
      if (f.id) await api(`/caixa/${f.id}`, { method: 'PUT', body: f }); else await api('/caixa', { method: 'POST', body: f });
      avisar(f.repetir_meses > 1 ? `${f.repetir_meses} lançamentos criados.` : 'Lançamento salvo.');
      salvo();
    } catch (e) { avisar(e.message, 'erro'); } finally { setEnviando(false); }
  };
  return (
    <Modal titulo={f.id ? 'Editar lançamento' : f.tipo === 'entrada' ? 'Nova entrada' : 'Nova despesa'} aberto fechar={fechar} largura="max-w-md"
      rodape={<><button className="btn-sec" onClick={fechar}>Voltar</button><button className="btn-pri" disabled={enviando} onClick={salvar}>{enviando && <Loader2 size={15} className="animate-spin" />}Salvar</button></>}>
      <div className="space-y-3">
        <Abas abas={[{ id: 'saida', rotulo: 'Saída / despesa' }, { id: 'entrada', rotulo: 'Entrada' }]} valor={f.tipo} mudar={(tipo) => setF({ ...f, tipo, categoria: categorias?.[tipo]?.[0] || 'Outros' })} />
        <Campo rotulo="Descrição"><input className="input" value={f.descricao || ''} onChange={(e) => setF({ ...f, descricao: e.target.value })} placeholder={f.tipo === 'saida' ? 'ex.: DAS MEI outubro' : 'ex.: Aporte para comprar mercadoria'} autoFocus /></Campo>
        <div className="grid grid-cols-2 gap-3">
          <Campo rotulo="Valor"><CampoValor value={f.valor} onChange={(valor) => setF({ ...f, valor })} /></Campo>
          <Campo rotulo="Data"><input type="date" className="input" value={f.data || hojeIso()} onChange={(e) => setF({ ...f, data: e.target.value })} /></Campo>
        </div>
        <Campo rotulo="Categoria"><select className="input" value={f.categoria} onChange={(e) => setF({ ...f, categoria: e.target.value })}>{lista.map((c) => <option key={c}>{c}</option>)}</select></Campo>
        {!f.id && <Campo rotulo="Repetir todo mês" dica="Útil para DAS, contador, internet. Cria um lançamento por mês."><select className="input" value={f.repetir_meses} onChange={(e) => setF({ ...f, repetir_meses: Number(e.target.value) })}>{[1, 2, 3, 6, 12, 24].map((n) => <option key={n} value={n}>{n === 1 ? 'Não repetir' : `${n} meses`}</option>)}</select></Campo>}
      </div>
    </Modal>
  );
}
