-- The source marks available quotas as "Reservado"; the latest observation wins.
ALTER TABLE public.reservas ADD COLUMN IF NOT EXISTS revisao integer NOT NULL DEFAULT 1;
ALTER TABLE public.reservas ADD COLUMN IF NOT EXISTS editado_em timestamptz;
CREATE INDEX IF NOT EXISTS reservas_catalogo_latest ON public.reservas(loja,cota,data_de_inclusao DESC,id DESC);
CREATE INDEX IF NOT EXISTS reservas_catalogo_status ON public.reservas(status_reposicao);
