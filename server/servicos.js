// Regras de negócio compartilhadas (usadas dentro de transações)
const { txt, numero, data, somaDias, hoje, PORTAIS, MODALIDADES } = require('./util');

// Cria ou atualiza o órgão pelo código UASG (ou pelo nome, quando não houver UASG)
async function garantirOrgao(db, usuarioId, o) {
  if (!o) return null;
  if (o.id) {
    const ex = await db.one('SELECT id FROM orgaos WHERE id = $1 AND usuario_id = $2', [o.id, usuarioId]);
    if (ex) return ex.id;
  }
  const nome = txt(o.nome, 200);
  const uasg = txt(o.uasg, 20);
  if (!nome && !uasg) return null;
  let ex = null;
  if (uasg) ex = await db.one('SELECT * FROM orgaos WHERE usuario_id = $1 AND uasg = $2', [usuarioId, uasg]);
  if (!ex && nome) ex = await db.one('SELECT * FROM orgaos WHERE usuario_id = $1 AND upper(nome) = upper($2)', [usuarioId, nome]);
  if (ex) {
    await db.q(
      `UPDATE orgaos SET nome = COALESCE($2, nome), uasg = COALESCE(uasg, $3), cnpj = COALESCE(cnpj, $4), endereco = COALESCE(endereco, $5),
         municipio = COALESCE(municipio, $6), uf = COALESCE(uf, $7), telefone = COALESCE(telefone, $8) WHERE id = $1`,
      [ex.id, nome, uasg, txt(o.cnpj, 30), txt(o.endereco, 300), txt(o.municipio, 100), txt(o.uf, 2), txt(o.telefone, 120)]
    );
    return ex.id;
  }
  const novo = await db.one(
    `INSERT INTO orgaos (usuario_id, uasg, nome, cnpj, endereco, municipio, uf, telefone)
     VALUES ($1,$2,$3,$4,$5,$6,$7,$8) RETURNING id`,
    [usuarioId, uasg, nome || `UASG ${uasg}`, txt(o.cnpj, 30), txt(o.endereco, 300), txt(o.municipio, 100), txt(o.uf, 2), txt(o.telefone, 120)]
  );
  return novo.id;
}

async function fornecedorDoUsuario(db, usuarioId, id) {
  if (!id) return null;
  const f = await db.one('SELECT id FROM fornecedores WHERE id = $1 AND usuario_id = $2', [id, usuarioId]);
  return f ? f.id : null;
}

async function salvarItensVenda(db, usuarioId, vendaId, itens) {
  await db.q('DELETE FROM venda_itens WHERE venda_id = $1', [vendaId]);
  let ordem = 0;
  for (const it of itens || []) {
    const desc = txt(it.descricao, 4000);
    if (!desc) continue;
    ordem++;
    const custo = numero(it.custo_unit);
    await db.q(
      `INSERT INTO venda_itens (venda_id, ordem, numero_item, descricao, unidade, quantidade, valor_unit, custo_unit, fornecedor_id)
       VALUES ($1,$2,$3,$4,$5,$6,$7,$8,$9)`,
      [vendaId, ordem, numero(it.numero_item), desc, txt(it.unidade, 20) || 'UN', numero(it.quantidade) ?? 1, numero(it.valor_unit) ?? 0,
        custo === null ? null : custo, await fornecedorDoUsuario(db, usuarioId, it.fornecedor_id)]
    );
  }
  if (!ordem) throw Object.assign(new Error('Inclua pelo menos um item na venda.'), { status: 400 });
}

// Lança no caixa a saída do pagamento ao fornecedor e do frete quando marcados como pagos
async function sincronizarCaixaVenda(db, vendaId) {
  const v = await db.one('SELECT * FROM vendas_resumo WHERE id = $1', [vendaId]);
  if (!v) return;
  await db.q("DELETE FROM caixa WHERE venda_id = $1 AND origem IN ('fornecedor','frete')", [vendaId]);
  if (v.status === 'cancelada') return;
  const ref = v.numero_empenho ? ` — ${v.numero_empenho}` : '';
  const custoForn = v.custo_produtos + (v.outros_custos || 0);
  if (v.fornecedor_pago && custoForn > 0) {
    await db.q(
      `INSERT INTO caixa (usuario_id, tipo, categoria, descricao, valor, data, venda_id, origem)
       VALUES ($1,'saida','Compra de mercadoria',$2,$3,$4,$5,'fornecedor')`,
      [v.usuario_id, `Fornecedor: ${v.objeto}${ref}`.slice(0, 300), custoForn, v.fornecedor_pago_em || hoje(), vendaId]
    );
  }
  if (v.frete_pago && v.frete > 0) {
    await db.q(
      `INSERT INTO caixa (usuario_id, tipo, categoria, descricao, valor, data, venda_id, origem)
       VALUES ($1,'saida','Frete',$2,$3,$4,$5,'frete')`,
      [v.usuario_id, `Frete: ${v.objeto}${ref}`.slice(0, 300), v.frete, v.frete_pago_em || hoje(), vendaId]
    );
  }
}

// Venda vira "paga" quando o recebido cobre o total; volta ao estágio anterior se um recebimento for removido
async function sincronizarStatus(db, vendaId) {
  const v = await db.one('SELECT id, status, valor_total, valor_recebido, nf_numero, data_entrega FROM vendas_resumo WHERE id = $1', [vendaId]);
  if (!v || v.status === 'cancelada') return;
  if (v.valor_total > 0 && v.valor_recebido >= v.valor_total - 0.009) {
    if (v.status !== 'paga') await db.q("UPDATE vendas SET status = 'paga', atualizado_em = now() WHERE id = $1", [vendaId]);
  } else if (v.status === 'paga') {
    const volta = v.nf_numero ? 'faturada' : v.data_entrega ? 'entregue' : 'empenhada';
    await db.q('UPDATE vendas SET status = $2, atualizado_em = now() WHERE id = $1', [vendaId, volta]);
  }
}

function camposVenda(b, usuario) {
  const dataEmp = data(b.data_empenho) || hoje();
  const prazo = numero(b.prazo_entrega_dias);
  const nfData = data(b.nf_data);
  let limite = data(b.data_limite_entrega);
  if (!limite && prazo) limite = somaDias(dataEmp, prazo);
  let prevPg = data(b.data_prev_pagamento);
  if (!prevPg && nfData) prevPg = somaDias(nfData, usuario.dias_pagamento_padrao || 30);
  const portal = txt(b.portal, 60);
  const modalidade = txt(b.modalidade, 60);
  return {
    objeto: txt(b.objeto, 300),
    descricao: txt(b.descricao, 4000),
    numero_empenho: txt(b.numero_empenho, 40),
    processo: txt(b.processo, 80),
    numero_compra: txt(b.numero_compra, 40),
    portal: portal && PORTAIS.includes(portal) ? portal : portal || 'Compras.gov.br',
    modalidade: modalidade && MODALIDADES.includes(modalidade) ? modalidade : modalidade || 'Dispensa eletrônica',
    data_empenho: dataEmp,
    prazo_entrega_dias: prazo,
    data_limite_entrega: limite,
    data_entrega: data(b.data_entrega),
    local_entrega: txt(b.local_entrega, 500),
    nf_numero: txt(b.nf_numero, 40),
    nf_chave: txt(b.nf_chave, 60),
    nf_data: nfData,
    data_prev_pagamento: prevPg,
    frete: numero(b.frete) || 0,
    frete_tipo: (numero(b.frete) || 0) > 0 ? 'FOB' : 'CIF',
    outros_custos: numero(b.outros_custos) || 0,
    obs: txt(b.obs, 4000),
  };
}

module.exports = { garantirOrgao, salvarItensVenda, sincronizarCaixaVenda, sincronizarStatus, camposVenda, fornecedorDoUsuario };
