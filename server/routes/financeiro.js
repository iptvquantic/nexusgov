const express = require('express');
const { q, one } = require('../db');
const { wrap, Erro, txt, numero, data, hoje } = require('../util');

const CATEGORIAS_SAIDA = ['DAS / Impostos', 'Contador', 'Internet / Telefone', 'Combustível / Transporte', 'Frete', 'Compra de mercadoria',
  'Certificado digital', 'Taxas bancárias', 'Material de escritório', 'Marketing', 'Pró-labore', 'Outros'];
const CATEGORIAS_ENTRADA = ['Recebimento de venda', 'Aporte do dono', 'Empréstimo', 'Outros'];

const caixa = express.Router();

caixa.get('/', wrap(async (req, res) => {
  const p = [req.user.id];
  const w = ['c.usuario_id = $1'];
  const add = (cond, val) => { p.push(val); w.push(cond.replace('?', `$${p.length}`)); };
  if (['entrada', 'saida'].includes(req.query.tipo)) add('c.tipo = ?', req.query.tipo);
  if (req.query.categoria) add('c.categoria = ?', req.query.categoria);
  if (data(req.query.de)) add('c.data >= ?', data(req.query.de));
  if (data(req.query.ate)) add('c.data <= ?', data(req.query.ate));
  if (req.query.busca) add('c.descricao ILIKE ?', `%${req.query.busca}%`);
  const lista = await q(`SELECT c.*, v.objeto AS venda_objeto FROM caixa c LEFT JOIN vendas v ON v.id = c.venda_id
    WHERE ${w.join(' AND ')} ORDER BY c.data DESC, c.criado_em DESC LIMIT 2000`, p);
  const periodo = lista.reduce((t, m) => { t[m.tipo] += m.valor; return t; }, { entrada: 0, saida: 0 });
  const geral = await one(`SELECT COALESCE(SUM(CASE WHEN tipo='entrada' THEN valor ELSE -valor END),0) AS saldo FROM caixa WHERE usuario_id = $1`, [req.user.id]);
  const porCategoria = {};
  for (const m of lista.filter((x) => x.tipo === 'saida')) porCategoria[m.categoria] = (porCategoria[m.categoria] || 0) + m.valor;
  res.json({
    movimentos: lista,
    totais: { entradas: periodo.entrada, saidas: periodo.saida, resultado: periodo.entrada - periodo.saida, saldo_geral: geral.saldo },
    por_categoria: Object.entries(porCategoria).map(([categoria, valor]) => ({ categoria, valor })).sort((a, b) => b.valor - a.valor),
    categorias: { entrada: CATEGORIAS_ENTRADA, saida: CATEGORIAS_SAIDA },
  });
}));

caixa.post('/', wrap(async (req, res) => {
  const b = req.body;
  const tipo = b.tipo === 'entrada' ? 'entrada' : 'saida';
  const valor = numero(b.valor);
  if (!valor || valor <= 0) throw new Erro(400, 'Informe o valor.');
  const descricao = txt(b.descricao, 300);
  if (!descricao) throw new Erro(400, 'Descreva o lançamento.');
  const categoria = txt(b.categoria, 60) || 'Outros';
  const repetir = Math.min(Math.max(parseInt(b.repetir_meses || 1, 10) || 1, 1), 24);
  const base = data(b.data) || hoje();
  const criados = [];
  for (let i = 0; i < repetir; i++) {
    const d = new Date(base + 'T12:00:00Z');
    d.setUTCMonth(d.getUTCMonth() + i);
    criados.push(await one(`INSERT INTO caixa (usuario_id, tipo, categoria, descricao, valor, data, origem) VALUES ($1,$2,$3,$4,$5,$6,'manual') RETURNING *`,
      [req.user.id, tipo, categoria, repetir > 1 ? `${descricao} (${i + 1}/${repetir})` : descricao, valor, d.toISOString().slice(0, 10)]));
  }
  res.status(201).json({ movimentos: criados });
}));

caixa.put('/:id', wrap(async (req, res) => {
  const b = req.body;
  const m = await one('SELECT * FROM caixa WHERE id = $1 AND usuario_id = $2', [req.params.id, req.user.id]);
  if (!m) throw new Erro(404, 'Lançamento não encontrado.');
  if (m.origem !== 'manual') throw new Erro(400, 'Este lançamento é automático. Altere pela venda correspondente.');
  const valor = numero(b.valor);
  if (!valor || valor <= 0) throw new Erro(400, 'Informe o valor.');
  const r = await one(`UPDATE caixa SET tipo=$3, categoria=$4, descricao=$5, valor=$6, data=$7 WHERE id=$1 AND usuario_id=$2 RETURNING *`,
    [m.id, req.user.id, b.tipo === 'entrada' ? 'entrada' : 'saida', txt(b.categoria, 60) || 'Outros', txt(b.descricao, 300) || m.descricao, valor, data(b.data) || m.data]);
  res.json({ movimento: r });
}));

caixa.delete('/:id', wrap(async (req, res) => {
  const m = await one('SELECT * FROM caixa WHERE id = $1 AND usuario_id = $2', [req.params.id, req.user.id]);
  if (!m) throw new Erro(404, 'Lançamento não encontrado.');
  if (m.origem !== 'manual') throw new Erro(400, 'Este lançamento veio de uma venda. Desfaça pela própria venda (recebimento ou pagamento ao fornecedor).');
  await q('DELETE FROM caixa WHERE id = $1', [m.id]);
  res.json({ ok: true });
}));

// ---------- Recebimentos (visão geral de todas as vendas)
const recebimentos = express.Router();
recebimentos.get('/', wrap(async (req, res) => {
  const p = [req.user.id];
  const w = ['r.usuario_id = $1'];
  if (data(req.query.de)) { p.push(data(req.query.de)); w.push(`r.data >= $${p.length}`); }
  if (data(req.query.ate)) { p.push(data(req.query.ate)); w.push(`r.data <= $${p.length}`); }
  const lista = await q(`SELECT r.*, v.objeto, v.numero_empenho, o.nome AS orgao_nome FROM recebimentos r
    JOIN vendas v ON v.id = r.venda_id LEFT JOIN orgaos o ON o.id = v.orgao_id WHERE ${w.join(' AND ')} ORDER BY r.data DESC, r.criado_em DESC`, p);
  const aReceber = await q(`SELECT id, objeto, numero_empenho, orgao_nome, orgao_uasg, status, valor_total, valor_recebido, saldo_receber, nf_numero, nf_data, data_prev_pagamento
    FROM vendas_resumo WHERE usuario_id = $1 AND status NOT IN ('paga','cancelada') AND saldo_receber > 0
    ORDER BY data_prev_pagamento ASC NULLS LAST, data_empenho`, [req.user.id]);
  res.json({ recebimentos: lista, total: lista.reduce((s, r) => s + r.valor, 0), a_receber: aReceber });
}));

module.exports = { caixa, recebimentos };
