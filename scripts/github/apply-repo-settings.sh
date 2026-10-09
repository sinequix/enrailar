#!/usr/bin/env bash
# Aplica labels, escaneo de secretos nativo y el ruleset de main.
# Si la API responde 403 o 401, ese paso queda pendiente y el script sigue con el siguiente.
# No reintenta con permisos elevados.
set -euo pipefail

denied=0

REPO="${GITHUB_REPOSITORY:-sinequix/enrailar}"
ROOT="$(cd "$(dirname "${BASH_SOURCE[0]}")/../.." && pwd)"

if ! command -v gh >/dev/null 2>&1; then
  echo "gh no está instalado." >&2
  exit 1
fi

api() {
  local method="$1"
  local path="$2"
  shift 2
  local body_file=""
  local args=()
  while [[ $# -gt 0 ]]; do
    case "$1" in
      --input)
        body_file="$2"
        shift 2
        ;;
      *)
        args+=("$1")
        shift
        ;;
    esac
  done
  local stderr_file
  stderr_file="$(mktemp)"
  local http
  if [[ -n "$body_file" ]]; then
    http="$(gh api --method "$method" "$path" --input "$body_file" "${args[@]}" -i 2>"$stderr_file" || true)"
  else
    http="$(gh api --method "$method" "$path" "${args[@]}" -i 2>"$stderr_file" || true)"
  fi
  local err
  err="$(cat "$stderr_file")"
  rm -f "$stderr_file"
  if [[ "$http" != HTTP/* ]]; then
    http="${err}"$'\n'"${http}"
  fi
  printf '%s\n' "$http"
}

status_of() {
  printf '%s\n' "$1" | awk 'BEGIN{code=0} /^HTTP/{code=$2} END{print code}'
}

echo "Labels en ${REPO}"
while IFS= read -r label; do
  name="$(printf '%s' "$label" | jq -r '.name')"
  color="$(printf '%s' "$label" | jq -r '.color')"
  description="$(printf '%s' "$label" | jq -r '.description')"
  payload="$(jq -n --arg name "$name" --arg color "$color" --arg description "$description" '{name:$name,color:$color,description:$description}')"
  tmp="$(mktemp)"
  printf '%s' "$payload" >"$tmp"
  response="$(api POST "repos/${REPO}/labels" --input "$tmp")"
  code="$(status_of "$response")"
  rm -f "$tmp"
  if [[ "$code" == "403" || "$code" == "401" ]]; then
    echo "Labels: la API respondió ${code}. No se fuerza."
    denied=1
    break
  fi
  if [[ "$code" == "422" ]]; then
    update="$(mktemp)"
    jq -n --arg color "$color" --arg description "$description" '{color:$color,description:$description}' >"$update"
    encoded="$(jq -rn --arg n "$name" '$n|@uri')"
    response="$(api PATCH "repos/${REPO}/labels/${encoded}" --input "$update")"
    code="$(status_of "$response")"
    rm -f "$update"
    if [[ "$code" == "403" || "$code" == "401" ]]; then
      echo "Labels: la API respondió ${code}. No se fuerza."
      denied=1
      break
    fi
    if [[ "$code" != "200" ]]; then
      echo "No se pudo actualizar el label ${name} (HTTP ${code})." >&2
      printf '%s\n' "$response" >&2
      exit 1
    fi
  elif [[ "$code" != "201" ]]; then
    echo "No se pudo crear el label ${name} (HTTP ${code})." >&2
    printf '%s\n' "$response" >&2
    exit 1
  fi
done < <(jq -c '.[]' "${ROOT}/.github/labels.json")

echo "Secret scanning nativo"
scan_body="$(mktemp)"
printf '%s\n' '{"security_and_analysis":{"secret_scanning":{"status":"enabled"},"secret_scanning_push_protection":{"status":"enabled"}}}' >"$scan_body"
response="$(api PATCH "repos/${REPO}" --input "$scan_body")"
code="$(status_of "$response")"
rm -f "$scan_body"
if [[ "$code" == "403" || "$code" == "401" ]]; then
  echo "Secret scanning: la API respondió ${code}. El workflow de gitleaks queda igual. No se fuerza."
  denied=1
elif [[ "$code" != "200" ]]; then
  echo "Secret scanning: HTTP ${code}. El workflow de gitleaks sigue activo." >&2
  printf '%s\n' "$response" >&2
else
  echo "Secret scanning y push protection habilitados."
fi

echo "Ruleset de main"
existing="$(gh api "repos/${REPO}/rulesets" --jq '.[] | select(.name=="main") | .id' 2>/dev/null || true)"
ruleset_file="${ROOT}/scripts/github/main-ruleset.json"
if [[ -n "${existing}" ]]; then
  response="$(api PUT "repos/${REPO}/rulesets/${existing}" --input "$ruleset_file")"
  code="$(status_of "$response")"
else
  response="$(api POST "repos/${REPO}/rulesets" --input "$ruleset_file")"
  code="$(status_of "$response")"
fi
if [[ "$code" == "403" || "$code" == "401" ]]; then
  echo "Ruleset: la API respondió ${code}. No se fuerza. Aplicá scripts/github/apply-repo-settings.sh cuando haya admin. Ver docs/governance.md."
  denied=1
elif [[ "$code" != "200" && "$code" != "201" ]]; then
  echo "Ruleset: HTTP ${code}." >&2
  printf '%s\n' "$response" >&2
  exit 1
else
  echo "Ruleset main aplicado."
fi

if [[ "$denied" -ne 0 ]]; then
  echo "Quedaron pasos sin permiso de admin. El JSON y esta corrida son la fuente para aplicarlos después."
fi
