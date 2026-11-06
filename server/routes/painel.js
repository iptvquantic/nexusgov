const router = require('express').Router();
const { q, one } = require('../db');
const { wrap, data, hoje } = require('../util');

const arred = (n) => Math.round((Number(n) || 0) * 100) / 100;

router.get('/dashboard', wrap(async (req, res) => {
  const u = req.user.id;
  const ano = new Date().getFullYear();
  const [k, oport, caixa, mensal, porPortal, topOrgaos, funil, entregas, pagamentos, sessoes, semCusto, fornAPagar] = await Promise.all([
    one(`SELECT
        COALESCE(SUM(valor_total) FILTER (WHERE extract(year FROM data_empenho) = $2), 0) AS vendido_ano,
        COALESCE(SUM(valor_total) FILTER (WHERE extract(year FROM data_empenho) = $2 AND extract(month FROM data_empenho) = extract(month FROM current_date)), 0) AS vendido_mes,
        COALESCE(SUM(valor_recebido), 0) AS recebido_total,
        COALESCE(SUM(saldo_receber) FILTER (WHERE status <> 'paga'), 0) AS a_receber,
        COALESCE(SUM(lucro) FILTER (WHERE status = 'paga'), 0) AS lucro_realizado,
        COALESCE(SUM(lucro) FILTER (WHERE status <> 'paga'), 0) AS lucro_a_realizar,
        COALESCE(SUM(lucro) FILTER (WHERE extract(year FROM data_empenho) = $2), 0) AS lucro_ano,
        COALESCE(SUM(valor_total) FILTER (WHERE lucro IS NOT NULL), 0) AS base_margem,
        COALESCE(SUM(lucro), 0) AS lucro_total,
        COUNT(*) AS vendas,
        COUNT(*) FILTER (WHERE status NOT IN ('paga')) AS vendas_abertas,
        COUNT(*) FILTER (WHERE lucro < 0) AS vendas_prejuizo
      FROM vendas_resumo WHERE usuario_id = $1 AND status <> 'cancelada'`, [u, ano]),
    one(`SELECT COUNT(*) FILTER (WHERE o.status IN ('cotando','enviada')) AS abertas,
        COALESCE(SUM(i.valor) FILTER (WHERE o.status IN ('cotando','enviada')), 0) AS valor_aberto,
        COUNT(*) FILTER (WHERE o.status = 'ganha') AS ganhas, COUNT(*) FILTER (WHERE o.status = 'perdida') AS perdidas
      FROM oportunidades o LEFT JOIN LATERAL (SELECT SUM(quantidade*preco_unit) AS valor FROM oportunidade_itens WHERE oportunidade_id = o.id) i ON true
      WHERE o.usuario_id = $1`, [u]),
    one(`SELECT COALESCE(SUM(CASE WHEN tipo='entrada' THEN valor ELSE -valor END), 0) AS saldo,
        COALESCE(SUM(valor) FILTER (WHERE tipo='saida' AND origem='manual' AND date_trunc('month', data) = date_trunc('month', current_date)), 0) AS despesas_mes
      FROM caixa WHERE usuario_id = $1`, [u]),
    q(`WITH meses AS (SELECT generate_series(date_trunc('month', current_date) - interval '11 months', date_trunc('month', current_date), interval '1 month')::date AS m)
       SELECT to_char(m, 'MM/YY') AS mes,
         COALESCE((SELECT SUM(valor_total) FROM vendas_resumo WHERE usuario_id = $1 AND status <> 'cancelada' AND date_trunc('month', data_empenho) = m), 0) AS vendido,
         COALESCE((SELECT SUM(lucro) FROM vendas_resumo WHERE usuario_id = $1 AND status <> 'cancelada' AND date_trunc('month', data_empenho) = m), 0) AS lucro,
         COALESCE((SELECT SUM(valor) FROM recebimentos WHERE usuario_id = $1 AND date_trunc('month', data) = m), 0) AS recebido,
         COALESCE((SELECT SUM(valor) FROM caixa WHERE usuario_id = $1 AND tipo = 'saida' AND origem = 'manual' AND date_trunc('month', data) = m), 0) AS despesas
       FROM meses ORDER BY m`, [u]),
    q(`SELECT portal, COUNT(*) AS vendas, SUM(valor_total) AS valor, SUM(lucro) AS lucro FROM vendas_resumo
       WHERE usuario_id = $1 AND status <> 'cancelada' GROUP BY portal ORDER BY valor DESC`, [u]),
    q(`SELECT orgao_id, COALESCE(orgao_nome, 'Sem órgão') AS nome, orgao_uasg AS uasg, COUNT(*) AS vendas, SUM(valor_total) AS valor, SUM(lucro) AS lucro
       FROM vendas_resumo WHERE usuario_id = $1 AND status <> 'cancelada' GROUP BY orgao_id, orgao_nome, orgao_uasg ORDER BY valor DESC LIMIT 6`, [u]),
    q(`SELECT status, COUNT(*) AS qtd, SUM(valor_total) AS valor FROM vendas_resumo WHERE usuario_id = $1 GROUP BY status`, [u]),
    q(`SELECT id, objeto, orgao_nome, numero_empenho, data_limite_entrega, status, (data_limite_entrega - current_date) AS dias
       FROM vendas_resumo WHERE usuario_id = $1 AND status IN ('empenhada','comprada','em_transito') AND data_limite_entrega IS NOT NULL
       ORDER BY data_limite_entrega LIMIT 8`, [u]),
    q(`SELECT id, objeto, orgao_nome, numero_empenho, saldo_receber, data_prev_pagamento, nf_data, (data_prev_pagamento - current_date) AS dias
       FROM vendas_resumo WHERE usuario_id = $1 AND status NOT IN ('paga','cancelada') AND saldo_receber > 0
       ORDER BY data_prev_pagamento ASC NULLS LAST LIMIT 8`, [u]),
    q(`SELECT o.id, o.objeto, o.numero, o.uasg, o.orgao_nome, o.data_sessao, o.status FROM oportunidades o
       WHERE o.usuario_id = $1 AND o.status IN ('cotando','enviada') AND o.data_sessao >= now() - interval '1 day'
       ORDER BY o.data_sessao LIMIT 6`, [u]),
    one(`SELECT COUNT(*) AS n FROM vendas_resumo WHERE usuario_id = $1 AND status <> 'cancelada' AND (custo_produtos = 0 OR itens_sem_custo > 0)`, [u]),
    one(`SELECT COUNT(*) AS n, COALESCE(SUM(custo_produtos + outros_custos), 0) AS valor FROM vendas_resumo
       WHERE usuario_id = $1 AND status <> 'cancelada' AND NOT fornecedor_pago AND custo_produtos > 0`, [u]),
  ]);

  const alertas = [];
  const atrasadas = entregas.filter((e) => e.dias < 0);
  if (atrasadas.length) alertas.push({ nivel: 'erro', texto: `${atrasadas.length} entrega(s) com prazo vencido`, link: '/vendas?situacao=entrega_atrasada' });
  const proximas = entregas.filter((e) => e.dias >= 0 && e.dias <= 5);
  if (proximas.length) alertas.push({ nivel: 'aviso', texto: `${proximas.length} entrega(s) vencem em até 5 dias`, link: '/vendas?status=abertas&ordem=entrega' });
  const pgAtrasados = pagamentos.filter((p) => p.dias !== null && p.dias < 0);
  if (pgAtrasados.length) alertas.push({ nivel: 'erro', texto: `${pgAtrasados.length} pagamento(s) do governo em atraso`, link: '/vendas?situacao=pagamento_atrasado' });
  const sessoesHoje = sessoes.filter((s) => s.data_sessao && new Date(s.data_sessao) - Date.now() < 2 * 86400000 && new Date(s.data_sessao) > Date.now());
  if (sessoesHoje.length) alertas.push({ nivel: 'info', texto: `${sessoesHoje.length} disputa(s) nas próximas 48 horas`, link: '/oportunidades' });
  if (semCusto.n) alertas.push({ nivel: 'aviso', texto: `${semCusto.n} venda(s) sem custo informado — o lucro delas não aparece`, link: '/vendas?situacao=sem_custo' });
  if (k.vendas_prejuizo) alertas.push({ nivel: 'erro', texto: `${k.vendas_prejuizo} venda(s) com prejuízo`, link: '/vendas?situacao=prejuizo' });
  if (fornAPagar.n) alertas.push({ nivel: 'info', texto: `${fornAPagar.n} compra(s) de fornecedor ainda não marcadas como pagas`, link: '/vendas?situacao=fornecedor_a_pagar' });
  const limite = req.user.limite_mei || 81000;
  const usoMei = limite ? k.vendido_ano / limite : 0;
  if (usoMei >= 0.8) alertas.push({ nivel: usoMei >= 1 ? 'erro' : 'aviso', texto: `Faturamento do ano em ${Math.round(usoMei * 100)}% do limite do MEI`, link: '/relatorios' });

  const disputadas = oport.ganhas + oport.perdidas;
  res.json({
    kpis: {
      ...Object.fromEntries(Object.entries(k).map(([a, b]) => [a, typeof b === 'number' ? arred(b) : b])),
      margem_media: k.base_margem ? arred((k.lucro_total / k.base_margem) * 100) : null,
      saldo_caixa: arred(caixa.saldo),
      despesas_mes: arred(caixa.despesas_mes),
      oportunidades_abertas: oport.abertas,
      valor_oportunidades: arred(oport.valor_aberto),
      taxa_vitoria: disputadas ? Math.round((oport.ganhas / disputadas) * 100) : null,
      fornecedor_a_pagar: arred(fornAPagar.valor),
      limite_mei: limite,
      uso_mei: Math.round(usoMei * 1000) / 10,
    },
    alertas,
    mensal,
    por_portal: porPortal,
    top_orgaos: topOrgaos,
    funil,
    entregas,
    pagamentos,
    sessoes,
  });
}));

router.get('/relatorio', wrap(async (req, res) => {
  const u = req.user.id;
  const de = data(req.query.de) || `${new Date().getFullYear()}-01-01`;
  const ate = data(req.query.ate) || hoje();
  const [vendas, recebido, despesas, porOrgao, porPortal, porFornecedor, porModalidade] = await Promise.all([
    q(`SELECT id, data_empenho, objeto, numero_empenho, orgao_nome, orgao_uasg, portal, modalidade, status, valor_total, custo_produtos, frete,
         outros_custos, custo_total, lucro, margem, valor_recebido, saldo_receber, nf_numero, nf_data
       FROM vendas_resumo WHERE usuario_id = $1 AND status <> 'cancelada' AND data_empenho BETWEEN $2 AND $3 ORDER BY data_empenho`, [u, de, ate]),
    one('SELECT COALESCE(SUM(valor), 0) AS total FROM recebimentos WHERE usuario_id = $1 AND data BETWEEN $2 AND $3', [u, de, ate]),
    q(`SELECT categoria, SUM(valor) AS valor, COUNT(*) AS qtd FROM caixa WHERE usuario_id = $1 AND tipo = 'saida' AND origem = 'manual'
       AND data BETWEEN $2 AND $3 GROUP BY categoria ORDER BY valor DESC`, [u, de, ate]),
    q(`SELECT COALESCE(orgao_nome, 'Sem órgão') AS nome, orgao_uasg AS uasg, COUNT(*) AS vendas, SUM(valor_total) AS valor, SUM(lucro) AS lucro
       FROM vendas_resumo WHERE usuario_id = $1 AND status <> 'cancelada' AND data_empenho BETWEEN $2 AND $3 GROUP BY 1, 2 ORDER BY valor DESC`, [u, de, ate]),
    q(`SELECT portal AS nome, COUNT(*) AS vendas, SUM(valor_total) AS valor, SUM(lucro) AS lucro
       FROM vendas_resumo WHERE usuario_id = $1 AND status <> 'cancelada' AND data_empenho BETWEEN $2 AND $3 GROUP BY 1 ORDER BY valor DESC`, [u, de, ate]),
    q(`SELECT COALESCE(f.nome, 'Sem fornecedor') AS nome, COUNT(DISTINCT v.id) AS vendas, SUM(i.quantidade * COALESCE(i.custo_unit, 0)) AS comprado,
         SUM(i.quantidade * i.valor_unit) AS vendido
       FROM venda_itens i JOIN vendas v ON v.id = i.venda_id LEFT JOIN fornecedores f ON f.id = i.fornecedor_id
       WHERE v.usuario_id = $1 AND v.status <> 'cancelada' AND v.data_empenho BETWEEN $2 AND $3 GROUP BY 1 ORDER BY comprado DESC`, [u, de, ate]),
    q(`SELECT modalidade AS nome, COUNT(*) AS vendas, SUM(valor_total) AS valor, SUM(lucro) AS lucro
       FROM vendas_resumo WHERE usuario_id = $1 AND status <> 'cancelada' AND data_empenho BETWEEN $2 AND $3 GROUP BY 1 ORDER BY valor DESC`, [u, de, ate]),
  ]);
  const soma = (f) => arred(vendas.reduce((s, v) => s + (Number(v[f]) || 0), 0));
  const totDespesas = arred(despesas.reduce((s, d) => s + d.valor, 0));
  const comCusto = vendas.filter((v) => v.lucro !== null);
  const lucroBruto = arred(comCusto.reduce((s, v) => s + v.lucro, 0));
  res.json({
    periodo: { de, ate },
    totais: {
      vendas: vendas.length, vendido: soma('valor_total'), custo: soma('custo_total'), lucro_bruto: lucroBruto,
      margem: comCusto.length ? arred((lucroBruto / comCusto.reduce((s, v) => s + v.valor_total, 0)) * 100) : null,
      recebido_periodo: arred(recebido.total), a_receber: soma('saldo_receber'), despesas: totDespesas,
      resultado: arred(lucroBruto - totDespesas), vendas_sem_custo: vendas.length - comCusto.length,
    },
    vendas, despesas, por_orgao: porOrgao, por_portal: porPortal, por_fornecedor: porFornecedor, por_modalidade: porModalidade,
  });
}));

module.exports = router;
