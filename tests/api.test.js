// Testes da API contra um Postgres local: TEST_DATABASE_URL=postgres://... node --test tests/
const { test, before, after } = require('node:test');
const assert = require('node:assert/strict');
const fs = require('fs');
const path = require('path');
const { Client } = require('pg');

const DB_URL = process.env.TEST_DATABASE_URL || 'postgresql://nexusgov_app:teste@localhost:5433/nx';
process.env.DATABASE_URL = DB_URL;
process.env.DB_SSL = 'false';
process.env.JWT_SECRET = 'teste';
const app = require('../server/app');
const { getPool } = require('../server/db');

let srv, base;
const call = async (method, url, body, token, isForm) => {
  const headers = {};
  if (token) headers.Authorization = `Bearer ${token}`;
  let b;
  if (isForm) b = body; else if (body) { headers['Content-Type'] = 'application/json'; b = JSON.stringify(body); }
  const r = await fetch(base + url, { method, headers, body: b });
  const j = await r.json().catch(() => ({}));
  return { status: r.status, ...j };
};

before(async () => {
  const c = new Client({ connectionString: DB_URL });
  await c.connect();
  await c.query('DROP SCHEMA IF EXISTS nexusgov CASCADE');
  await c.query(fs.readFileSync(path.join(__dirname, '../server/schema.sql'), 'utf8'));
  await c.end();
  await new Promise((ok) => { srv = app.listen(0, ok); });
  base = `http://127.0.0.1:${srv.address().port}`;
});
after(async () => { srv.close(); await getPool().end(); });

let tk, tk2, vendaId, orgaoId, fornId;

test('cadastro, login e trial de 15 dias', async () => {
  const c = await call('POST', '/api/auth/cadastro', { nome: 'Gui', email: 'Gui@Teste.com', senha: '123456' });
  assert.equal(c.status, 201);
  assert.equal(c.usuario.plano, 'trial');
  assert.ok(c.usuario.dias_restantes >= 14 && c.usuario.dias_restantes <= 15);
  const dup = await call('POST', '/api/auth/cadastro', { nome: 'X', email: 'gui@teste.com', senha: '123456' });
  assert.equal(dup.status, 409);
  const bad = await call('POST', '/api/auth/login', { email: 'gui@teste.com', senha: 'errada' });
  assert.equal(bad.status, 401);
  const l = await call('POST', '/api/auth/login', { email: 'gui@teste.com', senha: '123456' });
  assert.equal(l.status, 200);
  tk = l.token;
  const o = await call('POST', '/api/auth/cadastro', { nome: 'Outro', email: 'outro@teste.com', senha: '123456' });
  tk2 = o.token;
});

test('fornecedor e venda com lucro calculado (custo + frete)', async () => {
  const f = await call('POST', '/api/fornecedores', { nome: 'Flex Fast', produtos: 'Cabos', telefone: '21 9999' }, tk);
  assert.equal(f.status, 201);
  fornId = f.fornecedor.id;
  const v = await call('POST', '/api/vendas', {
    objeto: 'Fios elétricos', numero_empenho: '2025NE473', data_empenho: '2025-11-27', prazo_entrega_dias: 30, frete: 360,
    orgao: { uasg: '781200', nome: '1º BATALHÃO', cnpj: '00.394.502/0190-82' },
    itens: [
      { descricao: 'Fio 16', quantidade: 4, valor_unit: 645, custo_unit: 470, fornecedor_id: fornId },
      { descricao: 'Fio 10', quantidade: 6, valor_unit: 320, custo_unit: 220.85, fornecedor_id: fornId },
      { descricao: 'Fio 4', quantidade: 7, valor_unit: 125, custo_unit: 90 },
      { descricao: 'Fio 2,5', quantidade: 10, valor_unit: 70, custo_unit: 47.39 },
    ],
  }, tk);
  assert.equal(v.status, 201, JSON.stringify(v));
  vendaId = v.venda.id;
  orgaoId = v.venda.orgao_id;
  assert.equal(v.venda.valor_total, 6075);
  assert.equal(v.venda.data_limite_entrega, '2025-12-27');
  assert.equal(v.venda.frete_tipo, 'FOB');
  const custo = 4 * 470 + 6 * 220.85 + 7 * 90 + 10 * 47.39;
  assert.ok(Math.abs(v.venda.lucro - (6075 - custo - 360)) < 0.01);
});

test('outro usuário não vê a venda (multi-empresa)', async () => {
  const r = await call('GET', `/api/vendas/${vendaId}`, null, tk2);
  assert.equal(r.status, 404);
  const l = await call('GET', '/api/vendas', null, tk2);
  assert.equal(l.vendas.length, 0);
});

test('etapas, NF, pagamento ao fornecedor vai para o caixa', async () => {
  let r = await call('PATCH', `/api/vendas/${vendaId}`, { status: 'entregue' }, tk);
  assert.equal(r.venda.status, 'entregue');
  assert.ok(r.venda.data_entrega);
  r = await call('PATCH', `/api/vendas/${vendaId}`, { nf_numero: '262303100', nf_data: '2026-03-23' }, tk);
  assert.equal(r.venda.status, 'faturada');
  assert.equal(r.venda.data_prev_pagamento, '2026-04-22');
  r = await call('PATCH', `/api/vendas/${vendaId}`, { fornecedor_pago: true, frete_pago: true }, tk);
  const cx = await call('GET', '/api/caixa', null, tk);
  assert.equal(cx.movimentos.filter((m) => m.origem === 'fornecedor').length, 1);
  assert.equal(cx.movimentos.filter((m) => m.origem === 'frete').length, 1);
  assert.ok(cx.totais.saldo_geral < 0);
  r = await call('PATCH', `/api/vendas/${vendaId}`, { frete_pago: false }, tk);
  const cx2 = await call('GET', '/api/caixa', null, tk);
  assert.equal(cx2.movimentos.filter((m) => m.origem === 'frete').length, 0);
});

test('recebimentos parcial e total mudam status e caixa', async () => {
  let r = await call('POST', `/api/vendas/${vendaId}/recebimentos`, { valor: '1.000,00', data: '2026-04-10' }, tk);
  assert.equal(r.status, 201);
  assert.equal(r.venda.valor_recebido, 1000);
  assert.equal(r.venda.status, 'faturada');
  const demais = await call('POST', `/api/vendas/${vendaId}/recebimentos`, { valor: 999999 }, tk);
  assert.equal(demais.status, 400);
  r = await call('POST', `/api/vendas/${vendaId}/recebimentos`, { valor: 5075, data: '2026-05-01' }, tk);
  assert.equal(r.venda.status, 'paga');
  assert.equal(r.venda.saldo_receber, 0);
  const det = await call('GET', `/api/vendas/${vendaId}`, null, tk);
  assert.equal(det.recebimentos.length, 2);
  const del = await call('DELETE', `/api/vendas/${vendaId}/recebimentos/${det.recebimentos[0].id}`, null, tk);
  assert.equal(del.venda.status, 'faturada');
  const cx = await call('GET', '/api/caixa', null, tk);
  assert.equal(cx.movimentos.filter((m) => m.origem === 'recebimento').length, 1);
  await call('POST', `/api/vendas/${vendaId}/recebimentos`, { valor: 5075, data: '2026-05-01' }, tk);
});

test('editar venda (PUT) recalcula itens e mantém caixa', async () => {
  const det = await call('GET', `/api/vendas/${vendaId}`, null, tk);
  const itens = det.itens.map((i) => ({ ...i }));
  itens[2].custo_unit = 100;
  const r = await call('PUT', `/api/vendas/${vendaId}`, { ...det.venda, itens }, tk);
  assert.equal(r.status, 200, JSON.stringify(r));
  assert.equal(r.venda.status, 'paga');
  const custo = 4 * 470 + 6 * 220.85 + 7 * 100 + 10 * 47.39;
  assert.ok(Math.abs(r.venda.lucro - (6075 - custo - 360)) < 0.01);
  const cx = await call('GET', '/api/caixa', null, tk);
  const forn = cx.movimentos.find((m) => m.origem === 'fornecedor');
  assert.ok(Math.abs(forn.valor - custo) < 0.01);
});

test('caixa manual com repetição mensal e bloqueio de lançamentos automáticos', async () => {
  const r = await call('POST', '/api/caixa', { tipo: 'saida', categoria: 'DAS / Impostos', descricao: 'DAS MEI', valor: 75.9, data: '2026-01-20', repetir_meses: 3 }, tk);
  assert.equal(r.movimentos.length, 3);
  assert.equal(r.movimentos[2].data, '2026-03-20');
  const cx = await call('GET', '/api/caixa', null, tk);
  const auto = cx.movimentos.find((m) => m.origem === 'recebimento');
  const del = await call('DELETE', `/api/caixa/${auto.id}`, null, tk);
  assert.equal(del.status, 400);
});

test('oportunidade com calculadora vira venda', async () => {
  const o = await call('POST', '/api/oportunidades', {
    objeto: 'Mangueira alta pressão', uasg: '160304', orgao_nome: 'BATALHÃO MANUTENÇÃO', numero: '90036/2026',
    data_sessao: '2030-01-10T09:00', frete: 0,
    itens: [{ descricao: 'Mangueira 30m', quantidade: 8, custo_unit: 106.35, preco_unit: 93.15, fornecedor_id: fornId }],
  }, tk);
  assert.equal(o.status, 201, JSON.stringify(o));
  assert.ok(o.oportunidade.lucro_estimado < 0);
  const lista = await call('GET', '/api/oportunidades?status=abertas', null, tk);
  assert.equal(lista.oportunidades.length, 1);
  const cv = await call('POST', `/api/oportunidades/${o.oportunidade.id}/converter`, { numero_empenho: '2026NE68' }, tk);
  assert.equal(cv.status, 201);
  const v = await call('GET', `/api/vendas/${cv.venda_id}`, null, tk);
  assert.equal(v.venda.valor_total, 745.2);
  assert.equal(v.venda.orgao_uasg, '160304');
  const again = await call('POST', `/api/oportunidades/${o.oportunidade.id}/converter`, {}, tk);
  assert.equal(again.ja_existia, true);
  const op = await call('GET', `/api/oportunidades/${o.oportunidade.id}`, null, tk);
  assert.equal(op.oportunidade.status, 'ganha');
});

test('importar PDF de empenho real e XML de NF-e', async () => {
  const pdf = '/mnt/user-data/uploads/TOP FLEX/Empenho/EMPENHO cabo pp 3x25 mm.pdf';
  if (fs.existsSync(pdf)) {
    const fd = new FormData();
    fd.append('arquivo', new Blob([fs.readFileSync(pdf)], { type: 'application/pdf' }), 'empenho.pdf');
    const r = await call('POST', '/api/importar/empenho', fd, tk, true);
    assert.equal(r.status, 200, JSON.stringify(r));
    assert.equal(r.empenho.orgao.uasg, '791500');
    assert.equal(r.empenho.valor_total, 4512);
    assert.equal(r.empenho.itens[0].quantidade, 600);
  }
  const fdDup = new FormData();
  const pdfFios = '/mnt/user-data/uploads/TOP FLEX/Empenho/EMPENHO FIOS (COMPROVANTE DE FORNECIMENTO).pdf';
  if (fs.existsSync(pdfFios)) {
    fdDup.append('arquivo', new Blob([fs.readFileSync(pdfFios)], { type: 'application/pdf' }), 'f.pdf');
    const r = await call('POST', '/api/importar/empenho', fdDup, tk, true);
    assert.ok(r.duplicada, 'deveria avisar empenho já cadastrado');
  }
  const xml = '/mnt/user-data/uploads/TOP FLEX/Empenho/NFE/arquivo xlm caixa descarga.xml';
  if (fs.existsSync(xml)) {
    const fd = new FormData();
    fd.append('arquivo', new Blob([fs.readFileSync(xml)], { type: 'text/xml' }), 'nf.xml');
    const r = await call('POST', '/api/importar/nfe', fd, tk, true);
    assert.equal(r.status, 200);
    assert.equal(r.nf.valor_total, 2400);
  }
  const lixo = new FormData();
  lixo.append('arquivo', new Blob(['oi'], { type: 'application/pdf' }), 'x.pdf');
  const e = await call('POST', '/api/importar/empenho', lixo, tk, true);
  assert.equal(e.status, 422);
});

test('dashboard, relatório, órgãos com prazo médio', async () => {
  const d = await call('GET', '/api/painel/dashboard', null, tk);
  assert.equal(d.status, 200, JSON.stringify(d));
  assert.ok(d.kpis.lucro_realizado > 0);
  assert.equal(d.mensal.length, 12);
  assert.ok(d.alertas.some((a) => a.texto.includes('prejuízo')));
  const r = await call('GET', '/api/painel/relatorio?de=2025-01-01&ate=2030-12-31', null, tk);
  assert.equal(r.totais.vendas, 2);
  assert.ok(r.totais.despesas > 200);
  const o = await call('GET', '/api/orgaos', null, tk);
  const bat = o.orgaos.find((x) => x.uasg === '781200');
  assert.equal(bat.vendas, 1);
  assert.ok(bat.prazo_medio_pagamento > 0);
  const filtro = await call('GET', '/api/vendas?situacao=prejuizo', null, tk);
  assert.equal(filtro.vendas.length, 1);
  const busca = await call('GET', '/api/vendas?busca=fio%2016', null, tk);
  assert.equal(busca.vendas.length, 1);
});

test('plano vencido bloqueia, admin libera; senha esquecida e redefinida', async () => {
  const { q } = require('../server/db');
  await q("UPDATE nexusgov.usuarios SET plano_expira_em = now() - interval '1 day' WHERE email = 'outro@teste.com'");
  const b = await call('GET', '/api/vendas', null, tk2);
  assert.equal(b.status, 402);
  assert.equal(b.codigo, 'PLANO_EXPIRADO');
  const me = await call('GET', '/api/auth/me', null, tk2);
  assert.equal(me.usuario.plano_ativo, false);
  const s = await call('POST', '/api/auth/plano/solicitar', { plano: 'mensal' }, tk2);
  assert.equal(s.ok, true);
  const naoAdmin = await call('GET', '/api/admin/usuarios', null, tk);
  assert.equal(naoAdmin.status, 403);
  await q("UPDATE nexusgov.usuarios SET is_admin = true WHERE email = 'gui@teste.com'");
  const adm = await call('GET', '/api/admin/usuarios', null, tk);
  assert.equal(adm.solicitacoes.length, 1);
  const alvo = adm.usuarios.find((u) => u.email === 'outro@teste.com');
  const lib = await call('POST', `/api/admin/usuarios/${alvo.id}/plano`, { plano: 'mensal' }, tk);
  assert.ok(lib.usuario.dias_restantes >= 30);
  const ok = await call('GET', '/api/vendas', null, tk2);
  assert.equal(ok.status, 200);
  const link = await call('POST', `/api/admin/usuarios/${alvo.id}/link-senha`, {}, tk);
  const token = new URL(link.link).searchParams.get('token');
  const red = await call('POST', '/api/auth/redefinir', { token, senha: 'novaSenha1' }, null);
  assert.equal(red.ok, true);
  const l = await call('POST', '/api/auth/login', { email: 'outro@teste.com', senha: 'novaSenha1' });
  assert.equal(l.status, 200);
  const reuse = await call('POST', '/api/auth/redefinir', { token, senha: 'xxxxxx1' }, null);
  assert.equal(reuse.status, 400);
  const pl = await call('PUT', '/api/admin/sistema', { link_mensal: 'https://exemplo.com/novo' }, tk);
  assert.equal(pl.ok, true);
  const pub = await call('GET', '/api/publico/planos');
  assert.equal(pub.planos[0].link, 'https://exemplo.com/novo');
});

test('health e exclusão', async () => {
  const h = await call('GET', '/api/health');
  assert.equal(h.ok, true);
  const del = await call('DELETE', `/api/vendas/${vendaId}`, null, tk);
  assert.equal(del.ok, true);
  const cx = await call('GET', '/api/caixa', null, tk);
  assert.equal(cx.movimentos.filter((m) => m.venda_id === vendaId).length, 0);
  const bad = await call('GET', '/api/vendas/nao-e-uuid', null, tk);
  assert.equal(bad.status, 400);
});
