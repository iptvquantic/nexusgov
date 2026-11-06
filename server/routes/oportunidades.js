const router = require('express').Router();
const { q, one, tx } = require('../db');
const { wrap, Erro, txt, numero, hoje, somaDias, STATUS_OPORT } = require('../util');
const S = require('../servicos');

const SELECT = `
  SELECT o.*, COALESCE(i.valor, 0) AS valor_proposta, COALESCE(i.custo, 0) AS custo_itens, COALESCE(i.qtd, 0) AS qtd_itens,
    COALESCE(i.valor, 0) - COALESCE(i.custo, 0) - o.frete AS lucro_estimado,
    CASE WHEN COALESCE(i.valor, 0) > 0 THEN ROUND(((COALESCE(i.valor, 0) - COALESCE(i.custo, 0) - o.frete) / i.valor) * 100, 2) END AS margem_estimada
  FROM oportunidades o
  LEFT JOIN LATERAL (
    SELECT SUM(quantidade * preco_unit) AS valor, SUM(quantidade * custo_unit) AS custo, COUNT(*) AS qtd
    FROM oportunidade_itens WHERE oportunidade_id = o.id
  ) i ON true`;

function camposOport(b) {
  const status = STATUS_OPORT.includes(b.status) ? b.status : 'cotando';
  let sessao = txt(b.data_sessao, 40);
  if (sessao && /^\d{4}-\d{2}-\d{2}T\d{2}:\d{2}$/.test(sessao)) sessao += ':00-03:00';
  return {
    uasg: txt(b.uasg, 20), orgao_nome: txt(b.orgao_nome, 200), numero: txt(b.numero, 40),
    portal: txt(b.portal, 60) || 'Compras.gov.br', modalidade: txt(b.modalidade, 60) || 'Dispensa eletrônica',
    objeto: txt(b.objeto, 300), data_sessao: sessao, status, frete: numero(b.frete) || 0,
    margem_alvo: numero(b.margem_alvo) ?? 30, link: txt(b.link, 500), obs: txt(b.obs, 4000), motivo_perda: txt(b.motivo_perda, 500),
  };
}

async function salvarItens(db, usuarioId, id, itens) {
  await db.q('DELETE FROM oportunidade_itens WHERE oportunidade_id = $1', [id]);
  let ordem = 0;
  for (const it of itens || []) {
    const desc = txt(it.descricao, 4000);
    if (!desc) continue;
    ordem++;
    await db.q(
      `INSERT INTO oportunidade_itens (oportunidade_id, ordem, numero_item, descricao, unidade, quantidade, custo_unit, preco_unit, preco_referencia, fornecedor_id)
       VALUES ($1,$2,$3,$4,$5,$6,$7,$8,$9,$10)`,
      [id, ordem, numero(it.numero_item), desc, txt(it.unidade, 20) || 'UN', numero(it.quantidade) ?? 1, numero(it.custo_unit) || 0,
        numero(it.preco_unit) || 0, numero(it.preco_referencia), await S.fornecedorDoUsuario(db, usuarioId, it.fornecedor_id)]
    );
  }
}

router.get('/', wrap(async (req, res) => {
  const p = [req.user.id];
  const w = ['o.usuario_id = $1'];
  if (req.query.status === 'abertas') w.push("o.status IN ('cotando','enviada')");
  else if (STATUS_OPORT.includes(req.query.status)) { p.push(req.query.status); w.push(`o.status = $${p.length}`); }
  if (req.query.busca) {
    p.push(`%${req.query.busca}%`);
    const k = `$${p.length}`;
    w.push(`(o.objeto ILIKE ${k} OR o.numero ILIKE ${k} OR o.uasg ILIKE ${k} OR o.orgao_nome ILIKE ${k})`);
  }
  const lista = await q(`${SELECT} WHERE ${w.join(' AND ')}
    ORDER BY CASE WHEN o.status IN ('cotando','enviada') THEN 0 ELSE 1 END, o.data_sessao ASC NULLS LAST, o.criado_em DESC LIMIT 1000`, p);
  const resumo = await one(`SELECT
      COUNT(*) FILTER (WHERE status IN ('cotando','enviada')) AS abertas,
      COUNT(*) FILTER (WHERE status = 'ganha') AS ganhas,
      COUNT(*) FILTER (WHERE status = 'perdida') AS perdidas,
      COUNT(*) FILTER (WHERE status IN ('cotando','enviada') AND data_sessao BETWEEN now() AND now() + interval '3 days') AS proximas
    FROM oportunidades WHERE usuario_id = $1`, [req.user.id]);
  const disputadas = resumo.ganhas + resumo.perdidas;
  res.json({ oportunidades: lista, resumo: { ...resumo, taxa_vitoria: disputadas ? Math.round((resumo.ganhas / disputadas) * 100) : null } });
}));

router.get('/:id', wrap(async (req, res) => {
  const o = await one(`${SELECT} WHERE o.id = $1 AND o.usuario_id = $2`, [req.params.id, req.user.id]);
  if (!o) throw new Erro(404, 'Oportunidade não encontrada.');
  const itens = await q(`SELECT i.*, f.nome AS fornecedor_nome FROM oportunidade_itens i LEFT JOIN fornecedores f ON f.id = i.fornecedor_id
    WHERE oportunidade_id = $1 ORDER BY ordem`, [o.id]);
  res.json({ oportunidade: o, itens });
}));

router.post('/', wrap(async (req, res) => {
  const c = camposOport(req.body);
  if (!c.objeto) throw new Erro(400, 'Informe o objeto (o que está sendo comprado).');
  const id = await tx(async (db) => {
    const orgaoId = c.uasg || c.orgao_nome ? await S.garantirOrgao(db, req.user.id, { uasg: c.uasg, nome: c.orgao_nome }) : null;
    const o = await db.one(
      `INSERT INTO oportunidades (usuario_id, orgao_id, uasg, orgao_nome, numero, portal, modalidade, objeto, data_sessao, status, frete, margem_alvo, link, obs, motivo_perda)
       VALUES ($1,$2,$3,$4,$5,$6,$7,$8,$9,$10,$11,$12,$13,$14,$15) RETURNING id`,
      [req.user.id, orgaoId, c.uasg, c.orgao_nome, c.numero, c.portal, c.modalidade, c.objeto, c.data_sessao, c.status, c.frete, c.margem_alvo, c.link, c.obs, c.motivo_perda]
    );
    await salvarItens(db, req.user.id, o.id, req.body.itens);
    return o.id;
  });
  res.status(201).json({ oportunidade: await one(`${SELECT} WHERE o.id = $1`, [id]) });
}));

router.put('/:id', wrap(async (req, res) => {
  const atual = await one('SELECT * FROM oportunidades WHERE id = $1 AND usuario_id = $2', [req.params.id, req.user.id]);
  if (!atual) throw new Erro(404, 'Oportunidade não encontrada.');
  const c = camposOport({ ...atual, ...req.body });
  if (!c.objeto) throw new Erro(400, 'Informe o objeto.');
  await tx(async (db) => {
    const orgaoId = c.uasg || c.orgao_nome ? await S.garantirOrgao(db, req.user.id, { uasg: c.uasg, nome: c.orgao_nome }) : null;
    await db.q(
      `UPDATE oportunidades SET orgao_id=$2, uasg=$3, orgao_nome=$4, numero=$5, portal=$6, modalidade=$7, objeto=$8, data_sessao=$9, status=$10,
         frete=$11, margem_alvo=$12, link=$13, obs=$14, motivo_perda=$15, atualizado_em=now() WHERE id=$1`,
      [atual.id, orgaoId, c.uasg, c.orgao_nome, c.numero, c.portal, c.modalidade, c.objeto, c.data_sessao, c.status, c.frete, c.margem_alvo, c.link, c.obs, c.motivo_perda]
    );
    if (Array.isArray(req.body.itens)) await salvarItens(db, req.user.id, atual.id, req.body.itens);
  });
  res.json({ oportunidade: await one(`${SELECT} WHERE o.id = $1`, [atual.id]) });
}));

router.patch('/:id/status', wrap(async (req, res) => {
  if (!STATUS_OPORT.includes(req.body.status)) throw new Erro(400, 'Situação inválida.');
  const r = await q('UPDATE oportunidades SET status = $3, motivo_perda = COALESCE($4, motivo_perda), atualizado_em = now() WHERE id = $1 AND usuario_id = $2 RETURNING id',
    [req.params.id, req.user.id, req.body.status, txt(req.body.motivo_perda, 500)]);
  if (!r.length) throw new Erro(404, 'Oportunidade não encontrada.');
  res.json({ oportunidade: await one(`${SELECT} WHERE o.id = $1`, [req.params.id]) });
}));

// Ganhou: vira venda com os mesmos itens, preços e custos
router.post('/:id/converter', wrap(async (req, res) => {
  const o = await one('SELECT * FROM oportunidades WHERE id = $1 AND usuario_id = $2', [req.params.id, req.user.id]);
  if (!o) throw new Erro(404, 'Oportunidade não encontrada.');
  if (o.venda_id) {
    const ja = await one('SELECT id FROM vendas WHERE id = $1', [o.venda_id]);
    if (ja) return res.json({ venda_id: ja.id, ja_existia: true });
  }
  const itens = await q('SELECT * FROM oportunidade_itens WHERE oportunidade_id = $1 ORDER BY ordem', [o.id]);
  if (!itens.length) throw new Erro(400, 'Inclua os itens com preço antes de transformar em venda.');
  const prazo = numero(req.body.prazo_entrega_dias) ?? 30;
  const dataEmp = req.body.data_empenho || hoje();
  const vendaId = await tx(async (db) => {
    const v = await db.one(
      `INSERT INTO vendas (usuario_id, orgao_id, oportunidade_id, objeto, numero_empenho, numero_compra, portal, modalidade, data_empenho,
         prazo_entrega_dias, data_limite_entrega, frete, frete_tipo, obs, status)
       VALUES ($1,$2,$3,$4,$5,$6,$7,$8,$9,$10,$11,$12,$13,$14,'empenhada') RETURNING id`,
      [req.user.id, o.orgao_id, o.id, o.objeto, txt(req.body.numero_empenho, 40), o.numero, o.portal, o.modalidade, dataEmp, prazo,
        somaDias(dataEmp, prazo), o.frete, o.frete > 0 ? 'FOB' : 'CIF', o.obs]
    );
    await S.salvarItensVenda(db, req.user.id, v.id, itens.map((i) => ({ ...i, valor_unit: i.preco_unit, custo_unit: i.custo_unit || null })));
    await db.q("UPDATE oportunidades SET status = 'ganha', venda_id = $2, atualizado_em = now() WHERE id = $1", [o.id, v.id]);
    return v.id;
  });
  res.status(201).json({ venda_id: vendaId });
}));

router.delete('/:id', wrap(async (req, res) => {
  const r = await q('DELETE FROM oportunidades WHERE id = $1 AND usuario_id = $2 RETURNING id', [req.params.id, req.user.id]);
  if (!r.length) throw new Erro(404, 'Oportunidade não encontrada.');
  res.json({ ok: true });
}));

module.exports = router;
