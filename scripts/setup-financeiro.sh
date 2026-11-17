#!/usr/bin/env bash
# Gera a chave do widget financeiro, guarda no GitHub como segredo FIN_KEY
# e mostra o link para colar no Notion (/embed). A chave nunca vai para o repositório.
set -euo pipefail
REPO="elevencriativa/studio-widgets"
KEY=$(openssl rand -base64 32 | tr '+/' '-_' | tr -d '=')
printf '%s' "$KEY" | gh secret set FIN_KEY -R "$REPO"
gh workflow run metricas.yml -R "$REPO" >/dev/null 2>&1 || true
echo
echo "Pronto. Cole este link num bloco /embed da página financeira (privada):"
echo
echo "https://elevencriativa.github.io/studio-widgets/financeiro/#k=$KEY"
echo
echo "Guarde o link só na página privada: quem tiver o link consegue ver os números."
