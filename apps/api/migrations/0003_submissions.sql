CREATE TABLE submissions (
  id TEXT PRIMARY KEY,
  email TEXT NOT NULL,
  name TEXT,
  city TEXT,
  link TEXT,
  message TEXT,
  locale TEXT NOT NULL,
  consent_at TEXT NOT NULL,
  created_at TEXT NOT NULL
);

CREATE TABLE submission_intents (
  submission_id TEXT NOT NULL,
  intent TEXT NOT NULL CHECK (intent IN ('hackatrain', 'ciudad', 'colaborar', 'donar', 'equipo', 'boletin')),
  PRIMARY KEY (submission_id, intent),
  FOREIGN KEY (submission_id) REFERENCES submissions(id)
);

CREATE INDEX submission_intents_intent ON submission_intents (intent);

-- La ficha vieja de preinscripción cubría el Hackatrain y el relevamiento en la ciudad.
-- Se copian las dos intenciones. Las filas de origen quedan.
INSERT OR IGNORE INTO submissions (id, email, name, city, link, message, locale, consent_at, created_at)
SELECT id, email, NULL, NULL, linkedin, message, locale, consent_at, created_at
FROM preinscriptions;

INSERT OR IGNORE INTO submission_intents (submission_id, intent)
SELECT id, 'hackatrain' FROM preinscriptions;

INSERT OR IGNORE INTO submission_intents (submission_id, intent)
SELECT id, 'ciudad' FROM preinscriptions;

-- sumarme pasa a equipo. colaborar y donar conservan el nombre.
INSERT OR IGNORE INTO submissions (id, email, name, city, link, message, locale, consent_at, created_at)
SELECT id, email, NULL, NULL, linkedin, message, locale, consent_at, created_at
FROM contacts;

INSERT OR IGNORE INTO submission_intents (submission_id, intent)
SELECT id, CASE intent WHEN 'sumarme' THEN 'equipo' ELSE intent END
FROM contacts;
