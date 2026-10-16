-- Ciudad ya estaba. Región o país, perfil y cómo quiere ayudar se suman.
-- Las fichas anteriores quedan con NULL y no entran en el reintento de ClickUp.
ALTER TABLE submissions ADD COLUMN region TEXT;
ALTER TABLE submissions ADD COLUMN profile TEXT;
ALTER TABLE submissions ADD COLUMN how_help TEXT;
ALTER TABLE submissions ADD COLUMN clickup_task_id TEXT;
ALTER TABLE submissions ADD COLUMN clickup_status TEXT;

CREATE INDEX submissions_clickup_retry ON submissions (clickup_status) WHERE clickup_status = 'retry';
