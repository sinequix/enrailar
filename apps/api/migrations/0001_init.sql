CREATE TABLE preinscriptions (
  id TEXT PRIMARY KEY,
  email TEXT NOT NULL,
  linkedin TEXT,
  message TEXT NOT NULL,
  locale TEXT NOT NULL,
  consent_at TEXT NOT NULL,
  created_at TEXT NOT NULL
);

CREATE TABLE contacts (
  id TEXT PRIMARY KEY,
  intent TEXT NOT NULL,
  email TEXT NOT NULL,
  linkedin TEXT,
  message TEXT NOT NULL,
  locale TEXT NOT NULL,
  consent_at TEXT NOT NULL,
  created_at TEXT NOT NULL
);

CREATE TABLE newsletter_subscribers (
  id TEXT PRIMARY KEY,
  email TEXT NOT NULL UNIQUE,
  locale TEXT NOT NULL,
  status TEXT NOT NULL,
  confirm_token_hash TEXT,
  unsubscribe_token_hash TEXT,
  consent_at TEXT NOT NULL,
  confirmed_at TEXT,
  unsubscribed_at TEXT,
  created_at TEXT NOT NULL
);

CREATE INDEX newsletter_confirm_token ON newsletter_subscribers (confirm_token_hash);
CREATE INDEX newsletter_unsubscribe_token ON newsletter_subscribers (unsubscribe_token_hash);

CREATE TABLE audit_events (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  record_id TEXT NOT NULL,
  kind TEXT NOT NULL,
  created_at TEXT NOT NULL
);

CREATE TRIGGER audit_events_no_update
BEFORE UPDATE ON audit_events
BEGIN
  SELECT RAISE(ABORT, 'audit is append-only');
END;

CREATE TRIGGER audit_events_no_delete
BEFORE DELETE ON audit_events
BEGIN
  SELECT RAISE(ABORT, 'audit is append-only');
END;

CREATE TABLE rate_limits (
  bucket TEXT PRIMARY KEY,
  hits INTEGER NOT NULL,
  window_start TEXT NOT NULL
);
