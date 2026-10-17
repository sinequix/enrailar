#!/usr/bin/env bash
# Después del deploy del stage, /_emdash del Worker de noticias tiene que
# responder 403. La URL sale del output `newsUrl` que Alchemy persiste.
set -euo pipefail

stage="${1:?falta el stage}"

raw="$(pnpm --filter @enrailar/infra exec alchemy state read "Enrailar/${stage}/output" --no-input --log-level error)"
url="$(printf '%s' "$raw" | node --input-type=module -e '
let raw = "";
process.stdin.setEncoding("utf8");
process.stdin.on("data", (chunk) => {
  raw += chunk;
});
process.stdin.on("end", () => {
  const start = raw.indexOf("{");
  const end = raw.lastIndexOf("}");
  if (start < 0 || end < start) {
    console.error(raw);
    throw new Error("el output de Alchemy no trae JSON");
  }
  const parsed = JSON.parse(raw.slice(start, end + 1));
  const newsUrl = parsed.newsUrl;
  if (typeof newsUrl !== "string" || !newsUrl.startsWith("https://")) {
    console.error(raw);
    throw new Error("newsUrl no está en el output de Alchemy");
  }
  process.stdout.write(newsUrl.replace(/\/$/, ""));
});
')"

expect_403() {
  local path="$1"
  local attempt code
  for attempt in 1 2 3 4 5; do
    if code="$(curl --silent --show-error --max-time 20 --output /dev/null --write-out '%{http_code}' "${url}${path}")"; then
      if [[ "$code" == "403" ]]; then
        echo "${url}${path} 403"
        return 0
      fi
      echo "${url}${path} respondió ${code}" >&2
      return 1
    fi
    sleep 2
  done
  echo "${url}${path} no respondió" >&2
  return 1
}

expect_403 "/_emdash"
expect_403 "/_emdash/admin"
