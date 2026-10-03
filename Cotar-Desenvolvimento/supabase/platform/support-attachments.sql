ALTER TABLE cotar.support_messages ADD COLUMN IF NOT EXISTS attachments text NOT NULL DEFAULT '[]';
