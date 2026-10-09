export function subjectFromRaw(bytes: Uint8Array): string {
  const head = new TextDecoder("utf-8", { fatal: false }).decode(bytes.subarray(0, 8192));
  const split = head.indexOf("\r\n\r\n");
  const block = (split === -1 ? head : head.slice(0, split)).replace(/\r\n[ \t]+/g, " ");
  const line = block.split(/\r?\n/).find((row) => /^subject:/i.test(row));
  if (!line) return "(sin asunto)";
  const value = line.slice(line.indexOf(":") + 1).trim().replace(/[\r\n]/g, "");
  return value.slice(0, 200) || "(sin asunto)";
}
