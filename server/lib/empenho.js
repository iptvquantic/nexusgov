// Leitor de Nota de Empenho (padrão SIAFI / Compras.gov.br)
const { textoDoPdf } = require('./pdftexto');

const num = (s) => {
  if (s == null) return null;
  const t = String(s).trim().replace(/\./g, '').replace(',', '.');
  const n = parseFloat(t);
  return Number.isFinite(n) ? n : null;
};
const dataBr = (s) => {
  const m = /(\d{2})\/(\d{2})\/(\d{4})/.exec(s || '');
  return m ? `${m[3]}-${m[2]}-${m[1]}` : null;
};
const cols = (l) => l.trim().split(/\s{3,}/);

const MODALIDADES = {
  '05': 'Pregão eletrônico', '06': 'Dispensa eletrônica', '07': 'Inexigibilidade',
  '03': 'Concorrência', '04': 'Concorrência', '20': 'Concorrência', '02': 'Tomada de preços', '01': 'Convite',
};

function depoisDe(linhas, rotulo, inicio = 0) {
  const i = linhas.findIndex((l, k) => k >= inicio && l.trim().startsWith(rotulo));
  return i >= 0 ? { i, linha: linhas[i + 1] || '' } : { i: -1, linha: '' };
}

function blocoEntre(linhas, ini, fims) {
  const a = linhas.findIndex((l) => l.trim() === ini);
  if (a < 0) return '';
  const out = [];
  for (let k = a + 1; k < linhas.length; k++) {
    const t = linhas[k].trim();
    if (fims.some((f) => t.startsWith(f))) break;
    out.push(t);
  }
  return out.join(' ').replace(/\s+/g, ' ').trim();
}

function lerEmpenhoTexto(texto) {
  const linhas = texto.split('\n').map((l) => l.replace(/ /g, ' '));
  if (!/Nota de Empenho/i.test(texto)) throw new Error('Este PDF não parece ser uma Nota de Empenho.');
  const r = { orgao: {}, itens: [] };

  // UG emitente
  const ug = depoisDe(linhas, 'Código   Nome   Moeda');
  if (ug.i >= 0) {
    const c = cols(ug.linha);
    r.orgao.uasg = (c[0] || '').trim();
    r.orgao.nome = (c[1] || '').replace(/\s+/g, ' ').trim().toUpperCase();
  }
  const cn = depoisDe(linhas, 'CNPJ   Endereço');
  if (cn.i >= 0) {
    const c = cols(cn.linha);
    r.orgao.cnpj = c[0] || null;
    r.orgao.endereco = c[1] || null;
  }
  const mu = depoisDe(linhas, 'Município', cn.i >= 0 ? cn.i : 0);
  if (mu.i >= 0) {
    const c = cols(mu.linha);
    r.orgao.municipio = c[0] || null;
    r.orgao.uf = c[1] || null;
    r.orgao.telefone = c.slice(2).join(' ') || null;
  }
  const an = depoisDe(linhas, 'Ano   Tipo   Número');
  if (an.i >= 0) {
    const c = cols(an.linha);
    r.ano = c[0];
    r.numero_empenho = `${c[0]}NE${String(c[2] || '').padStart(6, '0')}`;
    r.numero_empenho_curto = `${c[0]}NE${c[2]}`;
  }
  const de = depoisDe(linhas, 'Data de Emissão');
  if (de.i >= 0) {
    const c = cols(de.linha);
    r.data_empenho = dataBr(c[0]);
    r.tipo_empenho = c[1] || null;
    r.processo = (c[2] || '').replace(/\s+[\d.]+,\d{4}$/, '') || null;
    r.valor_total = num(c[c.length - 1]);
  }
  const mo = depoisDe(linhas, 'Código   Modalidade de Licitação');
  if (mo.i >= 0) r.modalidade_texto = cols(mo.linha).slice(1).join(' ').trim();
  r.descricao = blocoEntre(linhas, 'Descrição', ['Local da Entrega', 'Informação Complementar', 'Sistema de Origem']);
  r.local_entrega = blocoEntre(linhas, 'Local da Entrega', ['Informação Complementar', 'Sistema de Origem']);
  const ic = blocoEntre(linhas, 'Informação Complementar', ['Sistema de Origem']);
  r.informacao_complementar = ic;
  const m = /(\d{6})(\d{2})(\d{5})(\d{4})/.exec(ic || '');
  if (m) {
    r.numero_compra = `${m[3]}/${m[4]}`;
    r.modalidade = MODALIDADES[m[2]] || null;
    if (!r.orgao.uasg) r.orgao.uasg = m[1];
  }
  if (!r.modalidade) {
    const t = (r.modalidade_texto || '').toUpperCase();
    r.modalidade = t.includes('DISPENSA') ? 'Dispensa eletrônica' : t.includes('PREG') ? 'Pregão eletrônico'
      : t.includes('INEXIG') ? 'Inexigibilidade' : r.modalidade_texto || null;
  }
  const so = depoisDe(linhas, 'Sistema de Origem');
  const sis = (so.linha || '').trim().toUpperCase();
  r.portal = sis.includes('COMPRASNET') || sis.includes('COMPRAS') ? 'Compras.gov.br' : sis || 'Compras.gov.br';

  // Itens
  for (let k = 0; k < linhas.length; k++) {
    const mi = /^\s*(\d{3})\s+(.+?)\s+(-?[\d.]+,\d{2})\s*$/.exec(linhas[k]);
    if (!mi || /^(Seq|Data)/.test(linhas[k].trim())) continue;
    const anterior = (linhas[k - 1] || '').trim();
    if (!anterior.startsWith('Seq.')) continue;
    const item = { seq: parseInt(mi[1], 10), descricao: mi[2].trim(), valor_item: num(mi[3]) };
    let j = k + 1;
    while (j < linhas.length && !/^\s*Data\s+Operação/.test(linhas[j])) {
      item.descricao += ' ' + linhas[j].trim();
      j++;
    }
    item.descricao = item.descricao.replace(/\s+/g, ' ').replace(/,\s*$/, '').trim();
    // operações
    let qtd = 0, unit = null, total = 0;
    j++;
    while (j < linhas.length) {
      const t = linhas[j].trim();
      const mo2 = /^(\d{2}\/\d{2}\/\d{4})\s+(.+?)\s{2,}([\d.,]+)\s+([\d.,]+)\s+(-?[\d.]+,\d{2})$/.exec(t);
      if (!mo2) {
        if (/^\d$/.test(t)) { j++; continue; }
        break;
      }
      const op = mo2[2].toLowerCase();
      const sinal = op.includes('anula') || op.includes('cancel') ? -1 : 1;
      const u = num(mo2[4]);
      const tt = num(mo2[5]);
      if (u) unit = u;
      total += sinal * Math.abs(tt || 0);
      j++;
    }
    if (unit) qtd = Math.round((total / unit) * 10000) / 10000;
    item.quantidade = qtd || 1;
    item.valor_unit = unit || item.valor_item;
    item.valor_total = total || item.valor_item;
    const mc = /Item compra:\s*(\d+)\s*-\s*(.*)$/i.exec(item.descricao);
    if (mc) { item.numero_item = parseInt(mc[1], 10); item.descricao = mc[2].trim(); }
    if (/restos a pagar/i.test(item.descricao)) item.descricao = r.descricao || item.descricao;
    r.itens.push(item);
  }
  if (!r.itens.length && r.valor_total) {
    r.itens.push({ seq: 1, descricao: r.descricao, quantidade: 1, valor_unit: r.valor_total, valor_total: r.valor_total });
  }
  // objeto curto para título
  const primeiro = r.itens[0]?.descricao || r.descricao || '';
  r.objeto = (primeiro.split(' - ')[0] || primeiro).slice(0, 120);
  if (r.itens.length > 1) r.objeto += ` (+${r.itens.length - 1} itens)`;
  return r;
}

async function lerEmpenhoPdf(buffer) {
  const texto = await textoDoPdf(buffer);
  return lerEmpenhoTexto(texto);
}

module.exports = { lerEmpenhoPdf, lerEmpenhoTexto };
