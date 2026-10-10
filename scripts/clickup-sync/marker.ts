const MARKER = /<!--\s*clickup:([A-Za-z0-9_-]+)\s*-->/;
const TASK_ID = /^[A-Za-z0-9_-]+$/;

export function clickupMarker(taskId: string): string {
  if (!TASK_ID.test(taskId)) {
    throw new Error("id de tarea inválido");
  }
  return `<!-- clickup:${taskId} -->`;
}

export function parseClickupTaskId(body: string): string | null {
  const id = MARKER.exec(body)?.[1];
  if (!id) return null;
  return id;
}
