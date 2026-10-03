CREATE TABLE IF NOT EXISTS cotar.platform_accounts (id text PRIMARY KEY, name text NOT NULL, email text NOT NULL UNIQUE, password_hash text NOT NULL, role text NOT NULL, permissions text NOT NULL, status text NOT NULL DEFAULT 'ATIVO', version integer NOT NULL DEFAULT 1, must_change integer NOT NULL DEFAULT 0, created_at text NOT NULL, updated_at text NOT NULL);
CREATE TABLE IF NOT EXISTS cotar.platform_sessions (token_hash text PRIMARY KEY, account_id text NOT NULL REFERENCES cotar.platform_accounts(id), expires_at bigint NOT NULL);
CREATE INDEX IF NOT EXISTS platform_sessions_account ON cotar.platform_sessions(account_id);
CREATE TABLE IF NOT EXISTS cotar.platform_settings (key text PRIMARY KEY,value text NOT NULL);
ALTER TABLE cotar.platform_accounts ENABLE ROW LEVEL SECURITY;
ALTER TABLE cotar.platform_sessions ENABLE ROW LEVEL SECURITY;
ALTER TABLE cotar.platform_settings ENABLE ROW LEVEL SECURITY;
REVOKE ALL ON cotar.platform_accounts,cotar.platform_sessions,cotar.platform_settings FROM anon,authenticated;

CREATE TABLE IF NOT EXISTS cotar.platform_management_reset_tokens (token_hash text PRIMARY KEY, account_id text NOT NULL REFERENCES cotar.platform_accounts(id), created_by text NOT NULL, expires_at bigint NOT NULL, created_at text NOT NULL);
CREATE INDEX IF NOT EXISTS platform_management_reset_account ON cotar.platform_management_reset_tokens(account_id);
ALTER TABLE cotar.platform_management_reset_tokens ENABLE ROW LEVEL SECURITY;
REVOKE ALL ON cotar.platform_management_reset_tokens FROM anon,authenticated;
