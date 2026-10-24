CREATE TABLE IF NOT EXISTS agi_workspaces (
 id text PRIMARY KEY,
 name text NOT NULL,
 data jsonb NOT NULL,
 revision integer NOT NULL DEFAULT 0,
 created_at timestamptz NOT NULL DEFAULT now()
);
CREATE TABLE IF NOT EXISTS agi_members (
 user_id text PRIMARY KEY REFERENCES "user"(id) ON DELETE CASCADE,
 workspace_id text NOT NULL REFERENCES agi_workspaces(id) ON DELETE CASCADE,
 role text NOT NULL CHECK (role IN ('owner','editor','viewer'))
);
CREATE INDEX IF NOT EXISTS agi_members_workspace ON agi_members(workspace_id);
CREATE TABLE IF NOT EXISTS agi_events (
 id text PRIMARY KEY,
 workspace_id text NOT NULL REFERENCES agi_workspaces(id),
 user_id text NOT NULL REFERENCES "user"(id),
 action text NOT NULL,
 detail jsonb NOT NULL,
 created_at timestamptz NOT NULL DEFAULT now()
);
CREATE INDEX IF NOT EXISTS agi_events_workspace ON agi_events(workspace_id, created_at DESC);
CREATE TABLE IF NOT EXISTS agi_invitations (
 token_hash text PRIMARY KEY,
 workspace_id text NOT NULL REFERENCES agi_workspaces(id),
 email text NOT NULL,
 role text NOT NULL CHECK (role IN ('editor','viewer')),
 expires_at timestamptz NOT NULL DEFAULT now() + interval '7 days'
);
