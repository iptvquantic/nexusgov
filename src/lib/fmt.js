const brl = new Intl.NumberFormat('pt-BR', { style: 'currency', currency: 'BRL' });
export const dinheiro = (v) => brl.format(Number(v) || 0);
export const dinheiroCurto = (v) => {
  const n = Number(v) || 0;
  if (Math.abs(n) >= 1e6) return `R$ ${(n / 1e6).toFixed(1).replace('.', ',')} mi`;
  if (Math.abs(n) >= 1e3) return `R$ ${(n / 1e3).toFixed(1).replace('.', ',')} mil`;
  return dinheiro(n);
};
export const numeroBr = (v, casas = 2) => (Number(v) || 0).toLocaleString('pt-BR', { minimumFractionDigits: 0, maximumFractionDigits: casas });
export const pct = (v) => (v === null || v === undefined ? '—' : `${Number(v).toLocaleString('pt-BR', { maximumFractionDigits: 1 })}%`);
export const data = (d) => {
  if (!d) return '—';
  const s = String(d).slice(0, 10);
  const [a, m, dia] = s.split('-');
  return a && m && dia ? `${dia}/${m}/${a}` : '—';
};
export const dataHora = (d) => (d ? new Date(d).toLocaleString('pt-BR', { day: '2-digit', month: '2-digit', year: '2-digit', hour: '2-digit', minute: '2-digit' }) : '—');
export const hojeIso = () => { const d = new Date(); d.setMinutes(d.getMinutes() - d.getTimezoneOffset()); return d.toISOString().slice(0, 10); };
export const diasAte = (d) => {
  if (!d) return null;
  const alvo = new Date(String(d).slice(0, 10) + 'T12:00:00');
  const h = new Date(hojeIso() + 'T12:00:00');
  return Math.round((alvo - h) / 86400000);
};
// aceita "1.234,56", "1234.56", "1234,5"
export const parseNum = (v) => {
  if (v === null || v === undefined || v === '') return null;
  if (typeof v === 'number') return v;
  let s = String(v).trim().replace(/[R$\s]/g, '');
  if (s.includes(',')) s = s.replace(/\./g, '').replace(',', '.');
  const n = parseFloat(s);
  return Number.isFinite(n) ? n : null;
};

export const STATUS_VENDA = {
  empenhada:   { rotulo: 'Empenhada',      cor: 'text-sky-300 bg-sky-500/10 border-sky-500/30', passo: 0 },
  comprada:    { rotulo: 'Comprada',       cor: 'text-violet-300 bg-violet-500/10 border-violet-500/30', passo: 1 },
  em_transito: { rotulo: 'Em trânsito',    cor: 'text-indigo-300 bg-indigo-500/10 border-indigo-500/30', passo: 2 },
  entregue:    { rotulo: 'Entregue',       cor: 'text-teal-300 bg-teal-500/10 border-teal-500/30', passo: 3 },
  faturada:    { rotulo: 'NF emitida',     cor: 'text-amber-300 bg-amber-500/10 border-amber-500/30', passo: 4 },
  paga:        { rotulo: 'Paga',           cor: 'text-emerald-300 bg-emerald-500/10 border-emerald-500/30', passo: 5 },
  cancelada:   { rotulo: 'Cancelada',      cor: 'text-slate-400 bg-slate-500/10 border-slate-500/30', passo: -1 },
};
export const ETAPAS = ['empenhada', 'comprada', 'em_transito', 'entregue', 'faturada', 'paga'];

export const STATUS_OPORT = {
  cotando:  { rotulo: 'Cotando',          cor: 'text-sky-300 bg-sky-500/10 border-sky-500/30' },
  enviada:  { rotulo: 'Proposta enviada', cor: 'text-amber-300 bg-amber-500/10 border-amber-500/30' },
  ganha:    { rotulo: 'Ganha',            cor: 'text-emerald-300 bg-emerald-500/10 border-emerald-500/30' },
  perdida:  { rotulo: 'Perdida',          cor: 'text-red-300 bg-red-500/10 border-red-500/30' },
  desistiu: { rotulo: 'Desisti',          cor: 'text-slate-400 bg-slate-500/10 border-slate-500/30' },
};

export const PORTAIS = ['Compras.gov.br', 'PNCP', 'BLL Compras', 'Licitações-e (BB)', 'Portal de Compras Públicas', 'BEC/SP', 'Licitanet', 'ComprasBR', 'BNC', 'Outro'];
export const MODALIDADES = ['Dispensa eletrônica', 'Pregão eletrônico', 'Cotação eletrônica', 'Concorrência', 'Inexigibilidade', 'Adesão a ata', 'Compra direta', 'Outro'];

export const corLucro = (v) => (v === null || v === undefined ? 'text-slate-500' : v >= 0 ? 'text-emerald-400' : 'text-red-400');

export function baixarCsv(nome, linhas) {
  if (!linhas.length) return;
  const cab = Object.keys(linhas[0]);
  const esc = (v) => {
    if (v === null || v === undefined) return '';
    const s = typeof v === 'number' ? String(v).replace('.', ',') : String(v);
    return /[;"\n]/.test(s) ? `"${s.replace(/"/g, '""')}"` : s;
  };
  const csv = '﻿' + [cab.join(';'), ...linhas.map((l) => cab.map((c) => esc(l[c])).join(';'))].join('\n');
  const a = document.createElement('a');
  a.href = URL.createObjectURL(new Blob([csv], { type: 'text/csv;charset=utf-8' }));
  a.download = nome;
  a.click();
  setTimeout(() => URL.revokeObjectURL(a.href), 2000);
}
