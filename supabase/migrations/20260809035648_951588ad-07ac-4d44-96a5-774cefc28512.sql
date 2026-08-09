ALTER TABLE public.leads ADD COLUMN IF NOT EXISTS enrichissement_en_cours boolean NOT NULL DEFAULT false;
CREATE INDEX IF NOT EXISTS leads_enrichissement_idx ON public.leads (enrichissement_en_cours);