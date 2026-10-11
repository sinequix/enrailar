"use client";

import { useState } from "react";
import type { AdminData } from "../../src/app-data.ts";
import { Button } from "./ui/button.tsx";

interface Labels {
  users: string;
  submissions: string;
  subscribers: string;
  audit: string;
  empty: string;
  ban: string;
  makeAdmin: string;
  makeUser: string;
  banned: string;
  twoFactor: string;
  failed: string;
}

async function post(path: string, body: Record<string, string>): Promise<boolean> {
  const response = await fetch(path, {
    method: "POST",
    headers: { "content-type": "application/json" },
    body: JSON.stringify(body),
  });
  return response.ok;
}

export function AdminPanel({
  data,
  selfId,
  labels,
}: {
  data: AdminData;
  selfId: string;
  labels: Labels;
}) {
  const [message, setMessage] = useState<string | null>(null);

  async function run(path: string, body: Record<string, string>) {
    const ok = await post(path, body);
    if (!ok) {
      setMessage(labels.failed);
      return;
    }
    location.reload();
  }

  return (
    <div className="app-stack">
      <section className="card">
        <h2>{labels.users}</h2>
        {data.users.length === 0 ? <p className="hint">{labels.empty}</p> : (
          <table className="app-table">
            <tbody>
              {data.users.map((row) => (
                <tr key={row.id}>
                  <td>{row.emailMask}</td>
                  <td>{row.role}</td>
                  <td>{row.twoFactor ? labels.twoFactor : "—"}</td>
                  <td>{row.banned ? labels.banned : "—"}</td>
                  <td>
                    {row.id === selfId ? null : (
                      <span className="actions">
                        <Button type="button" variant="ghost" onClick={() => void run("/api/admin/role", { userId: row.id, role: row.role === "admin" ? "user" : "admin" })}>
                          {row.role === "admin" ? labels.makeUser : labels.makeAdmin}
                        </Button>
                        <Button type="button" variant="ghost" onClick={() => void run("/api/admin/ban", { userId: row.id })}>{labels.ban}</Button>
                      </span>
                    )}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        )}
      </section>
      <section className="card">
        <h2>{labels.submissions}</h2>
        {data.submissions.length === 0 ? <p className="hint">{labels.empty}</p> : (
          <ul className="saved-intents">
            {data.submissions.map((row) => (
              <li key={row.id}>{row.createdAt} · {row.locale} · {row.emailMask} · {row.intents.join(", ")}</li>
            ))}
          </ul>
        )}
      </section>
      <section className="card">
        <h2>{labels.subscribers}</h2>
        {data.subscribers.length === 0 ? <p className="hint">{labels.empty}</p> : (
          <ul className="saved-intents">
            {data.subscribers.map((row) => (
              <li key={`${row.emailMask}-${row.createdAt}`}>{row.createdAt} · {row.locale} · {row.status} · {row.emailMask}</li>
            ))}
          </ul>
        )}
      </section>
      <section className="card">
        <h2>{labels.audit}</h2>
        {data.audit.length === 0 ? <p className="hint">{labels.empty}</p> : (
          <ul className="saved-intents">
            {data.audit.map((row) => (
              <li key={row.id}>{row.createdAt} · {row.kind} · {row.recordId}</li>
            ))}
          </ul>
        )}
      </section>
      {message ? <p className="status" role="status">{message}</p> : null}
    </div>
  );
}
