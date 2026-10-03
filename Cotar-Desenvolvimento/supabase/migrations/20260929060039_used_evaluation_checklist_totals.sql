ALTER TABLE cotar.used_evaluation_steps
ADD COLUMN IF NOT EXISTS mechanics_total numeric(14,2) NOT NULL DEFAULT 0,
ADD COLUMN IF NOT EXISTS aesthetics_total numeric(14,2) NOT NULL DEFAULT 0,
ADD COLUMN IF NOT EXISTS services_total numeric(14,2) NOT NULL DEFAULT 0,
ADD COLUMN IF NOT EXISTS preparation_total numeric(14,2) NOT NULL DEFAULT 0;
ALTER TABLE cotar.used_evaluation_steps
ADD CONSTRAINT used_evaluation_steps_totals_nonnegative
CHECK (mechanics_total >= 0 AND aesthetics_total >= 0 AND services_total >= 0 AND preparation_total >= 0);
