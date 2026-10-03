CREATE TABLE cotar.grupos_consorcio_honda (
 grupo integer PRIMARY KEY,
 situacao text NOT NULL,
 nome_plano text,
 prazo integer,
 assembleias_base integer,
 vencimento integer,
 parcelas_restantes integer,
 media_julho numeric,
 contemplacoes_julho integer,
 media_agosto numeric,
 contemplacoes_agosto integer,
 fonte text NOT NULL DEFAULT 'grupos Brasil consorcio Honda (2)3.xlsx',
 importado_em timestamptz NOT NULL DEFAULT now()
);
CREATE INDEX grupos_honda_situacao ON cotar.grupos_consorcio_honda(situacao,grupo);
ALTER TABLE cotar.grupos_consorcio_honda ENABLE ROW LEVEL SECURITY;
REVOKE ALL ON cotar.grupos_consorcio_honda FROM PUBLIC, anon, authenticated;
