const express = require('express');
const { q, one } = require('./db');
const { exigeLogin, exigeAdmin } = require('./auth');
const { wrap, PORTAIS, MODALIDADES } = require('./util');
const email = require('./email');

const app = express();
app.disable('x-powered-by');
app.set('trust proxy', 1);
app.use(express.json({ limit: '2mb' }));
app.use((req, res, next) => {
  res.set('Cache-Control', 'no-store');
  res.set('X-Content-Type-Options', 'nosniff');
  next();
});

// Público
app.get('/api/health', wrap(async (req, res) => {
  const inicio = Date.now();
  const r = await one('SELECT COUNT(*) AS usuarios FROM usuarios');
  res.json({ ok: true, banco: 'ok', ms: Date.now() - inicio, usuarios: r.usuarios, email: email.configurado(), versao: '3.0.0' });
}));

app.get('/api/publico/planos', wrap(async (req, res) => {
  const rows = await q('SELECT chave, valor FROM sistema');
  const s = Object.fromEntries(rows.map((r) => [r.chave, r.valor]));
  res.json({
    trial_dias: Number(process.env.TRIAL_DIAS || 15),
    planos: [
      { id: 'mensal', nome: 'Mensal', preco: s.preco_mensal, periodo: '/mês', link: s.link_mensal },
      { id: 'trimestral', nome: 'Trimestral', preco: s.preco_trimestral, periodo: '/trimestre', link: s.link_trimestral, destaque: true },
      { id: 'anual', nome: 'Anual', preco: s.preco_anual, periodo: '/ano', link: s.link_anual },
    ],
    whatsapp_suporte: s.whatsapp_suporte || '',
    email_suporte: s.email_suporte || '',
  });
}));

app.get('/api/publico/opcoes', (req, res) => res.json({ portais: PORTAIS, modalidades: MODALIDADES }));

app.use('/api/auth', require('./routes/auth'));

// Área logada (exige plano ativo)
const logado = exigeLogin();
const C = require('./routes/cadastros');
const F = require('./routes/financeiro');
app.use('/api/vendas', logado, require('./routes/vendas'));
app.use('/api/oportunidades', logado, require('./routes/oportunidades'));
app.use('/api/orgaos', logado, C.orgaos);
app.use('/api/fornecedores', logado, C.fornecedores);
app.use('/api/caixa', logado, F.caixa);
app.use('/api/recebimentos', logado, F.recebimentos);
app.use('/api/importar', logado, require('./routes/importar'));
app.use('/api/painel', logado, require('./routes/painel'));
app.use('/api/admin', exigeLogin({ plano: false }), exigeAdmin, require('./routes/admin'));

app.use('/api', (req, res) => res.status(404).json({ erro: 'Rota não encontrada.' }));

// Erros
// eslint-disable-next-line no-unused-vars
app.use((err, req, res, next) => {
  if (err.status && err.status < 500) return res.status(err.status).json({ erro: err.message });
  if (err.code === 'LIMIT_FILE_SIZE') return res.status(413).json({ erro: 'Arquivo grande demais (máximo 4 MB).' });
  if (err.code === '22P02') return res.status(400).json({ erro: 'Identificador inválido.' });
  if (err.code === '23505') return res.status(409).json({ erro: 'Registro duplicado.' });
  console.error(err);
  res.status(500).json({ erro: 'Erro interno. Tente de novo em instantes.' });
});

module.exports = app;
