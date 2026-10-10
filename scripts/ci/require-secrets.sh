#!/usr/bin/env bash
set -euo pipefail

missing=0
for name in CLOUDFLARE_API_TOKEN CLOUDFLARE_ACCOUNT_ID ALCHEMY_PASSWORD FORWARD_TO ACCESS_ALLOWED_EMAILS POLICY_AUD TEAM_DOMAIN BETTER_AUTH_SECRET; do
  value="${!name-}"
  if [[ -z "${value// /}" ]]; then
    echo "falta ${name}"
    missing=1
  fi
done

if [[ -z "${ACCESS_SERVICE_TOKEN_IDS-}" || -z "${ACCESS_SERVICE_TOKEN_IDS// /}" ]]; then
  echo "ACCESS_SERVICE_TOKEN_IDS vacío: la política no incluye service tokens."
fi

if [[ "$missing" -ne 0 ]]; then
  echo "No se despliega: faltan secretos."
  exit 1
fi
