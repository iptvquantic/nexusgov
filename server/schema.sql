-- NexusGov v3 — schema "nexusgov". Idempotente: pode rodar várias vezes.
CREATE SCHEMA IF NOT EXISTS nexusgov;
SET search_path = nexusgov, public;

CREATE TABLE IF NOT EXISTS usuarios (
  id               uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  nome             text NOT NULL,
  email            text NOT NULL UNIQUE,
  senha_hash       text NOT NULL,
  empresa          text,
  cnpj             text,
  telefone         text,
  plano            text NOT NULL DEFAULT 'trial',      -- trial | mensal | trimestral | anual | vitalicio
  plano_expira_em  timestamptz,
  is_admin         boolean NOT NULL DEFAULT false,
  ativo            boolean NOT NULL DEFAULT true,
  limite_mei       numeric(14,2) NOT NULL DEFAULT 81000,
  dias_pagamento_padrao int NOT NULL DEFAULT 30,
  token_reset      text,
  token_reset_expira timestamptz,
  ultimo_login     timestamptz,
  criado_em        timestamptz NOT NULL DEFAULT now()
);

CREATE TABLE IF NOT EXISTS orgaos (
  id          uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  usuario_id  uuid NOT NULL REFERENCES usuarios(id) ON DELETE CASCADE,
  uasg        text,
  nome        text NOT NULL,
  cnpj        text,
  endereco    text,
  municipio   text,
  uf          text,
  telefone    text,
  email       text,
  contato     text,
  obs         text,
  criado_em   timestamptz NOT NULL DEFAULT now()
);
CREATE UNIQUE INDEX IF NOT EXISTS orgaos_usuario_uasg ON orgaos(usuario_id, uasg) WHERE uasg IS NOT NULL AND uasg <> '';

CREATE TABLE IF NOT EXISTS fornecedores (
  id          uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  usuario_id  uuid NOT NULL REFERENCES usuarios(id) ON DELETE CASCADE,
  nome        text NOT NULL,
  produtos    text,
  contato     text,
  email       text,
  telefone    text,
  cnpj        text,
  cidade      text,
  site        text,
  prazo_entrega_dias int,
  obs         text,
  criado_em   timestamptz NOT NULL DEFAULT now()
);

CREATE TABLE IF NOT EXISTS oportunidades (
  id            uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  usuario_id    uuid NOT NULL REFERENCES usuarios(id) ON DELETE CASCADE,
  orgao_id      uuid REFERENCES orgaos(id) ON DELETE SET NULL,
  uasg          text,
  orgao_nome    text,
  numero        text,
  portal        text NOT NULL DEFAULT 'Compras.gov.br',
  modalidade    text NOT NULL DEFAULT 'Dispensa eletrônica',
  objeto        text NOT NULL,
  data_sessao   timestamptz,
  status        text NOT NULL DEFAULT 'cotando',   -- cotando | enviada | ganha | perdida | desistiu
  frete         numeric(14,2) NOT NULL DEFAULT 0,
  margem_alvo   numeric(6,2) NOT NULL DEFAULT 30,
  link          text,
  obs           text,
  motivo_perda  text,
  venda_id      uuid,
  criado_em     timestamptz NOT NULL DEFAULT now(),
  atualizado_em timestamptz NOT NULL DEFAULT now()
);

CREATE TABLE IF NOT EXISTS oportunidade_itens (
  id              uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  oportunidade_id uuid NOT NULL REFERENCES oportunidades(id) ON DELETE CASCADE,
  ordem           int NOT NULL DEFAULT 1,
  numero_item     int,
  descricao       text NOT NULL,
  unidade         text DEFAULT 'UN',
  quantidade      numeric(14,4) NOT NULL DEFAULT 1,
  custo_unit      numeric(14,4) NOT NULL DEFAULT 0,
  preco_unit      numeric(14,4) NOT NULL DEFAULT 0,
  preco_referencia numeric(14,4),
  fornecedor_id   uuid REFERENCES fornecedores(id) ON DELETE SET NULL
);

CREATE TABLE IF NOT EXISTS vendas (
  id                  uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  usuario_id          uuid NOT NULL REFERENCES usuarios(id) ON DELETE CASCADE,
  orgao_id            uuid REFERENCES orgaos(id) ON DELETE SET NULL,
  oportunidade_id     uuid REFERENCES oportunidades(id) ON DELETE SET NULL,
  objeto              text NOT NULL,
  descricao           text,
  numero_empenho      text,
  processo            text,
  numero_compra       text,
  portal              text NOT NULL DEFAULT 'Compras.gov.br',
  modalidade          text NOT NULL DEFAULT 'Dispensa eletrônica',
  data_empenho        date NOT NULL DEFAULT current_date,
  prazo_entrega_dias  int,
  data_limite_entrega date,
  data_entrega        date,
  local_entrega       text,
  nf_numero           text,
  nf_chave            text,
  nf_data             date,
  data_prev_pagamento date,
  status              text NOT NULL DEFAULT 'empenhada', -- empenhada|comprada|em_transito|entregue|faturada|paga|cancelada
  frete               numeric(14,2) NOT NULL DEFAULT 0,
  frete_tipo          text NOT NULL DEFAULT 'CIF',   -- CIF (incluso no custo) | FOB (eu pago)
  outros_custos       numeric(14,2) NOT NULL DEFAULT 0,
  fornecedor_pago     boolean NOT NULL DEFAULT false,
  fornecedor_pago_em  date,
  frete_pago          boolean NOT NULL DEFAULT false,
  frete_pago_em       date,
  obs                 text,
  criado_em           timestamptz NOT NULL DEFAULT now(),
  atualizado_em       timestamptz NOT NULL DEFAULT now()
);
CREATE INDEX IF NOT EXISTS vendas_usuario ON vendas(usuario_id, data_empenho DESC);

CREATE TABLE IF NOT EXISTS venda_itens (
  id            uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  venda_id      uuid NOT NULL REFERENCES vendas(id) ON DELETE CASCADE,
  ordem         int NOT NULL DEFAULT 1,
  numero_item   int,
  descricao     text NOT NULL,
  unidade       text DEFAULT 'UN',
  quantidade    numeric(14,4) NOT NULL DEFAULT 1,
  valor_unit    numeric(14,4) NOT NULL DEFAULT 0,
  custo_unit    numeric(14,4),
  fornecedor_id uuid REFERENCES fornecedores(id) ON DELETE SET NULL
);
CREATE INDEX IF NOT EXISTS venda_itens_venda ON venda_itens(venda_id);

CREATE TABLE IF NOT EXISTS recebimentos (
  id          uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  usuario_id  uuid NOT NULL REFERENCES usuarios(id) ON DELETE CASCADE,
  venda_id    uuid NOT NULL REFERENCES vendas(id) ON DELETE CASCADE,
  valor       numeric(14,2) NOT NULL CHECK (valor > 0),
  data        date NOT NULL DEFAULT current_date,
  forma       text DEFAULT 'Ordem bancária',
  obs         text,
  criado_em   timestamptz NOT NULL DEFAULT now()
);

CREATE TABLE IF NOT EXISTS caixa (
  id            uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  usuario_id    uuid NOT NULL REFERENCES usuarios(id) ON DELETE CASCADE,
  tipo          text NOT NULL CHECK (tipo IN ('entrada','saida')),
  categoria     text NOT NULL,
  descricao     text NOT NULL,
  valor         numeric(14,2) NOT NULL CHECK (valor > 0),
  data          date NOT NULL DEFAULT current_date,
  venda_id      uuid REFERENCES vendas(id) ON DELETE CASCADE,
  recebimento_id uuid REFERENCES recebimentos(id) ON DELETE CASCADE,
  origem        text NOT NULL DEFAULT 'manual',   -- manual | recebimento | fornecedor | frete
  criado_em     timestamptz NOT NULL DEFAULT now()
);
CREATE INDEX IF NOT EXISTS caixa_usuario ON caixa(usuario_id, data DESC);

CREATE TABLE IF NOT EXISTS solicitacoes_plano (
  id          uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  usuario_id  uuid NOT NULL REFERENCES usuarios(id) ON DELETE CASCADE,
  plano       text NOT NULL,
  obs         text,
  status      text NOT NULL DEFAULT 'pendente',  -- pendente | aprovada | recusada
  criado_em   timestamptz NOT NULL DEFAULT now(),
  resolvido_em timestamptz
);

CREATE TABLE IF NOT EXISTS sistema (
  chave  text PRIMARY KEY,
  valor  text NOT NULL
);
INSERT INTO sistema (chave, valor) VALUES
  ('link_mensal', 'https://pag.ae/81RuUMgB6'),
  ('link_trimestral', 'https://pag.ae/81RuVe3jn'),
  ('link_anual', 'https://pag.ae/81RuVvkg6'),
  ('preco_mensal', '14,90'),
  ('preco_trimestral', '39,90'),
  ('preco_anual', '149,90'),
  ('whatsapp_suporte', ''),
  ('email_suporte', 'noreplynexusgov@gmail.com')
ON CONFLICT (chave) DO NOTHING;

-- Valores calculados de cada venda (uma linha por venda)
CREATE OR REPLACE VIEW vendas_resumo AS
SELECT v.*,
  o.nome  AS orgao_nome,
  o.uasg  AS orgao_uasg,
  COALESCE(i.valor_total, 0)                       AS valor_total,
  COALESCE(i.custo_produtos, 0)                    AS custo_produtos,
  COALESCE(i.itens_sem_custo, 0)                   AS itens_sem_custo,
  COALESCE(i.qtd_itens, 0)                         AS qtd_itens,
  COALESCE(r.recebido, 0)                          AS valor_recebido,
  r.ultimo_recebimento,
  COALESCE(i.valor_total, 0) - COALESCE(r.recebido, 0) AS saldo_receber,
  COALESCE(i.custo_produtos, 0) + v.frete + v.outros_custos AS custo_total,
  CASE WHEN COALESCE(i.custo_produtos, 0) > 0
       THEN COALESCE(i.valor_total, 0) - (COALESCE(i.custo_produtos, 0) + v.frete + v.outros_custos) END AS lucro,
  CASE WHEN COALESCE(i.custo_produtos, 0) > 0 AND COALESCE(i.valor_total, 0) > 0
       THEN ROUND(((COALESCE(i.valor_total, 0) - (COALESCE(i.custo_produtos, 0) + v.frete + v.outros_custos)) / i.valor_total) * 100, 2) END AS margem
FROM vendas v
LEFT JOIN orgaos o ON o.id = v.orgao_id
LEFT JOIN LATERAL (
  SELECT SUM(quantidade * valor_unit) AS valor_total,
         SUM(quantidade * COALESCE(custo_unit, 0)) AS custo_produtos,
         COUNT(*) FILTER (WHERE custo_unit IS NULL) AS itens_sem_custo,
         COUNT(*) AS qtd_itens
  FROM venda_itens WHERE venda_id = v.id
) i ON true
LEFT JOIN LATERAL (
  SELECT SUM(valor) AS recebido, MAX(data) AS ultimo_recebimento FROM recebimentos WHERE venda_id = v.id
) r ON true;
