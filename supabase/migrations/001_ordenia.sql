CREATE SCHEMA IF NOT EXISTS ordenia;
REVOKE ALL ON SCHEMA ordenia FROM PUBLIC, anon, authenticated;
CREATE TABLE IF NOT EXISTS ordenia.entries (
 id text PRIMARY KEY, user_id text NOT NULL,
 kind text NOT NULL CHECK (kind IN ('event','task','shop','note')), title text NOT NULL,
 original text NOT NULL, date text, time text, done boolean NOT NULL DEFAULT false,
 created_at text NOT NULL, category text NOT NULL DEFAULT 'Personal / General',
 recurrence text NOT NULL DEFAULT '', source text NOT NULL DEFAULT 'web'
);
CREATE INDEX IF NOT EXISTS entries_user_created ON ordenia.entries(user_id,created_at DESC);
CREATE TABLE IF NOT EXISTS ordenia.rules (id text PRIMARY KEY,user_id text NOT NULL,keyword text NOT NULL,category text NOT NULL,kind text NOT NULL,UNIQUE(user_id,keyword));
CREATE TABLE IF NOT EXISTS ordenia.connections (user_id text PRIMARY KEY,phone text,verified boolean NOT NULL DEFAULT false,code_hash text,code_expires text,vault_url text);
CREATE UNIQUE INDEX IF NOT EXISTS connections_verified_phone ON ordenia.connections(phone) WHERE verified=true;
CREATE TABLE IF NOT EXISTS ordenia.deliveries (id text PRIMARY KEY,user_id text NOT NULL,created_at text NOT NULL);
ALTER TABLE ordenia.entries ENABLE ROW LEVEL SECURITY;
ALTER TABLE ordenia.rules ENABLE ROW LEVEL SECURITY;
ALTER TABLE ordenia.connections ENABLE ROW LEVEL SECURITY;
ALTER TABLE ordenia.deliveries ENABLE ROW LEVEL SECURITY;
REVOKE ALL ON ALL TABLES IN SCHEMA ordenia FROM PUBLIC,anon,authenticated;
