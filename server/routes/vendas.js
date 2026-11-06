const router = require('express').Router();
const { q, one, tx } = require('../db');
const { wrap, Erro, txt, numero, data, hoje, STATUS_VENDA } = require('../util');
const S = require('../servicos');

const ORDENS = { data: 'data_empenho DESC, criado_em DESC', valor: 'valor_total DESC', lucro: 'lucro DESC NULLS LAST', entrega: 'data_limite_entrega ASC NULLS LAST', pagamento: 'data_prev_pagamento ASC NULLS LAST' };

router.get('/', wrap(async (req, res) => {
  const p = [req.user.id];
  const w = ['usuario_id = $1'];
  const add = (cond, val) => { p.push(val); w.push(cond.replace('?', `$${p.length}`)); };
  const { status, portal, orgao_id, de, ate, busca, fornecedor_id, situacao } = req.query;
  if (status === 'abertas') w.push("status NOT IN ('paga','cancelada')");
  else if (status && STATUS_VENDA.includes(status)) add('status = ?', status);
  if (portal) add('portal = ?', portal);
  if (orgao_id) add('orgao_id = ?', orgao_id);
  if (data(de)) add('data_empenho >= ?', data(de));
  if (data(ate)) add('data_empenho <= ?', data(ate));
  if (fornecedor_id) add('id IN (SELECT venda_id FROM venda_itens WHERE fornecedor_id = ?)', fornecedor_id);
  if (situacao === 'entrega_atrasada') w.push("data_limite_entrega < current_date AND status IN ('empenhada','comprada','em_transito')");
  if (situacao === 'pagamento_atrasado') w.push("data_prev_pagamento < current_date AND status NOT IN ('paga','cancelada') AND saldo_receber > 0");
  if (situacao === 'sem_custo') w.push("(custo_produtos = 0 OR itens_sem_custo > 0) AND status <> 'cancelada'");
  if (situacao === 'prejuizo') w.push('lucro < 0');
  if (situacao === 'fornecedor_a_pagar') w.push("NOT fornecedor_pago AND custo_produtos > 0 AND status <> 'cancelada'");
  if (busca) {
    p.push(`%${String(busca).trim()}%`);
    const k = `$${p.length}`;
    w.push(`(objeto ILIKE ${k} OR descricao ILIKE ${k} OR numero_empenho ILIKE ${k} OR numero_compra ILIKE ${k} OR processo ILIKE ${k} OR orgao_nome ILIKE ${k} OR orgao_uasg ILIKE ${k} OR nf_numero ILIKE ${k}
      OR id IN (SELECT venda_id FROM venda_itens WHERE descricao ILIKE ${k}))`);
  }
  const ordem = ORDENS[req.query.ordem] || ORDENS.data;
  const lista = await q(`SELECT * FROM vendas_resumo WHERE ${w.join(' AND ')} ORDER BY ${ordem} LIMIT 1000`, p);
  const ativos = lista.filter((v) => v.status !== 'cancelada');
  const soma = (f) => Math.round(ativos.reduce((s, v) => s + (Number(v[f]) || 0), 0) * 100) / 100;
  res.json({
    vendas: lista,
    totais: {
      quantidade: ativos.length,
      valor_total: soma('valor_total'),
      recebido: soma('valor_recebido'),
      a_receber: soma('saldo_receber'),
      custo: soma('custo_total'),
      lucro: soma('lucro'),
    },
  });
}));

router.get('/verificar-empenho', wrap(async (req, res) => {
  const n = txt(req.query.numero, 40);
  if (!n) return res.json({ existe: false });
  const digitos = n.replace(/\D/g, '');
  const ano = digitos.slice(0, 4);
  const num = String(parseInt(digitos.slice(4) || '0', 10));
  const v = await one(
    `SELECT id, objeto, numero_empenho FROM vendas WHERE usuario_id = $1
       AND regexp_replace(numero_empenho, '\\D', '', 'g') ~ ('^' || $2 || '0*' || $3 || '$') LIMIT 1`,
    [req.user.id, ano, num]
  );
  res.json({ existe: !!v, venda: v });
}));

router.get('/:id', wrap(async (req, res) => {
  const v = await one('SELECT * FROM vendas_resumo WHERE id = $1 AND usuario_id = $2', [req.params.id, req.user.id]);
  if (!v) throw new Erro(404, 'Venda não encontrada.');
  const [itens, recebimentos, orgao] = await Promise.all([
    q(`SELECT i.*, f.nome AS fornecedor_nome, f.telefone AS fornecedor_telefone, f.email AS fornecedor_email
       FROM venda_itens i LEFT JOIN fornecedores f ON f.id = i.fornecedor_id WHERE venda_id = $1 ORDER BY ordem`, [v.id]),
    q('SELECT * FROM recebimentos WHERE venda_id = $1 ORDER BY data DESC, criado_em DESC', [v.id]),
    v.orgao_id ? one('SELECT * FROM orgaos WHERE id = $1', [v.orgao_id]) : null,
  ]);
  res.json({ venda: v, itens, recebimentos, orgao });
}));

router.post('/', wrap(async (req, res) => {
  const b = req.body;
  const c = S.camposVenda(b, req.user);
  if (!c.objeto) throw new Erro(400, 'Descreva o objeto da venda (ex.: "Fios elétricos").');
  const id = await tx(async (db) => {
    const orgaoId = await S.garantirOrgao(db, req.user.id, b.orgao || (b.orgao_id ? { id: b.orgao_id } : null));
    const status = STATUS_VENDA.includes(b.status) ? b.status : 'empenhada';
    const v = await db.one(
      `INSERT INTO vendas (usuario_id, orgao_id, oportunidade_id, objeto, descricao, numero_empenho, processo, numero_compra, portal, modalidade,
         data_empenho, prazo_entrega_dias, data_limite_entrega, data_entrega, local_entrega, nf_numero, nf_chave, nf_data, data_prev_pagamento,
         status, frete, frete_tipo, outros_custos, obs)
       VALUES ($1,$2,$3,$4,$5,$6,$7,$8,$9,$10,$11,$12,$13,$14,$15,$16,$17,$18,$19,$20,$21,$22,$23,$24) RETURNING id`,
      [req.user.id, orgaoId, b.oportunidade_id || null, c.objeto, c.descricao, c.numero_empenho, c.processo, c.numero_compra, c.portal, c.modalidade,
        c.data_empenho, c.prazo_entrega_dias, c.data_limite_entrega, c.data_entrega, c.local_entrega, c.nf_numero, c.nf_chave, c.nf_data, c.data_prev_pagamento,
        status, c.frete, c.frete_tipo, c.outros_custos, c.obs]
    );
    await S.salvarItensVenda(db, req.user.id, v.id, b.itens);
    if (b.fornecedor_pago || b.frete_pago) {
      await db.q('UPDATE vendas SET fornecedor_pago = $2, fornecedor_pago_em = $3, frete_pago = $4, frete_pago_em = $5 WHERE id = $1',
        [v.id, !!b.fornecedor_pago, data(b.fornecedor_pago_em) || (b.fornecedor_pago ? c.data_empenho : null), !!b.frete_pago, data(b.frete_pago_em) || (b.frete_pago ? c.data_empenho : null)]);
    }
    await S.sincronizarCaixaVenda(db, v.id);
    return v.id;
  });
  res.status(201).json({ venda: await one('SELECT * FROM vendas_resumo WHERE id = $1', [id]) });
}));

router.put('/:id', wrap(async (req, res) => {
  const b = req.body;
  const atual = await one('SELECT * FROM vendas WHERE id = $1 AND usuario_id = $2', [req.params.id, req.user.id]);
  if (!atual) throw new Erro(404, 'Venda não encontrada.');
  const c = S.camposVenda({ ...atual, ...b, data_limite_entrega: b.data_limite_entrega ?? (b.prazo_entrega_dias !== undefined || b.data_empenho !== undefined ? null : atual.data_limite_entrega), data_prev_pagamento: b.data_prev_pagamento ?? (b.nf_data !== undefined ? null : atual.data_prev_pagamento) }, req.user);
  if (!c.objeto) throw new Erro(400, 'Descreva o objeto da venda.');
  await tx(async (db) => {
    const orgaoId = b.orgao || b.orgao_id !== undefined ? await S.garantirOrgao(db, req.user.id, b.orgao || (b.orgao_id ? { id: b.orgao_id } : null)) : atual.orgao_id;
    const status = STATUS_VENDA.includes(b.status) ? b.status : atual.status;
    await db.q(
      `UPDATE vendas SET orgao_id=$2, objeto=$3, descricao=$4, numero_empenho=$5, processo=$6, numero_compra=$7, portal=$8, modalidade=$9,
         data_empenho=$10, prazo_entrega_dias=$11, data_limite_entrega=$12, data_entrega=$13, local_entrega=$14, nf_numero=$15, nf_chave=$16, nf_data=$17,
         data_prev_pagamento=$18, status=$19, frete=$20, frete_tipo=$21, outros_custos=$22, obs=$23, atualizado_em=now() WHERE id=$1`,
      [atual.id, orgaoId, c.objeto, c.descricao, c.numero_empenho, c.processo, c.numero_compra, c.portal, c.modalidade, c.data_empenho, c.prazo_entrega_dias,
        c.data_limite_entrega, c.data_entrega, c.local_entrega, c.nf_numero, c.nf_chave, c.nf_data, c.data_prev_pagamento, status, c.frete, c.frete_tipo, c.outros_custos, c.obs]
    );
    if (Array.isArray(b.itens)) await S.salvarItensVenda(db, req.user.id, atual.id, b.itens);
    await S.sincronizarStatus(db, atual.id);
    await S.sincronizarCaixaVenda(db, atual.id);
  });
  res.json({ venda: await one('SELECT * FROM vendas_resumo WHERE id = $1', [atual.id]) });
}));

// Avança etapas e marca pagamentos ao fornecedor/frete sem reenviar o formulário inteiro
router.patch('/:id', wrap(async (req, res) => {
  const b = req.body;
  const atual = await one('SELECT * FROM vendas WHERE id = $1 AND usuario_id = $2', [req.params.id, req.user.id]);
  if (!atual) throw new Erro(404, 'Venda não encontrada.');
  const sets = [];
  const p = [atual.id];
  const set = (col, val) => { p.push(val); sets.push(`${col} = $${p.length}`); };
  if (b.status !== undefined) {
    if (!STATUS_VENDA.includes(b.status)) throw new Erro(400, 'Etapa inválida.');
    set('status', b.status);
    if (b.status === 'entregue' && !atual.data_entrega) set('data_entrega', data(b.data_entrega) || hoje());
  }
  if (b.data_entrega !== undefined && b.status === undefined) set('data_entrega', data(b.data_entrega));
  if (b.fornecedor_pago !== undefined) { set('fornecedor_pago', !!b.fornecedor_pago); set('fornecedor_pago_em', b.fornecedor_pago ? data(b.fornecedor_pago_em) || hoje() : null); }
  if (b.frete_pago !== undefined) { set('frete_pago', !!b.frete_pago); set('frete_pago_em', b.frete_pago ? data(b.frete_pago_em) || hoje() : null); }
  if (b.nf_numero !== undefined) {
    set('nf_numero', txt(b.nf_numero, 40));
    const nfData = data(b.nf_data) || (b.nf_numero ? hoje() : null);
    set('nf_data', nfData);
    if (b.nf_chave !== undefined) set('nf_chave', txt(b.nf_chave, 60));
    set('data_prev_pagamento', data(b.data_prev_pagamento) || (nfData ? require('../util').somaDias(nfData, req.user.dias_pagamento_padrao || 30) : null));
    if (b.nf_numero && ['empenhada', 'comprada', 'em_transito', 'entregue'].includes(atual.status) && b.status === undefined) set('status', 'faturada');
  }
  if (!sets.length) throw new Erro(400, 'Nada para atualizar.');
  await tx(async (db) => {
    await db.q(`UPDATE vendas SET ${sets.join(', ')}, atualizado_em = now() WHERE id = $1`, p);
    await S.sincronizarStatus(db, atual.id);
    await S.sincronizarCaixaVenda(db, atual.id);
  });
  res.json({ venda: await one('SELECT * FROM vendas_resumo WHERE id = $1', [atual.id]) });
}));

router.delete('/:id', wrap(async (req, res) => {
  const r = await q('DELETE FROM vendas WHERE id = $1 AND usuario_id = $2 RETURNING id', [req.params.id, req.user.id]);
  if (!r.length) throw new Erro(404, 'Venda não encontrada.');
  await q('UPDATE oportunidades SET venda_id = NULL WHERE venda_id = $1', [req.params.id]);
  res.json({ ok: true });
}));

// ---- Recebimentos da venda
router.post('/:id/recebimentos', wrap(async (req, res) => {
  const v = await one('SELECT * FROM vendas_resumo WHERE id = $1 AND usuario_id = $2', [req.params.id, req.user.id]);
  if (!v) throw new Erro(404, 'Venda não encontrada.');
  if (v.status === 'cancelada') throw new Erro(400, 'Venda cancelada não recebe pagamentos.');
  const valor = numero(req.body.valor);
  if (!valor || valor <= 0) throw new Erro(400, 'Informe o valor recebido.');
  if (valor > v.saldo_receber + 0.01) throw new Erro(400, `O valor passa do saldo a receber (R$ ${v.saldo_receber.toFixed(2).replace('.', ',')}).`);
  const dt = data(req.body.data) || hoje();
  await tx(async (db) => {
    const r = await db.one('INSERT INTO recebimentos (usuario_id, venda_id, valor, data, forma, obs) VALUES ($1,$2,$3,$4,$5,$6) RETURNING id',
      [req.user.id, v.id, valor, dt, txt(req.body.forma, 60) || 'Ordem bancária', txt(req.body.obs, 500)]);
    await db.q(
      `INSERT INTO caixa (usuario_id, tipo, categoria, descricao, valor, data, venda_id, recebimento_id, origem)
       VALUES ($1,'entrada','Recebimento de venda',$2,$3,$4,$5,$6,'recebimento')`,
      [req.user.id, `${v.objeto}${v.numero_empenho ? ' — ' + v.numero_empenho : ''}${v.orgao_nome ? ' (' + v.orgao_nome + ')' : ''}`.slice(0, 300), valor, dt, v.id, r.id]
    );
    await S.sincronizarStatus(db, v.id);
  });
  res.status(201).json({ venda: await one('SELECT * FROM vendas_resumo WHERE id = $1', [v.id]) });
}));

router.delete('/:id/recebimentos/:rid', wrap(async (req, res) => {
  const r = await one('SELECT * FROM recebimentos WHERE id = $1 AND venda_id = $2 AND usuario_id = $3', [req.params.rid, req.params.id, req.user.id]);
  if (!r) throw new Erro(404, 'Recebimento não encontrado.');
  await tx(async (db) => {
    await db.q('DELETE FROM recebimentos WHERE id = $1', [r.id]);
    await S.sincronizarStatus(db, r.venda_id);
  });
  res.json({ venda: await one('SELECT * FROM vendas_resumo WHERE id = $1', [r.venda_id]) });
}));

module.exports = router;
