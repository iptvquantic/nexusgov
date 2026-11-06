const express = require('express');
const { q, one } = require('../db');
const { wrap, Erro, txt, numero } = require('../util');

// ---------- Órgãos (clientes)
const orgaos = express.Router();

orgaos.get('/', wrap(async (req, res) => {
  const lista = await q(`
    SELECT o.*, COALESCE(s.vendas, 0) AS vendas, COALESCE(s.total, 0) AS total_vendido, COALESCE(s.recebido, 0) AS recebido,
      COALESCE(s.a_receber, 0) AS a_receber, COALESCE(s.lucro, 0) AS lucro, s.ultima_venda, pz.prazo_medio_pagamento
    FROM orgaos o
    LEFT JOIN LATERAL (
      SELECT COUNT(*) AS vendas, SUM(valor_total) AS total, SUM(valor_recebido) AS recebido, SUM(saldo_receber) AS a_receber,
             SUM(lucro) AS lucro, MAX(data_empenho) AS ultima_venda
      FROM vendas_resumo WHERE orgao_id = o.id AND status <> 'cancelada'
    ) s ON true
    LEFT JOIN LATERAL (
      SELECT ROUND(AVG(v.ultimo_recebimento - COALESCE(v.nf_data, v.data_entrega, v.data_empenho))) AS prazo_medio_pagamento
      FROM vendas_resumo v WHERE v.orgao_id = o.id AND v.status = 'paga' AND v.ultimo_recebimento IS NOT NULL
    ) pz ON true
    WHERE o.usuario_id = $1 ORDER BY COALESCE(s.total, 0) DESC, o.nome`, [req.user.id]);
  res.json({ orgaos: lista });
}));

const camposOrgao = (b) => [txt(b.uasg, 20), txt(b.nome, 200), txt(b.cnpj, 30), txt(b.endereco, 300), txt(b.municipio, 100), txt(b.uf, 2),
  txt(b.telefone, 120), txt(b.email, 160), txt(b.contato, 120), txt(b.obs, 2000)];

orgaos.post('/', wrap(async (req, res) => {
  const c = camposOrgao(req.body);
  if (!c[1]) throw new Erro(400, 'Informe o nome do órgão.');
  if (c[0] && await one('SELECT 1 FROM orgaos WHERE usuario_id = $1 AND uasg = $2', [req.user.id, c[0]])) throw new Erro(409, 'Já existe um órgão com esta UASG.');
  const o = await one(`INSERT INTO orgaos (usuario_id, uasg, nome, cnpj, endereco, municipio, uf, telefone, email, contato, obs)
    VALUES ($1,$2,$3,$4,$5,$6,$7,$8,$9,$10,$11) RETURNING *`, [req.user.id, ...c]);
  res.status(201).json({ orgao: o });
}));

orgaos.put('/:id', wrap(async (req, res) => {
  const c = camposOrgao(req.body);
  if (!c[1]) throw new Erro(400, 'Informe o nome do órgão.');
  const o = await one(`UPDATE orgaos SET uasg=$3, nome=$4, cnpj=$5, endereco=$6, municipio=$7, uf=$8, telefone=$9, email=$10, contato=$11, obs=$12
    WHERE id=$1 AND usuario_id=$2 RETURNING *`, [req.params.id, req.user.id, ...c]);
  if (!o) throw new Erro(404, 'Órgão não encontrado.');
  res.json({ orgao: o });
}));

orgaos.delete('/:id', wrap(async (req, res) => {
  const r = await q('DELETE FROM orgaos WHERE id = $1 AND usuario_id = $2 RETURNING id', [req.params.id, req.user.id]);
  if (!r.length) throw new Erro(404, 'Órgão não encontrado.');
  res.json({ ok: true });
}));

// ---------- Fornecedores
const fornecedores = express.Router();

fornecedores.get('/', wrap(async (req, res) => {
  const p = [req.user.id];
  let filtro = '';
  if (req.query.busca) {
    p.push(`%${req.query.busca}%`);
    filtro = ` AND (f.nome ILIKE $2 OR f.produtos ILIKE $2 OR f.contato ILIKE $2 OR f.email ILIKE $2 OR f.cidade ILIKE $2)`;
  }
  const lista = await q(`
    SELECT f.*, COALESCE(s.vendas, 0) AS vendas, COALESCE(s.comprado, 0) AS total_comprado, s.ultima_compra
    FROM fornecedores f
    LEFT JOIN LATERAL (
      SELECT COUNT(DISTINCT i.venda_id) AS vendas, SUM(i.quantidade * COALESCE(i.custo_unit, 0)) AS comprado, MAX(v.data_empenho) AS ultima_compra
      FROM venda_itens i JOIN vendas v ON v.id = i.venda_id WHERE i.fornecedor_id = f.id AND v.status <> 'cancelada'
    ) s ON true
    WHERE f.usuario_id = $1${filtro} ORDER BY f.nome`, p);
  res.json({ fornecedores: lista });
}));

const camposForn = (b) => [txt(b.nome, 200), txt(b.produtos, 1000), txt(b.contato, 120), txt(b.email, 300), txt(b.telefone, 120), txt(b.cnpj, 30),
  txt(b.cidade, 120), txt(b.site, 300), numero(b.prazo_entrega_dias), txt(b.obs, 2000)];

fornecedores.post('/', wrap(async (req, res) => {
  const c = camposForn(req.body);
  if (!c[0]) throw new Erro(400, 'Informe o nome do fornecedor.');
  const f = await one(`INSERT INTO fornecedores (usuario_id, nome, produtos, contato, email, telefone, cnpj, cidade, site, prazo_entrega_dias, obs)
    VALUES ($1,$2,$3,$4,$5,$6,$7,$8,$9,$10,$11) RETURNING *`, [req.user.id, ...c]);
  res.status(201).json({ fornecedor: f });
}));

// importação em lote (lista colada da planilha: nome; produtos; email; telefone; contato)
fornecedores.post('/importar', wrap(async (req, res) => {
  const linhas = Array.isArray(req.body.fornecedores) ? req.body.fornecedores.slice(0, 500) : [];
  let criados = 0;
  for (const l of linhas) {
    const c = camposForn(l);
    if (!c[0]) continue;
    const ja = await one('SELECT id FROM fornecedores WHERE usuario_id = $1 AND upper(nome) = upper($2) AND COALESCE(produtos,\'\') = COALESCE($3,\'\')', [req.user.id, c[0], c[1]]);
    if (ja) continue;
    await q(`INSERT INTO fornecedores (usuario_id, nome, produtos, contato, email, telefone, cnpj, cidade, site, prazo_entrega_dias, obs)
      VALUES ($1,$2,$3,$4,$5,$6,$7,$8,$9,$10,$11)`, [req.user.id, ...c]);
    criados++;
  }
  res.json({ criados });
}));

fornecedores.put('/:id', wrap(async (req, res) => {
  const c = camposForn(req.body);
  if (!c[0]) throw new Erro(400, 'Informe o nome do fornecedor.');
  const f = await one(`UPDATE fornecedores SET nome=$3, produtos=$4, contato=$5, email=$6, telefone=$7, cnpj=$8, cidade=$9, site=$10, prazo_entrega_dias=$11, obs=$12
    WHERE id=$1 AND usuario_id=$2 RETURNING *`, [req.params.id, req.user.id, ...c]);
  if (!f) throw new Erro(404, 'Fornecedor não encontrado.');
  res.json({ fornecedor: f });
}));

fornecedores.delete('/:id', wrap(async (req, res) => {
  const r = await q('DELETE FROM fornecedores WHERE id = $1 AND usuario_id = $2 RETURNING id', [req.params.id, req.user.id]);
  if (!r.length) throw new Erro(404, 'Fornecedor não encontrado.');
  res.json({ ok: true });
}));

module.exports = { orgaos, fornecedores };
