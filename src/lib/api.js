const CHAVE = 'nexusgov_token';

export const token = {
  get: () => { try { return localStorage.getItem(CHAVE); } catch { return null; } },
  set: (t) => { try { t ? localStorage.setItem(CHAVE, t) : localStorage.removeItem(CHAVE); } catch { /* sem storage */ } },
};

export class ErroApi extends Error {
  constructor(msg, status, codigo) { super(msg); this.status = status; this.codigo = codigo; }
}

let aoExpirarPlano = null;
let aoSair = null;
export const ganchos = { plano: (f) => { aoExpirarPlano = f; }, sair: (f) => { aoSair = f; } };

export async function api(caminho, { method = 'GET', body, form } = {}) {
  const headers = {};
  const t = token.get();
  if (t) headers.Authorization = `Bearer ${t}`;
  let corpo;
  if (form) corpo = form;
  else if (body !== undefined) { headers['Content-Type'] = 'application/json'; corpo = JSON.stringify(body); }
  let r;
  try {
    r = await fetch(`/api${caminho}`, { method, headers, body: corpo });
  } catch {
    throw new ErroApi('Sem conexão com o servidor. Verifique a internet e tente de novo.', 0);
  }
  const dados = await r.json().catch(() => ({}));
  if (!r.ok) {
    if (r.status === 401 && t && !caminho.startsWith('/auth/login')) { token.set(null); aoSair && aoSair(); }
    if (r.status === 402 && dados.codigo === 'PLANO_EXPIRADO') aoExpirarPlano && aoExpirarPlano();
    throw new ErroApi(dados.erro || `Erro ${r.status}`, r.status, dados.codigo);
  }
  return dados;
}
