#!/usr/bin/env bash
set -euo pipefail

missing=0
for name in CLOUDFLARE_API_TOKEN CLOUDFLARE_ACCOUNT_ID ALCHEMY_PASSWORD FORWARD_TO ACCESS_ALLOWED_EMAILS POLICY_AUD TEAM_DOMAIN; do
  value="${!name-}"
  if [[ -z "${value// /}" ]]; then
    echo "falta ${name}"
    missing=1
  fi
done

if [[ "$missing" -ne 0 ]]; then
  echo "No se despliega: faltan secretos."
  exit 1
fi
