#!/bin/bash
# Deploy na Vercel sem integração Git: baixa o código do GitHub durante o build.
# Idempotente (a Vercel pode rodar o "install" mais de uma vez: site + função da API).
set -euo pipefail
REPO="iptvquantic/nexusgov"
REF="${NEXUSGOV_REF:-main}"
if [ ! -f server/app.js ]; then
  echo "NexusGov: baixando $REPO@$REF"
  rm -rf /tmp/nexusgov-src
  if ! git clone --depth 1 --branch "$REF" "https://github.com/$REPO.git" /tmp/nexusgov-src; then
    mkdir -p /tmp/nexusgov-src
    curl -fsSL "https://codeload.github.com/$REPO/tar.gz/$REF" | tar xz --strip-components=1 -C /tmp/nexusgov-src
  fi
  rm -rf /tmp/nexusgov-src/.git
  cp -a /tmp/nexusgov-src/. .
fi
npm install --no-audit --no-fund
