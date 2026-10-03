CREATE TABLE IF NOT EXISTS cotar.crm_subscriptions (
 id text PRIMARY KEY, company_id text UNIQUE, email text NOT NULL UNIQUE, cpf text NOT NULL UNIQUE,
 document text NOT NULL UNIQUE, plan text NOT NULL, registration text NOT NULL, password_hash text NOT NULL,
 token_hash text NOT NULL UNIQUE, status text NOT NULL DEFAULT 'pending', customer_id text,
 provider_id text UNIQUE, invoice_url text, valid_until text, created_at text NOT NULL, updated_at text NOT NULL
);
CREATE TABLE IF NOT EXISTS cotar.crm_billing_payments (
 id text PRIMARY KEY, subscription_id text NOT NULL REFERENCES cotar.crm_subscriptions(id),
 status text NOT NULL, valid_until text NOT NULL, updated_at text NOT NULL
);
CREATE INDEX IF NOT EXISTS crm_payment_subscription ON cotar.crm_billing_payments(subscription_id,status,valid_until);
ALTER TABLE cotar.crm_subscriptions ENABLE ROW LEVEL SECURITY;
ALTER TABLE cotar.crm_billing_payments ENABLE ROW LEVEL SECURITY;
REVOKE ALL ON cotar.crm_subscriptions,cotar.crm_billing_payments FROM PUBLIC,anon,authenticated;
CREATE OR REPLACE FUNCTION cotar.assign_sale_code() RETURNS trigger LANGUAGE plpgsql SET search_path = '' AS $$
DECLARE next_value integer;
BEGIN
 IF NEW.data->>'saleCode' IS NOT NULL THEN RETURN NEW; END IF;
 INSERT INTO cotar.sale_counters(company_id,value) VALUES (coalesce(NEW.company_id,''),1)
 ON CONFLICT(company_id) DO UPDATE SET value=cotar.sale_counters.value+1 RETURNING value INTO next_value;
 NEW.data=jsonb_set(NEW.data,'{saleCode}',to_jsonb('C'||next_value),true);
 RETURN NEW;
END;
$$;
REVOKE ALL ON FUNCTION cotar.assign_sale_code() FROM PUBLIC,anon,authenticated;
