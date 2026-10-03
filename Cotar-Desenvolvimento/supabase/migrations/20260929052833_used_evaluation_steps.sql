CREATE TABLE IF NOT EXISTS cotar.used_evaluation_steps (
  assessment_id text NOT NULL REFERENCES cotar.assessments(id) ON DELETE CASCADE,
  company_id text NOT NULL,
  stage text NOT NULL CHECK (stage IN ('consultations','checklist','vehicle','client')),
  data jsonb NOT NULL DEFAULT '{}'::jsonb,
  version integer NOT NULL DEFAULT 1,
  updated_at timestamptz NOT NULL DEFAULT now(),
  PRIMARY KEY (assessment_id,stage)
);
CREATE INDEX IF NOT EXISTS used_evaluation_steps_company_stage_idx ON cotar.used_evaluation_steps(company_id,stage);
ALTER TABLE cotar.used_evaluation_steps ENABLE ROW LEVEL SECURITY;
REVOKE ALL ON cotar.used_evaluation_steps FROM PUBLIC, anon, authenticated;
