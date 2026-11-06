# Deploy na Vercel (sem conectar o GitHub na Vercel)

O projeto `nexusgov` da Vercel recebe só 4 arquivos: `deploy/vercel.json` (como `vercel.json`), `deploy/bootstrap.sh`
(como `bootstrap.sh`), `package.json` e `api/index.js`. No build, o `bootstrap.sh` baixa este repositório (branch `main`)
e instala as dependências. Para publicar uma atualização: `git push` na `main` e criar um novo deploy com esses arquivos
(ou "Redeploy" do último deploy na Vercel — ele baixa a `main` de novo).

Se um dia conectar o GitHub na Vercel (Settings → Git), basta ligar o projeto ao repositório: o `vercel.json` da raiz já funciona.
