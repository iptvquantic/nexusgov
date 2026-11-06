const router = require('express').Router();
const bcrypt = require('bcryptjs');
const crypto = require('crypto');
const { q, one } = require('../db');
const { assinar, exigeLogin, publico } = require('../auth');
const { wrap, Erro, txt, numero } = require('../util');
const email = require('../email');

const TRIAL_DIAS = () => Number(process.env.TRIAL_DIAS || 15);
const emailValido = (e) => /^[^\s@]+@[^\s@]+\.[^\s@]{2,}$/.test(e || '');
const urlSite = (req) => process.env.SITE_URL || `${req.headers['x-forwarded-proto'] || 'https'}://${req.headers.host}`;

// limite simples por IP para login/cadastro (memória da instância)
const tentativas = new Map();
function limitar(req, chave, max = 12) {
  const k = `${chave}:${req.headers['x-forwarded-for'] || req.ip}`;
  const agora = Date.now();
  const lista = (tentativas.get(k) || []).filter((t) => agora - t < 15 * 60000);
  lista.push(agora);
  tentativas.set(k, lista);
  if (lista.length > max) throw new Erro(429, 'Muitas tentativas. Aguarde alguns minutos e tente de novo.');
}

router.post('/cadastro', wrap(async (req, res) => {
  limitar(req, 'cadastro', 8);
  const nome = txt(req.body.nome, 120);
  const mail = (txt(req.body.email, 160) || '').toLowerCase();
  const senha = String(req.body.senha || '');
  if (!nome) throw new Erro(400, 'Informe seu nome.');
  if (!emailValido(mail)) throw new Erro(400, 'Informe um e-mail válido.');
  if (senha.length < 6) throw new Erro(400, 'A senha precisa ter pelo menos 6 caracteres.');
  if (await one('SELECT 1 FROM usuarios WHERE email = $1', [mail])) throw new Erro(409, 'Este e-mail já tem conta. Use "Entrar" ou "Esqueci minha senha".');
  const hash = await bcrypt.hash(senha, 10);
  const u = await one(
    `INSERT INTO usuarios (nome, email, senha_hash, empresa, cnpj, telefone, plano, plano_expira_em)
     VALUES ($1,$2,$3,$4,$5,$6,'trial', now() + ($7 || ' days')::interval) RETURNING *`,
    [nome, mail, hash, txt(req.body.empresa, 160), txt(req.body.cnpj, 30), txt(req.body.telefone, 40), String(TRIAL_DIAS())]
  );
  email.enviar({
    para: mail,
    assunto: 'Bem-vindo ao NexusGov',
    html: email.moldura(`Olá, ${nome}!`, `<p>Sua conta foi criada. Você tem <b>${TRIAL_DIAS()} dias grátis</b> com tudo liberado.</p><p><a style="color:#60a5fa" href="${urlSite(req)}">Abrir o NexusGov</a></p>`),
  });
  res.status(201).json({ token: assinar(u), usuario: publico(u) });
}));

router.post('/login', wrap(async (req, res) => {
  limitar(req, 'login', 15);
  const mail = (txt(req.body.email, 160) || '').toLowerCase();
  const u = await one('SELECT * FROM usuarios WHERE email = $1', [mail]);
  if (!u || !(await bcrypt.compare(String(req.body.senha || ''), u.senha_hash))) throw new Erro(401, 'E-mail ou senha incorretos.');
  if (!u.ativo) throw new Erro(403, 'Conta desativada. Fale com o suporte.');
  await q('UPDATE usuarios SET ultimo_login = now() WHERE id = $1', [u.id]);
  res.json({ token: assinar(u), usuario: publico(u) });
}));

router.get('/me', exigeLogin({ plano: false }), wrap(async (req, res) => {
  res.json({ usuario: publico(req.user) });
}));

router.put('/perfil', exigeLogin({ plano: false }), wrap(async (req, res) => {
  const b = req.body;
  const u = await one(
    `UPDATE usuarios SET nome = COALESCE($2, nome), empresa = $3, cnpj = $4, telefone = $5,
       limite_mei = COALESCE($6, limite_mei), dias_pagamento_padrao = COALESCE($7, dias_pagamento_padrao)
     WHERE id = $1 RETURNING *`,
    [req.user.id, txt(b.nome, 120), txt(b.empresa, 160), txt(b.cnpj, 30), txt(b.telefone, 40), numero(b.limite_mei), numero(b.dias_pagamento_padrao)]
  );
  res.json({ usuario: publico(u) });
}));

router.post('/senha', exigeLogin({ plano: false }), wrap(async (req, res) => {
  const { atual, nova } = req.body;
  if (!(await bcrypt.compare(String(atual || ''), req.user.senha_hash))) throw new Erro(400, 'A senha atual está incorreta.');
  if (String(nova || '').length < 6) throw new Erro(400, 'A nova senha precisa ter pelo menos 6 caracteres.');
  await q('UPDATE usuarios SET senha_hash = $2 WHERE id = $1', [req.user.id, await bcrypt.hash(String(nova), 10)]);
  res.json({ ok: true });
}));

router.post('/esqueci', wrap(async (req, res) => {
  limitar(req, 'esqueci', 6);
  const mail = (txt(req.body.email, 160) || '').toLowerCase();
  const u = await one('SELECT * FROM usuarios WHERE email = $1 AND ativo', [mail]);
  let enviado = false;
  if (u) {
    const token = crypto.randomBytes(24).toString('hex');
    await q("UPDATE usuarios SET token_reset = $2, token_reset_expira = now() + interval '2 hours' WHERE id = $1", [u.id, token]);
    const link = `${urlSite(req)}/redefinir-senha?token=${token}`;
    enviado = await email.enviar({
      para: mail,
      assunto: 'Redefinir sua senha — NexusGov',
      html: email.moldura('Redefinir senha', `<p>Recebemos um pedido para trocar sua senha.</p><p><a style="display:inline-block;background:#2563eb;color:#fff;padding:12px 20px;border-radius:8px;text-decoration:none" href="${link}">Criar nova senha</a></p><p style="color:#94a3b8;font-size:13px">O link vale por 2 horas. Se não foi você, ignore este e-mail.</p>`),
    });
  }
  res.json({ ok: true, email_configurado: email.configurado(), enviado: !!(u && enviado) });
}));

router.post('/redefinir', wrap(async (req, res) => {
  const token = txt(req.body.token, 200);
  const nova = String(req.body.senha || '');
  if (nova.length < 6) throw new Erro(400, 'A nova senha precisa ter pelo menos 6 caracteres.');
  const u = await one('SELECT * FROM usuarios WHERE token_reset = $1 AND token_reset_expira > now()', [token]);
  if (!u) throw new Erro(400, 'Este link expirou ou já foi usado. Peça um novo em "Esqueci minha senha".');
  await q('UPDATE usuarios SET senha_hash = $2, token_reset = NULL, token_reset_expira = NULL WHERE id = $1', [u.id, await bcrypt.hash(nova, 10)]);
  res.json({ ok: true, token: assinar(u), usuario: publico(u) });
}));

router.post('/plano/solicitar', exigeLogin({ plano: false }), wrap(async (req, res) => {
  const plano = txt(req.body.plano, 20);
  if (!['mensal', 'trimestral', 'anual'].includes(plano)) throw new Erro(400, 'Plano inválido.');
  const aberta = await one("SELECT id FROM solicitacoes_plano WHERE usuario_id = $1 AND status = 'pendente'", [req.user.id]);
  if (aberta) await q('UPDATE solicitacoes_plano SET plano = $2, obs = $3, criado_em = now() WHERE id = $1', [aberta.id, plano, txt(req.body.obs, 500)]);
  else await q('INSERT INTO solicitacoes_plano (usuario_id, plano, obs) VALUES ($1,$2,$3)', [req.user.id, plano, txt(req.body.obs, 500)]);
  const admins = await q('SELECT email FROM usuarios WHERE is_admin');
  for (const a of admins) {
    email.enviar({ para: a.email, assunto: `NexusGov: pagamento informado (${plano})`, html: email.moldura('Pagamento informado', `<p>${req.user.nome} (${req.user.email}) informou pagamento do plano <b>${plano}</b>.</p><p>Libere no Painel do dono.</p>`) });
  }
  res.json({ ok: true });
}));

module.exports = router;
