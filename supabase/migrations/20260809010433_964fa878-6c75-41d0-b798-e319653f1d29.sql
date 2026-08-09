CREATE TABLE public.leads (
  id text PRIMARY KEY,
  nom text,
  contact text,
  telephone text,
  commune text,
  activite text,
  adresse text,
  code_postal text,
  forme_juridique text,
  note_google text,
  nb_avis_google text,
  statut text NOT NULL DEFAULT 'non_qualifie',
  notes text,
  qualifie_par text,
  rdv_date text,
  rdv_heure text,
  date_maj timestamptz NOT NULL DEFAULT now()
);
GRANT SELECT, INSERT, UPDATE, DELETE ON public.leads TO anon, authenticated;
GRANT ALL ON public.leads TO service_role;
ALTER TABLE public.leads ENABLE ROW LEVEL SECURITY;
CREATE POLICY "leads_public_access" ON public.leads FOR ALL TO anon, authenticated USING (true) WITH CHECK (true);

CREATE TABLE public.emails_envoyes (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  lead_id text REFERENCES public.leads(id) ON DELETE CASCADE,
  sujet text,
  contenu text,
  date_envoi timestamptz NOT NULL DEFAULT now(),
  statut_envoi text
);
GRANT SELECT, INSERT, UPDATE, DELETE ON public.emails_envoyes TO anon, authenticated;
GRANT ALL ON public.emails_envoyes TO service_role;
ALTER TABLE public.emails_envoyes ENABLE ROW LEVEL SECURITY;
CREATE POLICY "emails_public_access" ON public.emails_envoyes FOR ALL TO anon, authenticated USING (true) WITH CHECK (true);

CREATE TABLE public.reponses_formulaire (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  lead_id text REFERENCES public.leads(id) ON DELETE SET NULL,
  nom_entreprise text,
  reponses jsonb,
  classification text,
  date_reponse timestamptz NOT NULL DEFAULT now()
);
GRANT SELECT, INSERT, UPDATE, DELETE ON public.reponses_formulaire TO anon, authenticated;
GRANT ALL ON public.reponses_formulaire TO service_role;
ALTER TABLE public.reponses_formulaire ENABLE ROW LEVEL SECURITY;
CREATE POLICY "reponses_public_access" ON public.reponses_formulaire FOR ALL TO anon, authenticated USING (true) WITH CHECK (true);

CREATE INDEX idx_emails_lead ON public.emails_envoyes(lead_id);
CREATE INDEX idx_reponses_lead ON public.reponses_formulaire(lead_id);

ALTER TABLE public.leads REPLICA IDENTITY FULL;
ALTER TABLE public.emails_envoyes REPLICA IDENTITY FULL;
ALTER TABLE public.reponses_formulaire REPLICA IDENTITY FULL;
ALTER PUBLICATION supabase_realtime ADD TABLE public.leads;
ALTER PUBLICATION supabase_realtime ADD TABLE public.emails_envoyes;
ALTER PUBLICATION supabase_realtime ADD TABLE public.reponses_formulaire;