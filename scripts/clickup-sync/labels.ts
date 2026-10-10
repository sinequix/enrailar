const PRIORITY_BY_VALUE: Readonly<Record<number, string>> = {
  1: "priority/urgent",
  2: "priority/high",
  3: "priority/normal",
  4: "priority/low",
};

const VALUE_BY_LABEL: Readonly<Record<string, number>> = {
  "priority/urgent": 1,
  "priority/high": 2,
  "priority/normal": 3,
  "priority/low": 4,
};

export const CLICKUP_LABEL = "clickup";

export const LABEL_COLORS: Readonly<Record<string, string>> = {
  clickup: "6f42c1",
  "priority/urgent": "b60205",
  "priority/high": "d93f0b",
  "priority/normal": "fbca04",
  "priority/low": "0e8a16",
  "agent:plan": "1d76db",
  "agent:plan-review": "5319e7",
  "agent:ready": "0e8a16",
  "agent:building": "fbca04",
  "agent:approved": "0e8a16",
  "needs:human": "d93f0b",
};

export const LABEL_DESCRIPTIONS: Readonly<Record<string, string>> = {
  clickup: "Sincronizada desde ClickUp",
  "agent:plan": "Pedir plan, sin código",
  "agent:plan-review": "Revisión del plan",
  "agent:ready": "Plan aprobado, listo para implementar",
  "agent:building": "Implementación en curso",
  "agent:approved": "Aprobación de la revisión",
  "needs:human": "Hace falta una persona",
};

export function priorityLabel(priority: number | null): string | null {
  if (priority === null) return null;
  return PRIORITY_BY_VALUE[priority] ?? null;
}

export function priorityFromLabels(labels: readonly string[]): number | null {
  for (const label of labels) {
    const value = VALUE_BY_LABEL[label.trim().toLowerCase()];
    if (value !== undefined) return value;
  }
  return null;
}

export function sanitizeLabel(name: string): string | null {
  const cleaned = name.trim().replaceAll(",", "").slice(0, 50).trim();
  if (cleaned.length === 0) return null;
  return cleaned;
}

export function labelsForNewIssue(
  tags: readonly string[],
  priority: number | null,
): string[] {
  const labels = new Set<string>([CLICKUP_LABEL]);
  for (const tag of tags) {
    const label = sanitizeLabel(tag);
    if (label) labels.add(label);
  }
  const priorityName = priorityLabel(priority);
  if (priorityName) labels.add(priorityName);
  return [...labels];
}

export function isWorkflowLabel(name: string): boolean {
  const lower = name.trim().toLowerCase();
  return lower.startsWith("agent:") || lower === "needs:human";
}

export function tagsFromLabels(labels: readonly string[]): string[] {
  const tags: string[] = [];
  for (const label of labels) {
    const lower = label.trim().toLowerCase();
    if (
      lower === CLICKUP_LABEL || lower.startsWith("priority/") ||
      isWorkflowLabel(lower)
    ) continue;
    const tag = sanitizeLabel(label);
    if (!tag) continue;
    tags.push(tag.toLowerCase());
  }
  return [...new Set(tags)];
}
