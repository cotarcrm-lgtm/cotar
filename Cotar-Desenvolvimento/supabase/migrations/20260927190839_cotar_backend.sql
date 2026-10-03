CREATE SCHEMA IF NOT EXISTS cotar;

REVOKE ALL ON SCHEMA cotar FROM PUBLIC, anon, authenticated;

CREATE TABLE cotar.companies (
  "company_id" text,
  "created_by" text,
  "id" text PRIMARY KEY,
  "data" jsonb NOT NULL,
  "version" integer NOT NULL DEFAULT 1,
  "created_at" text NOT NULL,
  "updated_at" text NOT NULL
);

ALTER TABLE cotar.companies ENABLE ROW LEVEL SECURITY;

REVOKE ALL ON cotar.companies FROM PUBLIC, anon, authenticated;

CREATE INDEX companies_company_created_idx ON cotar.companies (company_id,created_at DESC);

CREATE TABLE cotar.groups (
  "company_id" text,
  "created_by" text,
  "id" text PRIMARY KEY,
  "data" jsonb NOT NULL,
  "version" integer NOT NULL DEFAULT 1,
  "created_at" text NOT NULL,
  "updated_at" text NOT NULL
);

ALTER TABLE cotar.groups ENABLE ROW LEVEL SECURITY;

REVOKE ALL ON cotar.groups FROM PUBLIC, anon, authenticated;

CREATE INDEX groups_company_created_idx ON cotar.groups (company_id,created_at DESC);

CREATE TABLE cotar.regions (
  "company_id" text,
  "created_by" text,
  "id" text PRIMARY KEY,
  "data" jsonb NOT NULL,
  "version" integer NOT NULL DEFAULT 1,
  "created_at" text NOT NULL,
  "updated_at" text NOT NULL
);

ALTER TABLE cotar.regions ENABLE ROW LEVEL SECURITY;

REVOKE ALL ON cotar.regions FROM PUBLIC, anon, authenticated;

CREATE INDEX regions_company_created_idx ON cotar.regions (company_id,created_at DESC);

CREATE TABLE cotar.stores (
  "id" text PRIMARY KEY,
  "data" jsonb NOT NULL,
  "version" integer NOT NULL DEFAULT 1,
  "created_at" text NOT NULL,
  "updated_at" text NOT NULL,
  "company_id" text,
  "created_by" text
);

ALTER TABLE cotar.stores ENABLE ROW LEVEL SECURITY;

REVOKE ALL ON cotar.stores FROM PUBLIC, anon, authenticated;

CREATE INDEX stores_company_created_idx ON cotar.stores (company_id,created_at DESC);

CREATE TABLE cotar.teams (
  "company_id" text,
  "created_by" text,
  "id" text PRIMARY KEY,
  "data" jsonb NOT NULL,
  "version" integer NOT NULL DEFAULT 1,
  "created_at" text NOT NULL,
  "updated_at" text NOT NULL,
  "store_id" text NOT NULL
);

ALTER TABLE cotar.teams ENABLE ROW LEVEL SECURITY;

REVOKE ALL ON cotar.teams FROM PUBLIC, anon, authenticated;

CREATE INDEX teams_company_created_idx ON cotar.teams (company_id,created_at DESC);

CREATE TABLE cotar.users (
  "id" text PRIMARY KEY,
  "data" jsonb NOT NULL,
  "version" integer NOT NULL DEFAULT 1,
  "created_at" text NOT NULL,
  "updated_at" text NOT NULL,
  "store_id" text NOT NULL,
  "email" text NOT NULL,
  "company_id" text,
  "created_by" text
);

ALTER TABLE cotar.users ENABLE ROW LEVEL SECURITY;

REVOKE ALL ON cotar.users FROM PUBLIC, anon, authenticated;

CREATE INDEX users_company_created_idx ON cotar.users (company_id,created_at DESC);

CREATE TABLE cotar.leads (
  "id" text PRIMARY KEY,
  "data" jsonb NOT NULL,
  "version" integer NOT NULL DEFAULT 1,
  "created_at" text NOT NULL,
  "updated_at" text NOT NULL,
  "store_id" text NOT NULL,
  "user_id" text,
  "company_id" text,
  "created_by" text
);

ALTER TABLE cotar.leads ENABLE ROW LEVEL SECURITY;

REVOKE ALL ON cotar.leads FROM PUBLIC, anon, authenticated;

CREATE INDEX leads_company_created_idx ON cotar.leads (company_id,created_at DESC);

CREATE TABLE cotar.vehicles (
  "id" text PRIMARY KEY,
  "data" jsonb NOT NULL,
  "version" integer NOT NULL DEFAULT 1,
  "created_at" text NOT NULL,
  "updated_at" text NOT NULL,
  "store_id" text NOT NULL,
  "plate" text NOT NULL,
  "company_id" text,
  "created_by" text
);

ALTER TABLE cotar.vehicles ENABLE ROW LEVEL SECURITY;

REVOKE ALL ON cotar.vehicles FROM PUBLIC, anon, authenticated;

CREATE INDEX vehicles_company_created_idx ON cotar.vehicles (company_id,created_at DESC);

CREATE TABLE cotar.assessments (
  "id" text PRIMARY KEY,
  "data" jsonb NOT NULL,
  "version" integer NOT NULL DEFAULT 1,
  "created_at" text NOT NULL,
  "updated_at" text NOT NULL,
  "store_id" text NOT NULL,
  "user_id" text,
  "vehicle_id" text,
  "company_id" text,
  "created_by" text
);

ALTER TABLE cotar.assessments ENABLE ROW LEVEL SECURITY;

REVOKE ALL ON cotar.assessments FROM PUBLIC, anon, authenticated;

CREATE INDEX assessments_company_created_idx ON cotar.assessments (company_id,created_at DESC);

CREATE TABLE cotar.sales (
  "id" text PRIMARY KEY,
  "data" jsonb NOT NULL,
  "version" integer NOT NULL DEFAULT 1,
  "created_at" text NOT NULL,
  "updated_at" text NOT NULL,
  "store_id" text NOT NULL,
  "user_id" text NOT NULL,
  "vehicle_id" text,
  "lead_id" text NOT NULL,
  "status" text NOT NULL,
  "company_id" text,
  "created_by" text
);

ALTER TABLE cotar.sales ENABLE ROW LEVEL SECURITY;

REVOKE ALL ON cotar.sales FROM PUBLIC, anon, authenticated;

CREATE INDEX sales_company_created_idx ON cotar.sales (company_id,created_at DESC);

CREATE TABLE cotar.accounts (
  "user_id" text PRIMARY KEY,
  "cpf" text NOT NULL,
  "password_hash" text NOT NULL,
  "must_change" integer NOT NULL DEFAULT 1
);

ALTER TABLE cotar.accounts ENABLE ROW LEVEL SECURITY;

REVOKE ALL ON cotar.accounts FROM PUBLIC, anon, authenticated;

CREATE TABLE cotar.sessions (
  "token_hash" text PRIMARY KEY,
  "user_id" text NOT NULL,
  "expires_at" bigint NOT NULL
);

ALTER TABLE cotar.sessions ENABLE ROW LEVEL SECURITY;

REVOKE ALL ON cotar.sessions FROM PUBLIC, anon, authenticated;

CREATE TABLE cotar.auth_limits (
  "key" text PRIMARY KEY,
  "count" integer NOT NULL,
  "expires_at" bigint NOT NULL
);

ALTER TABLE cotar.auth_limits ENABLE ROW LEVEL SECURITY;

REVOKE ALL ON cotar.auth_limits FROM PUBLIC, anon, authenticated;

CREATE TABLE cotar.settings (
  "key" text PRIMARY KEY,
  "value" text NOT NULL
);

ALTER TABLE cotar.settings ENABLE ROW LEVEL SECURITY;

REVOKE ALL ON cotar.settings FROM PUBLIC, anon, authenticated;

ALTER TABLE cotar.teams ADD CONSTRAINT teams_store_id_fk FOREIGN KEY (store_id) REFERENCES cotar.stores(id) ON DELETE RESTRICT;

ALTER TABLE cotar.users ADD CONSTRAINT users_store_id_fk FOREIGN KEY (store_id) REFERENCES cotar.stores(id) ON DELETE RESTRICT;

ALTER TABLE cotar.leads ADD CONSTRAINT leads_user_id_fk FOREIGN KEY (user_id) REFERENCES cotar.users(id) ON DELETE RESTRICT;

ALTER TABLE cotar.leads ADD CONSTRAINT leads_store_id_fk FOREIGN KEY (store_id) REFERENCES cotar.stores(id) ON DELETE RESTRICT;

ALTER TABLE cotar.vehicles ADD CONSTRAINT vehicles_store_id_fk FOREIGN KEY (store_id) REFERENCES cotar.stores(id) ON DELETE RESTRICT;

ALTER TABLE cotar.assessments ADD CONSTRAINT assessments_vehicle_id_fk FOREIGN KEY (vehicle_id) REFERENCES cotar.vehicles(id) ON DELETE RESTRICT;

ALTER TABLE cotar.assessments ADD CONSTRAINT assessments_user_id_fk FOREIGN KEY (user_id) REFERENCES cotar.users(id) ON DELETE RESTRICT;

ALTER TABLE cotar.assessments ADD CONSTRAINT assessments_store_id_fk FOREIGN KEY (store_id) REFERENCES cotar.stores(id) ON DELETE RESTRICT;

ALTER TABLE cotar.sales ADD CONSTRAINT sales_lead_id_fk FOREIGN KEY (lead_id) REFERENCES cotar.leads(id) ON DELETE RESTRICT;

ALTER TABLE cotar.sales ADD CONSTRAINT sales_vehicle_id_fk FOREIGN KEY (vehicle_id) REFERENCES cotar.vehicles(id) ON DELETE RESTRICT;

ALTER TABLE cotar.sales ADD CONSTRAINT sales_user_id_fk FOREIGN KEY (user_id) REFERENCES cotar.users(id) ON DELETE RESTRICT;

ALTER TABLE cotar.sales ADD CONSTRAINT sales_store_id_fk FOREIGN KEY (store_id) REFERENCES cotar.stores(id) ON DELETE RESTRICT;

ALTER TABLE cotar.accounts ADD CONSTRAINT accounts_user_id_fk FOREIGN KEY (user_id) REFERENCES cotar.users(id) ON DELETE CASCADE;

ALTER TABLE cotar.sessions ADD CONSTRAINT sessions_user_id_fk FOREIGN KEY (user_id) REFERENCES cotar.users(id) ON DELETE CASCADE;

CREATE UNIQUE INDEX accounts_cpf_unique ON cotar.accounts(cpf);

CREATE UNIQUE INDEX users_email_unique ON cotar.users(email);

CREATE UNIQUE INDEX vehicles_plate_unique ON cotar.vehicles(plate);

CREATE UNIQUE INDEX sales_completed_vehicle_unique ON cotar.sales(vehicle_id) WHERE status='Concluída';

CREATE INDEX sessions_user_id_idx ON cotar.sessions(user_id);

CREATE INDEX sessions_expires_idx ON cotar.sessions(expires_at);

CREATE INDEX auth_limits_expires_idx ON cotar.auth_limits(expires_at);

CREATE TABLE cotar.chat_lists (
  id text PRIMARY KEY, company_id text NOT NULL, owner_id text NOT NULL REFERENCES cotar.users(id),
  name text NOT NULL, team_ids text NOT NULL, created_at text NOT NULL
);
CREATE INDEX chat_lists_owner ON cotar.chat_lists(company_id,owner_id);

CREATE TABLE cotar.chat_messages (
  id text PRIMARY KEY, company_id text NOT NULL, sender_id text NOT NULL REFERENCES cotar.users(id),
  client_id text NOT NULL, kind text NOT NULL, body text NOT NULL,
  attachments text NOT NULL DEFAULT '[]', audience text NOT NULL DEFAULT '', created_at text NOT NULL
);
CREATE UNIQUE INDEX chat_sender_request_unique ON cotar.chat_messages(sender_id,client_id);
CREATE INDEX chat_company_time ON cotar.chat_messages(company_id,created_at);

CREATE TABLE cotar.chat_recipients (
  message_id text NOT NULL REFERENCES cotar.chat_messages(id) ON DELETE CASCADE,
  recipient_id text NOT NULL REFERENCES cotar.users(id), read_at text,
  PRIMARY KEY(message_id,recipient_id)
);
CREATE INDEX chat_recipient_read ON cotar.chat_recipients(recipient_id,read_at);

CREATE TABLE cotar.sale_counters (company_id text PRIMARY KEY, value integer NOT NULL);

CREATE FUNCTION cotar.assign_sale_code() RETURNS trigger LANGUAGE plpgsql SET search_path = '' AS $$
DECLARE next_value integer;
BEGIN
  INSERT INTO cotar.sale_counters(company_id,value) VALUES (coalesce(NEW.company_id,''),1)
  ON CONFLICT(company_id) DO UPDATE SET value=cotar.sale_counters.value+1
  RETURNING value INTO next_value;
  NEW.data = jsonb_set(NEW.data,'{saleCode}',to_jsonb('C'||next_value),true);
  RETURN NEW;
END;
$$;
CREATE TRIGGER sales_assign_code BEFORE INSERT ON cotar.sales FOR EACH ROW EXECUTE FUNCTION cotar.assign_sale_code();

ALTER TABLE cotar.chat_lists ENABLE ROW LEVEL SECURITY;
ALTER TABLE cotar.chat_messages ENABLE ROW LEVEL SECURITY;
ALTER TABLE cotar.chat_recipients ENABLE ROW LEVEL SECURITY;
ALTER TABLE cotar.sale_counters ENABLE ROW LEVEL SECURITY;
REVOKE ALL ON ALL TABLES IN SCHEMA cotar FROM PUBLIC, anon, authenticated;
REVOKE ALL ON FUNCTION cotar.assign_sale_code() FROM PUBLIC, anon, authenticated;

CREATE INDEX users_store_id_idx ON cotar.users(store_id);

CREATE INDEX leads_user_id_idx ON cotar.leads(user_id);

CREATE INDEX leads_store_id_idx ON cotar.leads(store_id);

CREATE INDEX vehicles_store_id_idx ON cotar.vehicles(store_id);

CREATE INDEX assessments_vehicle_id_idx ON cotar.assessments(vehicle_id);

CREATE INDEX assessments_user_id_idx ON cotar.assessments(user_id);

CREATE INDEX assessments_store_id_idx ON cotar.assessments(store_id);

CREATE INDEX sales_lead_id_idx ON cotar.sales(lead_id);

CREATE INDEX sales_vehicle_id_idx ON cotar.sales(vehicle_id);

CREATE INDEX sales_user_id_idx ON cotar.sales(user_id);

CREATE INDEX sales_store_id_idx ON cotar.sales(store_id);

CREATE INDEX teams_store_id_idx ON cotar.teams(store_id);
