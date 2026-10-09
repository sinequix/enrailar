CREATE TABLE inbound_messages (
  id TEXT PRIMARY KEY,
  mailbox TEXT NOT NULL,
  subject TEXT NOT NULL,
  object_key TEXT NOT NULL,
  size_bytes INTEGER NOT NULL,
  created_at TEXT NOT NULL
);

CREATE INDEX inbound_messages_mailbox ON inbound_messages (mailbox, created_at);
