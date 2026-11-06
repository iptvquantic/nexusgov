const jwt = require('jsonwebtoken');
const { one } = require('./db');

const SEGREDO = () => process.env.JWT_SECRET || 'dev-nexusgov-segredo';

function assinar(u) {
  return jwt.sign({ id: u.id }, SEGREDO(), { expiresIn: '30d' });
}

function planoAtivo(u) {
  if (!u) return false;
  if (u.is_admin || u.plano === 'vitalicio') return true;
  return !!u.plano_expira_em && new Date(u.plano_expira_em) > new Date();
}

function publico(u) {
  if (!u) return null;
  const dias = u.plano_expira_em ? Math.ceil((new Date(u.plano_expira_em) - Date.now()) / 86400000) : null;
  return {
    id: u.id, nome: u.nome, email: u.email, empresa: u.empresa, cnpj: u.cnpj, telefone: u.telefone,
    plano: u.plano, plano_expira_em: u.plano_expira_em, dias_restantes: dias,
    plano_ativo: planoAtivo(u), is_admin: u.is_admin, limite_mei: u.limite_mei,
    dias_pagamento_padrao: u.dias_pagamento_padrao, criado_em: u.criado_em,
  };
}

// exige login; com {plano:false} deixa passar quem está com plano vencido
function exigeLogin(opts = {}) {
  const exigePlano = opts.plano !== false;
  return async (req, res, next) => {
    try {
      const h = req.headers.authorization || '';
      const token = h.startsWith('Bearer ') ? h.slice(7) : null;
      if (!token) return res.status(401).json({ erro: 'Faça login para continuar.' });
      let dados;
      try { dados = jwt.verify(token, SEGREDO()); } catch { return res.status(401).json({ erro: 'Sessão expirada. Entre novamente.' }); }
      const u = await one('SELECT * FROM usuarios WHERE id = $1', [dados.id]);
      if (!u || !u.ativo) return res.status(401).json({ erro: 'Conta não encontrada ou desativada.' });
      req.user = u;
      if (exigePlano && !planoAtivo(u)) {
        return res.status(402).json({ erro: 'Seu período de acesso terminou. Escolha um plano para continuar.', codigo: 'PLANO_EXPIRADO' });
      }
      next();
    } catch (e) { next(e); }
  };
}

function exigeAdmin(req, res, next) {
  if (!req.user || !req.user.is_admin) return res.status(403).json({ erro: 'Acesso restrito ao administrador.' });
  next();
}

module.exports = { assinar, exigeLogin, exigeAdmin, publico, planoAtivo };
