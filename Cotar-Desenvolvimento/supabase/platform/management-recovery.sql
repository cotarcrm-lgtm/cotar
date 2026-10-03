CREATE TABLE IF NOT EXISTS cotar.platform_management_reset_tokens (token_hash text PRIMARY KEY, account_id text NOT NULL REFERENCES cotar.platform_accounts(id), created_by text NOT NULL, expires_at bigint NOT NULL, created_at text NOT NULL);
CREATE INDEX IF NOT EXISTS platform_management_reset_account ON cotar.platform_management_reset_tokens(account_id);
ALTER TABLE cotar.platform_management_reset_tokens ENABLE ROW LEVEL SECURITY;
REVOKE ALL ON cotar.platform_management_reset_tokens FROM anon,authenticated;
