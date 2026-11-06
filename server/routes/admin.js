const router = require('express').Router();
const crypto = require('crypto');
const { q, one } = require('../db');
const { wrap, Erro, txt, numero } = require('../util');
const { publico } = require('../auth');

const DIAS_PLANO = { mensal: 31, trimestral: 93, anual: 366, trial: 15 };

router.get('/usuarios', wrap(async (req, res) => {
  const lista = await q(`SELECT u.*, COALESCE(s.vendas, 0) AS vendas, COALESCE(s.valor, 0) AS valor_vendas
    FROM usuarios u LEFT JOIN LATERAL (SELECT COUNT(*) AS vendas, SUM(valor_total) AS valor FROM vendas_resumo WHERE usuario_id = u.id) s ON true
    ORDER BY u.criado_em DESC`);
  const solic = await q(`SELECT s.*, u.nome, u.email FROM solicitacoes_plano s JOIN usuarios u ON u.id = s.usuario_id
    WHERE s.status = 'pendente' ORDER BY s.criado_em`);
  res.json({
    usuarios: lista.map((u) => ({ ...publico(u), ativo: u.ativo, ultimo_login: u.ultimo_login, vendas: u.vendas, valor_vendas: u.valor_vendas })),
    solicitacoes: solic,
  });
}));

// Libera/renova plano: soma os dias a partir do maior entre hoje e o vencimento atual
router.post('/usuarios/:id/plano', wrap(async (req, res) => {
  const plano = txt(req.body.plano, 20);
  if (!['mensal', 'trimestral', 'anual', 'vitalicio', 'trial'].includes(plano)) throw new Erro(400, 'Plano inválido.');
  const dias = numero(req.body.dias) || DIAS_PLANO[plano] || 31;
  const u = await one(
    plano === 'vitalicio'
      ? `UPDATE usuarios SET plano = 'vitalicio', plano_expira_em = NULL WHERE id = $1 RETURNING *`
      : `UPDATE usuarios SET plano = $2, plano_expira_em = GREATEST(COALESCE(plano_expira_em, now()), now()) + ($3 || ' days')::interval WHERE id = $1 RETURNING *`,
    plano === 'vitalicio' ? [req.params.id] : [req.params.id, plano, String(dias)]
  );
  if (!u) throw new Erro(404, 'Cliente não encontrado.');
  await q(`UPDATE solicitacoes_plano SET status = 'aprovada', resolvido_em = now() WHERE usuario_id = $1 AND status = 'pendente'`, [u.id]);
  res.json({ usuario: publico(u) });
}));

router.post('/usuarios/:id/ativo', wrap(async (req, res) => {
  if (req.params.id === req.user.id) throw new Erro(400, 'Você não pode desativar a própria conta.');
  const u = await one('UPDATE usuarios SET ativo = $2 WHERE id = $1 RETURNING *', [req.params.id, !!req.body.ativo]);
  if (!u) throw new Erro(404, 'Cliente não encontrado.');
  res.json({ ok: true });
}));

router.post('/usuarios/:id/link-senha', wrap(async (req, res) => {
  const token = crypto.randomBytes(24).toString('hex');
  const u = await one("UPDATE usuarios SET token_reset = $2, token_reset_expira = now() + interval '48 hours' WHERE id = $1 RETURNING email", [req.params.id, token]);
  if (!u) throw new Erro(404, 'Cliente não encontrado.');
  const site = process.env.SITE_URL || `${req.headers['x-forwarded-proto'] || 'https'}://${req.headers.host}`;
  res.json({ link: `${site}/redefinir-senha?token=${token}`, email: u.email });
}));

router.post('/solicitacoes/:id/recusar', wrap(async (req, res) => {
  await q(`UPDATE solicitacoes_plano SET status = 'recusada', resolvido_em = now() WHERE id = $1`, [req.params.id]);
  res.json({ ok: true });
}));

router.put('/sistema', wrap(async (req, res) => {
  const permitidas = ['link_mensal', 'link_trimestral', 'link_anual', 'preco_mensal', 'preco_trimestral', 'preco_anual', 'whatsapp_suporte', 'email_suporte'];
  for (const [k, v] of Object.entries(req.body || {})) {
    if (!permitidas.includes(k)) continue;
    await q('INSERT INTO sistema (chave, valor) VALUES ($1, $2) ON CONFLICT (chave) DO UPDATE SET valor = EXCLUDED.valor', [k, String(v ?? '').trim().slice(0, 500)]);
  }
  res.json({ ok: true });
}));

module.exports = router;
