#!/usr/bin/env bash
# Aplica las migraciones de EmDash del D1 de noticias desde el workflow, nunca
# dentro de un request (apps/news usa `migrations.runtime: "check"`).
#
#   news-migrate.sh <stage> [fingerprint]
#
# - El D1 sale del output `newsDatabase` que Alchemy persiste para el stage.
# - prod exige el fingerprint esperado (vars.NEWS_D1_TARGET_FINGERPRINT): si el
#   target no coincide, no se toca nada.
# - pr-N acepta el fingerprint que reporta `--check`, pero solo si el D1 es el
#   del stage (Enrailar-NewsDatabase-pr-N-*).
# - No toma ni libera locks: un lock retenido falla el job y se resuelve a mano.
set -euo pipefail

stage="${1:?falta el stage}"
expected="${2:-}"
root="$(cd "$(dirname "${BASH_SOURCE[0]}")/../.." && pwd)"

# Lee un campo (a.b) del primer objeto JSON de stdin.
json_field() {
  node --input-type=module -e '
let raw = "";
process.stdin.setEncoding("utf8");
process.stdin.on("data", (chunk) => { raw += chunk; });
process.stdin.on("end", () => {
  const start = raw.indexOf("{");
  const end = raw.lastIndexOf("}");
  if (start < 0 || end < start) process.exit(1);
  let value = JSON.parse(raw.slice(start, end + 1));
  for (const key of process.argv[1].split(".")) value = value?.[key];
  if (Array.isArray(value)) value = value.join(", ");
  if (typeof value !== "string" || value.length === 0) process.exit(1);
  process.stdout.write(value);
});
' "$1"
}

case "$stage" in
  prod)
    if [[ ! "$expected" =~ ^[0-9a-f]{64}$ ]]; then
      echo "prod necesita el fingerprint del D1 (vars.NEWS_D1_TARGET_FINGERPRINT)" >&2
      exit 1
    fi
    ;;
  pr-[0-9]*) ;;
  *)
    echo "stage desconocido: ${stage}" >&2
    exit 1
    ;;
esac

raw="$(cd "$root" && pnpm --filter @enrailar/infra exec alchemy state read "Enrailar/${stage}/output" --no-input --log-level error)"
if ! database="$(printf '%s' "$raw" | json_field newsDatabase)"; then
  echo "newsDatabase no está en el output de Alchemy para ${stage}" >&2
  exit 1
fi
if [[ "$stage" != prod && "$database" != "Enrailar-NewsDatabase-${stage}-"* ]]; then
  echo "el D1 ${database} no es del stage ${stage}" >&2
  exit 1
fi

cd "$root/apps/news"
export NEWS_RUNTIME=cloudflare

migrate() {
  pnpm exec emdash migrate --from-config --d1 "$database" "$@"
}

set +e
report="$(migrate --check --json)"
code=$?
set -e

if ! target="$(printf '%s' "$report" | json_field target.fingerprint)"; then
  echo "emdash migrate --check falló (exit ${code}) sin reporte" >&2
  exit 1
fi
fingerprint="${expected:-$target}"
if [[ "$target" != "$fingerprint" ]]; then
  echo "el fingerprint del D1 ${database} no coincide con el esperado" >&2
  exit 1
fi

case "$code" in
  0)
    echo "${database}: sin migraciones pendientes"
    ;;
  2)
    echo "${database}: pendientes $(printf '%s' "$report" | json_field pending)"
    migrate --expected-target-fingerprint "$fingerprint"
    migrate --check
    ;;
  3)
    echo "${database} tiene migraciones aplicadas que este emdash no conoce" >&2
    exit 1
    ;;
  *)
    echo "emdash migrate --check falló (exit ${code})" >&2
    exit 1
    ;;
esac
