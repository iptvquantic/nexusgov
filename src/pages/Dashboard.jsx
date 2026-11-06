import { Link, useNavigate } from 'react-router-dom';
import { Bar, CartesianGrid, ComposedChart, Legend, Line, ResponsiveContainer, Tooltip, XAxis, YAxis } from 'recharts';
import {
  AlertTriangle, ArrowRight, CalendarClock, FileUp, HandCoins, Info, PiggyBank, Plus, ShoppingCart, Target, TrendingDown, TrendingUp, Truck, Wallet, XCircle,
} from 'lucide-react';
import { api } from '../lib/api';
import { useAuth } from '../lib/auth';
import { Carregando, ChipVenda, ErroCaixa, Kpi, Vazio, useDados } from '../components/ui';
import { ETAPAS, STATUS_VENDA, corLucro, data, dataHora, dinheiro, dinheiroCurto, pct } from '../lib/fmt';

const COR_ALERTA = {
  erro: 'border-red-500/30 bg-red-500/[0.07] text-red-200', aviso: 'border-amber-500/30 bg-amber-500/[0.07] text-amber-200', info: 'border-marca-500/30 bg-marca-500/[0.07] text-marca-200',
};
const ICONE_ALERTA = { erro: XCircle, aviso: AlertTriangle, info: Info };

function DicaGrafico({ active, payload, label }) {
  if (!active || !payload?.length) return null;
  return (
    <div className="bg-painel2 border border-borda rounded-xl px-3 py-2 text-xs shadow-xl">
      <p className="font-semibold text-slate-200 mb-1">{label}</p>
      {payload.map((p) => <p key={p.dataKey} className="flex justify-between gap-4"><span style={{ color: p.color }}>{p.name}</span><span className="num text-white">{dinheiro(p.value)}</span></p>)}
    </div>
  );
}

const prazoTexto = (dias) => (dias === null || dias === undefined ? '' : dias < 0 ? `${Math.abs(dias)}d atrasado` : dias === 0 ? 'hoje' : `em ${dias}d`);
const prazoCor = (dias) => (dias === null || dias === undefined ? 'text-slate-500' : dias < 0 ? 'text-red-400' : dias <= 5 ? 'text-amber-400' : 'text-slate-400');

export default function Dashboard() {
  const { usuario } = useAuth();
  const nav = useNavigate();
  const { dados: d, carregando, erro, recarregar } = useDados(() => api('/painel/dashboard'));
  if (carregando && !d) return <Carregando />;
  if (erro) return <ErroCaixa erro={erro} tentar={recarregar} />;
  const k = d.kpis;
  const funil = Object.fromEntries(d.funil.map((f) => [f.status, f]));
  const vazio = k.vendas === 0;

  return (
    <div className="space-y-5 fade-in">
      <div className="flex flex-col sm:flex-row sm:items-end sm:justify-between gap-3">
        <div>
          <h1 className="text-xl sm:text-2xl font-bold text-white">Olá, {usuario?.nome?.split(' ')[0]} 👋</h1>
          <p className="text-sm text-slate-400">Resumo das suas vendas para o governo.</p>
        </div>
        <div className="flex flex-wrap gap-2">
          <Link to="/oportunidades?nova=1" className="btn-sec"><Target size={16} />Nova oportunidade</Link>
          <Link to="/vendas/nova?importar=1" className="btn-pri"><FileUp size={16} />Importar empenho</Link>
        </div>
      </div>

      {d.alertas.length > 0 && (
        <div className="grid gap-2 sm:grid-cols-2">
          {d.alertas.map((a, i) => {
            const I = ICONE_ALERTA[a.nivel];
            return (
              <Link key={i} to={a.link} className={`flex items-center gap-3 rounded-xl border px-4 py-3 text-sm font-medium hover:brightness-125 transition ${COR_ALERTA[a.nivel]}`}>
                <I size={17} className="shrink-0" /><span className="flex-1">{a.texto}</span><ArrowRight size={15} className="opacity-60" />
              </Link>
            );
          })}
        </div>
      )}

      {vazio && (
        <div className="card p-6 sm:p-8 border-marca-500/30 bg-gradient-to-br from-marca-600/10 to-transparent">
          <h2 className="text-lg font-bold text-white">Comece por aqui</h2>
          <p className="text-sm text-slate-400 mt-1 mb-5">Três jeitos de colocar suas vendas no sistema:</p>
          <div className="grid sm:grid-cols-3 gap-3">
            <Link to="/vendas/nova?importar=1" className="card p-4 hover:border-marca-500/50"><FileUp className="text-marca-400 mb-2" size={20} /><p className="font-semibold text-white text-sm">Anexar PDF do empenho</p><p className="text-xs text-slate-500 mt-1">Preenche tudo sozinho.</p></Link>
            <Link to="/vendas/nova" className="card p-4 hover:border-marca-500/50"><Plus className="text-marca-400 mb-2" size={20} /><p className="font-semibold text-white text-sm">Cadastrar venda à mão</p><p className="text-xs text-slate-500 mt-1">Para pedidos sem PDF.</p></Link>
            <Link to="/oportunidades?nova=1" className="card p-4 hover:border-marca-500/50"><Target className="text-marca-400 mb-2" size={20} /><p className="font-semibold text-white text-sm">Registrar uma cotação</p><p className="text-xs text-slate-500 mt-1">Dispensa ou pregão em disputa.</p></Link>
          </div>
        </div>
      )}

      <div className="grid grid-cols-2 lg:grid-cols-4 gap-3">
        <Kpi titulo={`Vendido em ${new Date().getFullYear()}`} valor={dinheiroCurto(k.vendido_ano)} sub={`Este mês: ${dinheiro(k.vendido_mes)}`} icone={ShoppingCart} onClick={() => nav('/vendas')} />
        <Kpi titulo="A receber do governo" valor={dinheiroCurto(k.a_receber)} sub={`${k.vendas_abertas} venda(s) em aberto`} icone={CalendarClock} tom="ambar" onClick={() => nav('/recebimentos')} />
        <Kpi titulo="Já recebido" valor={dinheiroCurto(k.recebido_total)} sub="Total pago pelos órgãos" icone={HandCoins} tom="verde" onClick={() => nav('/recebimentos')} />
        <Kpi titulo="Saldo em caixa" valor={dinheiroCurto(k.saldo_caixa)} sub={`Despesas do mês: ${dinheiro(k.despesas_mes)}`} icone={Wallet} tom={k.saldo_caixa >= 0 ? 'marca' : 'vermelho'} onClick={() => nav('/caixa')} />
      </div>

      <div className={`card p-5 border-2 ${k.lucro_total >= 0 ? 'border-emerald-500/30' : 'border-red-500/40'}`}>
        <div className="grid grid-cols-2 lg:grid-cols-5 gap-5 items-center">
          <div className="col-span-2 flex items-center gap-4">
            <div className={`w-12 h-12 rounded-2xl flex items-center justify-center ${k.lucro_total >= 0 ? 'bg-emerald-500/15 text-emerald-300' : 'bg-red-500/15 text-red-300'}`}>
              {k.lucro_total >= 0 ? <TrendingUp size={24} /> : <TrendingDown size={24} />}
            </div>
            <div>
              <p className="text-[11px] font-semibold uppercase tracking-wider text-slate-400">Lucro já realizado</p>
              <p className={`num text-3xl font-extrabold ${corLucro(k.lucro_realizado)}`}>{dinheiro(k.lucro_realizado)}</p>
              <p className="text-xs text-slate-500">vendas pagas · custo e frete já descontados</p>
            </div>
          </div>
          <div><p className="text-[11px] uppercase tracking-wider text-slate-500 font-semibold">Lucro a realizar</p><p className={`num text-lg font-bold ${corLucro(k.lucro_a_realizar)}`}>{dinheiro(k.lucro_a_realizar)}</p></div>
          <div><p className="text-[11px] uppercase tracking-wider text-slate-500 font-semibold">Margem média</p><p className={`num text-lg font-bold ${corLucro(k.margem_media)}`}>{pct(k.margem_media)}</p></div>
          <div><p className="text-[11px] uppercase tracking-wider text-slate-500 font-semibold">A pagar a fornecedores</p><p className="num text-lg font-bold text-amber-300">{dinheiro(k.fornecedor_a_pagar)}</p></div>
        </div>
        <div className="mt-5">
          <div className="flex justify-between text-xs mb-1.5">
            <span className="text-slate-400 flex items-center gap-1"><PiggyBank size={13} />Limite anual do MEI</span>
            <span className="num text-slate-300">{dinheiro(k.vendido_ano)} de {dinheiro(k.limite_mei)} ({pct(k.uso_mei)})</span>
          </div>
          <div className="h-2 rounded-full bg-painel2 overflow-hidden">
            <div className={`h-full rounded-full ${k.uso_mei >= 100 ? 'bg-red-500' : k.uso_mei >= 80 ? 'bg-amber-500' : 'bg-marca-500'}`} style={{ width: `${Math.min(100, k.uso_mei)}%` }} />
          </div>
        </div>
      </div>

      <div className="card p-4 sm:p-5">
        <div className="flex items-center justify-between mb-3"><h2 className="font-semibold text-white text-sm">Onde estão suas vendas</h2><Link to="/vendas" className="text-xs text-marca-400">ver todas</Link></div>
        <div className="grid grid-cols-3 sm:grid-cols-6 gap-2">
          {ETAPAS.map((s) => (
            <Link key={s} to={`/vendas?status=${s}`} className="rounded-xl bg-painel2 border border-borda p-3 hover:border-marca-500/40 transition">
              <p className={`text-[11px] font-semibold ${STATUS_VENDA[s].cor.split(' ')[0]}`}>{STATUS_VENDA[s].rotulo}</p>
              <p className="text-xl font-bold text-white mt-1">{funil[s]?.qtd || 0}</p>
              <p className="num text-[11px] text-slate-500 truncate">{dinheiroCurto(funil[s]?.valor || 0)}</p>
            </Link>
          ))}
        </div>
      </div>

      <div className="grid lg:grid-cols-3 gap-4">
        <div className="card p-4 sm:p-5 lg:col-span-2 min-w-0">
          <h2 className="font-semibold text-white text-sm mb-1">Vendas, recebimentos e lucro</h2>
          <p className="text-xs text-slate-500 mb-3">Últimos 12 meses</p>
          <div className="h-64">
            <ResponsiveContainer width="100%" height="100%">
              <ComposedChart data={d.mensal} margin={{ left: -10, right: 4, top: 4 }}>
                <CartesianGrid stroke="#22304d" strokeDasharray="3 3" vertical={false} />
                <XAxis dataKey="mes" tick={{ fill: '#64748b', fontSize: 11 }} axisLine={false} tickLine={false} />
                <YAxis tick={{ fill: '#64748b', fontSize: 11 }} axisLine={false} tickLine={false} tickFormatter={(v) => (Math.abs(v) >= 1000 ? `${Math.round(v / 1000)}k` : v)} />
                <Tooltip content={<DicaGrafico />} cursor={{ fill: 'rgba(255,255,255,0.03)' }} />
                <Legend wrapperStyle={{ fontSize: 12 }} />
                <Bar dataKey="vendido" name="Vendido" fill="#3b82f6" radius={[4, 4, 0, 0]} maxBarSize={26} />
                <Bar dataKey="recebido" name="Recebido" fill="#10b981" radius={[4, 4, 0, 0]} maxBarSize={26} />
                <Line dataKey="lucro" name="Lucro" stroke="#f59e0b" strokeWidth={2.5} dot={{ r: 3 }} type="monotone" />
              </ComposedChart>
            </ResponsiveContainer>
          </div>
        </div>
        <div className="card p-4 sm:p-5">
          <h2 className="font-semibold text-white text-sm mb-3">Principais órgãos</h2>
          {d.top_orgaos.length === 0 ? <p className="text-sm text-slate-500">Sem vendas ainda.</p> : (
            <div className="space-y-3">
              {d.top_orgaos.map((o) => {
                const max = d.top_orgaos[0].valor || 1;
                return (
                  <div key={o.orgao_id || o.nome}>
                    <div className="flex justify-between gap-2 text-xs"><span className="text-slate-300 truncate">{o.nome}</span><span className="num text-slate-400 shrink-0">{dinheiroCurto(o.valor)}</span></div>
                    <div className="h-1.5 rounded-full bg-painel2 mt-1.5"><div className="h-full rounded-full bg-marca-500" style={{ width: `${(o.valor / max) * 100}%` }} /></div>
                    <p className={`text-[11px] mt-1 ${corLucro(o.lucro)}`}>{o.vendas} venda(s) · lucro {o.lucro === null ? '—' : dinheiro(o.lucro)}</p>
                  </div>
                );
              })}
            </div>
          )}
          {d.por_portal.length > 0 && (
            <>
              <h3 className="font-semibold text-white text-sm mt-6 mb-2">Por portal</h3>
              {d.por_portal.map((p) => (
                <div key={p.portal} className="flex justify-between text-xs py-1.5 border-b border-borda/60 last:border-0">
                  <span className="text-slate-300">{p.portal}</span><span className="num text-slate-400">{p.vendas} · {dinheiroCurto(p.valor)}</span>
                </div>
              ))}
            </>
          )}
        </div>
      </div>

      <div className="grid lg:grid-cols-3 gap-4">
        <Lista titulo="Próximas entregas" icone={Truck} itens={d.entregas} vazio="Nenhuma entrega pendente."
          linha={(e) => (
            <Link key={e.id} to={`/vendas/${e.id}`} className="flex items-center justify-between gap-3 py-2.5 border-b border-borda/60 last:border-0 hover:bg-white/[0.02] -mx-2 px-2 rounded-lg">
              <div className="min-w-0"><p className="text-sm text-slate-200 truncate">{e.objeto}</p><p className="text-[11px] text-slate-500 truncate">{e.orgao_nome || '—'}</p></div>
              <div className="text-right shrink-0"><p className="text-xs text-slate-300">{data(e.data_limite_entrega)}</p><p className={`text-[11px] font-semibold ${prazoCor(e.dias)}`}>{prazoTexto(e.dias)}</p></div>
            </Link>
          )} />
        <Lista titulo="Próximos recebimentos" icone={HandCoins} itens={d.pagamentos} vazio="Nada a receber."
          linha={(p) => (
            <Link key={p.id} to={`/vendas/${p.id}`} className="flex items-center justify-between gap-3 py-2.5 border-b border-borda/60 last:border-0 hover:bg-white/[0.02] -mx-2 px-2 rounded-lg">
              <div className="min-w-0"><p className="text-sm text-slate-200 truncate">{p.objeto}</p><p className="text-[11px] text-slate-500 truncate">{p.orgao_nome || '—'}</p></div>
              <div className="text-right shrink-0"><p className="num text-xs text-emerald-300">{dinheiro(p.saldo_receber)}</p><p className={`text-[11px] ${prazoCor(p.dias)}`}>{p.data_prev_pagamento ? `${data(p.data_prev_pagamento)} · ${prazoTexto(p.dias)}` : 'sem NF'}</p></div>
            </Link>
          )} />
        <Lista titulo="Próximas disputas" icone={Target} itens={d.sessoes} vazio="Nenhuma disputa agendada." acao={<Link to="/oportunidades?nova=1" className="text-xs text-marca-400">+ nova</Link>}
          linha={(s) => (
            <Link key={s.id} to="/oportunidades" className="flex items-center justify-between gap-3 py-2.5 border-b border-borda/60 last:border-0 hover:bg-white/[0.02] -mx-2 px-2 rounded-lg">
              <div className="min-w-0"><p className="text-sm text-slate-200 truncate">{s.objeto}</p><p className="text-[11px] text-slate-500 truncate">{s.uasg ? `UASG ${s.uasg} · ` : ''}{s.numero || ''}</p></div>
              <p className="text-xs text-slate-300 shrink-0">{dataHora(s.data_sessao)}</p>
            </Link>
          )} />
      </div>
    </div>
  );
}

function Lista({ titulo, icone: I, itens, linha, vazio, acao }) {
  return (
    <div className="card p-4 sm:p-5 min-w-0">
      <div className="flex items-center justify-between mb-2">
        <h2 className="font-semibold text-white text-sm flex items-center gap-2"><I size={15} className="text-marca-400" />{titulo}</h2>{acao}
      </div>
      {itens.length ? itens.map(linha) : <Vazio titulo={vazio} icone={I} />}
    </div>
  );
}

export { ChipVenda };
