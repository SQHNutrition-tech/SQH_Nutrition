-- Nutrition follow-up hub: initial schema.
-- No patient names or diagnoses are stored: only the hospital number,
-- location, follow-up task and the nutrition plan needed for handover.

CREATE TABLE members (
    email      TEXT PRIMARY KEY,
    name       TEXT NOT NULL,
    role       TEXT NOT NULL DEFAULT 'dietitian' CHECK (role IN ('dietitian', 'admin')),
    active     INTEGER NOT NULL DEFAULT 1,
    created_at TEXT NOT NULL,
    last_seen  TEXT
);

CREATE TABLE cases (
    id           INTEGER PRIMARY KEY AUTOINCREMENT,
    facility     TEXT NOT NULL,
    hospital_no  TEXT NOT NULL,
    setting      TEXT NOT NULL CHECK (setting IN ('inpatient', 'outpatient')),
    location     TEXT NOT NULL,
    bed          TEXT,
    owner        TEXT NOT NULL REFERENCES members (email),
    status       TEXT NOT NULL CHECK (status IN ('active', 'closed')),
    risk         TEXT CHECK (risk IN ('high', 'medium', 'low')),
    urgent       INTEGER NOT NULL DEFAULT 0,
    due          TEXT,
    next_action  TEXT,
    plan         TEXT NOT NULL DEFAULT '{}',
    pending_to   TEXT REFERENCES members (email),
    pending_note TEXT,
    close_reason TEXT,
    closed_at    TEXT,
    revision     INTEGER NOT NULL DEFAULT 1,
    created_at   TEXT NOT NULL,
    updated_at   TEXT NOT NULL
);

-- A patient can have only one open case at a time; closed cases may repeat
-- (readmissions).
CREATE UNIQUE INDEX cases_one_active ON cases (facility, hospital_no) WHERE status = 'active';
CREATE INDEX cases_owner ON cases (owner, status);
CREATE INDEX cases_pending ON cases (pending_to) WHERE pending_to IS NOT NULL;
CREATE INDEX cases_closed ON cases (closed_at) WHERE status = 'closed';

CREATE TABLE events (
    id      INTEGER PRIMARY KEY AUTOINCREMENT,
    case_id INTEGER NOT NULL REFERENCES cases (id) ON DELETE CASCADE,
    at      TEXT NOT NULL,
    actor   TEXT NOT NULL,
    action  TEXT NOT NULL,
    text    TEXT NOT NULL
);
CREATE INDEX events_case ON events (case_id);

-- Phone directory and quick links, edited by admins inside the app.
CREATE TABLE directory (
    id       INTEGER PRIMARY KEY AUTOINCREMENT,
    category TEXT NOT NULL,
    name     TEXT NOT NULL,
    ext      TEXT NOT NULL,
    notes    TEXT NOT NULL DEFAULT '',
    sort     INTEGER NOT NULL DEFAULT 0
);

CREATE TABLE links (
    id    INTEGER PRIMARY KEY AUTOINCREMENT,
    label TEXT NOT NULL,
    url   TEXT NOT NULL,
    sort  INTEGER NOT NULL DEFAULT 0
);
