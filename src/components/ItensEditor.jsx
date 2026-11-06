import { Plus, Trash2, Wand2 } from 'lucide-react';
import { CampoValor } from './ui';
import { corLucro, dinheiro, pct } from '../lib/fmt';

export const itemVazio = () => ({ _k: Math.random(), descricao: '', unidade: 'UN', quantidade: 1, valor_unit: null, custo_unit: null, fornecedor_id: '' });

// modo: 'venda' (valor_unit) | 'cotacao' (preco_unit + preco_referencia)
export default function ItensEditor({ itens, setItens, fornecedores = [], modo = 'venda', margemAlvo = 30 }) {
  const campoPreco = modo === 'venda' ? 'valor_unit' : 'preco_unit';
  const mudar = (i, k, v) => setItens(itens.map((it, j) => (j === i ? { ...it, [k]: v } : it)));
  const remover = (i) => setItens(itens.filter((_, j) => j !== i));
  const sugerir = (i) => {
    const it = itens[i];
    if (!it.custo_unit) return;
    const m = Math.min(Math.max(Number(margemAlvo) || 0, 0), 90) / 100;
    mudar(i, campoPreco, Math.round((it.custo_unit / (1 - m)) * 100) / 100);
  };

  return (
    <div className="space-y-3">
      {itens.map((it, i) => {
        const qtd = Number(it.quantidade) || 0;
        const venda = qtd * (Number(it[campoPreco]) || 0);
        const temCusto = it.custo_unit !== null && it.custo_unit !== undefined && it.custo_unit !== '';
        const custo = qtd * (Number(it.custo_unit) || 0);
        const lucro = temCusto ? venda - custo : null;
        const margem = temCusto && venda > 0 ? (lucro / venda) * 100 : null;
        return (
          <div key={it._k || it.id || i} className="rounded-xl border border-borda bg-painel2/50 p-3 sm:p-4">
            <div className="flex items-start gap-2">
              <span className="w-7 h-7 rounded-lg bg-painel border border-borda text-xs font-bold text-slate-400 flex items-center justify-center shrink-0 mt-0.5">{i + 1}</span>
              <textarea className="input min-h-[42px] resize-y" rows={1} placeholder="Descrição do item (ex.: Fio elétrico flexível 2,5mm preto)"
                value={it.descricao} onChange={(e) => mudar(i, 'descricao', e.target.value)} />
              {itens.length > 1 && (
                <button type="button" onClick={() => remover(i)} className="p-2 rounded-lg text-slate-500 hover:text-red-300 hover:bg-red-500/10 shrink-0" aria-label="Remover item"><Trash2 size={16} /></button>
              )}
            </div>
            <div className="grid grid-cols-2 sm:grid-cols-6 gap-2 mt-3 sm:pl-9">
              <label className="col-span-1"><span className="label">Qtd.</span><CampoValor value={it.quantidade} onChange={(v) => mudar(i, 'quantidade', v)} placeholder="1" /></label>
              <label className="col-span-1"><span className="label">Unid.</span><input className="input" value={it.unidade || ''} onChange={(e) => mudar(i, 'unidade', e.target.value)} placeholder="UN" /></label>
              <label className="col-span-1"><span className="label">{modo === 'venda' ? 'Valor unit. venda' : 'Meu preço unit.'}</span>
                <div className="flex gap-1">
                  <CampoValor value={it[campoPreco]} onChange={(v) => mudar(i, campoPreco, v)} />
                  {modo === 'cotacao' && <button type="button" title={`Calcular preço com ${margemAlvo}% de margem`} onClick={() => sugerir(i)} className="px-2 rounded-lg bg-marca-600/20 text-marca-300 hover:bg-marca-600/30 shrink-0"><Wand2 size={14} /></button>}
                </div>
              </label>
              <label className="col-span-1"><span className="label text-amber-300/80">Custo unit. (fornecedor)</span><CampoValor value={it.custo_unit} onChange={(v) => mudar(i, 'custo_unit', v)} placeholder="custo" className="border-amber-500/30" /></label>
              <label className="col-span-2"><span className="label">Fornecedor</span>
                <select className="input" value={it.fornecedor_id || ''} onChange={(e) => mudar(i, 'fornecedor_id', e.target.value)}>
                  <option value="">—</option>
                  {fornecedores.map((f) => <option key={f.id} value={f.id}>{f.nome}{f.produtos ? ` · ${f.produtos.slice(0, 30)}` : ''}</option>)}
                </select>
              </label>
              {modo === 'cotacao' && (
                <label className="col-span-2 sm:col-span-2"><span className="label">Valor de referência do edital</span><CampoValor value={it.preco_referencia} onChange={(v) => mudar(i, 'preco_referencia', v)} placeholder="estimado (opcional)" /></label>
              )}
            </div>
            <div className="flex flex-wrap gap-x-5 gap-y-1 mt-3 sm:pl-9 text-xs">
              <span className="text-slate-400">Total: <b className="num text-slate-200">{dinheiro(venda)}</b></span>
              <span className="text-slate-400">Custo: <b className="num text-amber-300">{temCusto ? dinheiro(custo) : '—'}</b></span>
              <span className="text-slate-400">Lucro: <b className={`num ${corLucro(lucro)}`}>{lucro === null ? '—' : dinheiro(lucro)}</b>{margem !== null && <span className={`ml-1 ${corLucro(lucro)}`}>({pct(margem)})</span>}</span>
              {modo === 'cotacao' && it.preco_referencia > 0 && Number(it[campoPreco]) > it.preco_referencia && <span className="text-red-300">acima da referência</span>}
            </div>
          </div>
        );
      })}
      <button type="button" onClick={() => setItens([...itens, itemVazio()])} className="btn-sec w-full border-dashed"><Plus size={16} />Adicionar item</button>
    </div>
  );
}

export function ResumoItens({ itens, frete = 0, outros = 0, modo = 'venda' }) {
  const campo = modo === 'venda' ? 'valor_unit' : 'preco_unit';
  const total = itens.reduce((s, i) => s + (Number(i.quantidade) || 0) * (Number(i[campo]) || 0), 0);
  const semCusto = itens.some((i) => i.custo_unit === null || i.custo_unit === undefined || i.custo_unit === '');
  const custo = itens.reduce((s, i) => s + (Number(i.quantidade) || 0) * (Number(i.custo_unit) || 0), 0);
  const custoTotal = custo + (Number(frete) || 0) + (Number(outros) || 0);
  const lucro = custo > 0 ? total - custoTotal : null;
  const margem = lucro !== null && total > 0 ? (lucro / total) * 100 : null;
  return (
    <div className={`rounded-xl border-2 p-4 grid grid-cols-2 sm:grid-cols-4 gap-3 ${lucro === null ? 'border-borda' : lucro >= 0 ? 'border-emerald-500/40 bg-emerald-500/[0.04]' : 'border-red-500/40 bg-red-500/[0.05]'}`}>
      <div><p className="label">{modo === 'venda' ? 'Valor da venda' : 'Valor da proposta'}</p><p className="num text-lg font-bold text-marca-300">{dinheiro(total)}</p></div>
      <div><p className="label">Custo total</p><p className="num text-lg font-bold text-amber-300">{dinheiro(custoTotal)}</p><p className="text-[11px] text-slate-500">produtos {dinheiro(custo)}{Number(frete) > 0 ? ` + frete ${dinheiro(frete)}` : ''}</p></div>
      <div><p className="label">{lucro !== null && lucro < 0 ? 'Prejuízo' : 'Lucro'}</p><p className={`num text-xl font-extrabold ${corLucro(lucro)}`}>{lucro === null ? '—' : dinheiro(lucro)}</p></div>
      <div><p className="label">Margem</p><p className={`num text-lg font-bold ${corLucro(lucro)}`}>{pct(margem)}</p>{semCusto && <p className="text-[11px] text-amber-300/80">há item sem custo</p>}</div>
    </div>
  );
}
