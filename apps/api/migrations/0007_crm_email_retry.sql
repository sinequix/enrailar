-- Reintentos del contacto de ClickUp. El correo en sí vive en el inbox.
CREATE TABLE crm_email_retries (
  message_id TEXT PRIMARY KEY,
  sender TEXT NOT NULL,
  subject TEXT NOT NULL,
  body TEXT NOT NULL,
  attempts INTEGER NOT NULL DEFAULT 0,
  updated_at TEXT NOT NULL
);

CREATE INDEX crm_email_retries_updated ON crm_email_retries (updated_at);
