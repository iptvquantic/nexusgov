const wrap = (fn) => (req, res, next) => Promise.resolve(fn(req, res, next)).catch(next);

class Erro extends Error {
  constructor(status, msg) { super(msg); this.status = status; }
}

const txt = (v, max = 2000) => {
  if (v === undefined || v === null) return null;
  const s = String(v).trim();
  return s === '' ? null : s.slice(0, max);
};
const numero = (v) => {
  if (v === undefined || v === null || v === '') return null;
  if (typeof v === 'number') return Number.isFinite(v) ? v : null;
  let s = String(v).trim().replace(/[R$\s]/g, '');
  if (s.includes(',')) s = s.replace(/\./g, '').replace(',', '.');
  const n = parseFloat(s);
  return Number.isFinite(n) ? n : null;
};
const data = (v) => {
  const s = txt(v, 40);
  if (!s) return null;
  if (/^\d{4}-\d{2}-\d{2}/.test(s)) return s.slice(0, 10);
  const m = /^(\d{2})\/(\d{2})\/(\d{4})$/.exec(s);
  return m ? `${m[3]}-${m[2]}-${m[1]}` : null;
};
const hoje = () => new Date(Date.now() - 3 * 3600000).toISOString().slice(0, 10);
const somaDias = (d, n) => {
  if (!d || n == null) return null;
  const x = new Date(d + 'T12:00:00Z');
  x.setUTCDate(x.getUTCDate() + Number(n));
  return x.toISOString().slice(0, 10);
};

const PORTAIS = ['Compras.gov.br', 'PNCP', 'BLL Compras', 'Licitações-e (BB)', 'Portal de Compras Públicas', 'BEC/SP', 'Licitanet', 'ComprasBR', 'BNC', 'Outro'];
const MODALIDADES = ['Dispensa eletrônica', 'Pregão eletrônico', 'Cotação eletrônica', 'Concorrência', 'Inexigibilidade', 'Adesão a ata', 'Compra direta', 'Outro'];
const STATUS_VENDA = ['empenhada', 'comprada', 'em_transito', 'entregue', 'faturada', 'paga', 'cancelada'];
const STATUS_OPORT = ['cotando', 'enviada', 'ganha', 'perdida', 'desistiu'];

module.exports = { wrap, Erro, txt, numero, data, hoje, somaDias, PORTAIS, MODALIDADES, STATUS_VENDA, STATUS_OPORT };
