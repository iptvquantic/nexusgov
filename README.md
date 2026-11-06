# NexusGov 3.0 — Controle de vendas para governo

Cotações → empenhos → compra → entrega → NF → recebimento → lucro, por portal, órgão e fornecedor.

## Rodar no seu PC (WSL)
    npm install
    cp .env.example .env    # coloque a DATABASE_URL
    npm run dev:api          # API em :3001 (outra aba)
    npm run dev              # site em :5173

## Testes
    TEST_DATABASE_URL=postgresql://... npm test

## Publicar
Vercel (framework Vite). Variáveis: DATABASE_URL, JWT_SECRET, TRIAL_DIAS, SMTP_USER, SMTP_PASS, SITE_URL.
Banco: rode server/schema.sql uma vez (é idempotente).
