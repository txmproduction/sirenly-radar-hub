-- LEADS: nouveaux champs
ALTER TABLE public.leads ADD COLUMN IF NOT EXISTS email text;
ALTER TABLE public.leads ADD COLUMN IF NOT EXISTS campagne_id uuid;
ALTER TABLE public.leads ADD COLUMN IF NOT EXISTS derniere_activite timestamptz NOT NULL DEFAULT now();
ALTER TABLE public.leads ADD COLUMN IF NOT EXISTS siren text;
ALTER TABLE public.leads ADD COLUMN IF NOT EXISTS effectif text;
ALTER TABLE public.leads ADD COLUMN IF NOT EXISTS source text NOT NULL DEFAULT 'bodacc';

-- PROFILS DE CIBLAGE
CREATE TABLE IF NOT EXISTS public.profils_ciblage (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  nom text NOT NULL,
  source text NOT NULL DEFAULT 'bodacc',
  secteurs jsonb NOT NULL DEFAULT '[]'::jsonb,
  departement text,
  jours integer NOT NULL DEFAULT 7,
  effectif_min text,
  effectif_max text,
  autre_secteur text,
  date_creation timestamptz NOT NULL DEFAULT now()
);
GRANT SELECT, INSERT, UPDATE, DELETE ON public.profils_ciblage TO anon, authenticated;
GRANT ALL ON public.profils_ciblage TO service_role;
ALTER TABLE public.profils_ciblage ENABLE ROW LEVEL SECURITY;
CREATE POLICY "profils_ciblage_public_access" ON public.profils_ciblage FOR ALL TO anon, authenticated USING (true) WITH CHECK (true);

-- CAMPAGNES
CREATE TABLE IF NOT EXISTS public.campagnes (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  nom text NOT NULL,
  statut text NOT NULL DEFAULT 'brouillon',
  mode text NOT NULL DEFAULT 'template',
  sujet text,
  corps text,
  brief_ia text,
  profil_ciblage_id uuid REFERENCES public.profils_ciblage(id) ON DELETE SET NULL,
  lead_ids jsonb NOT NULL DEFAULT '[]'::jsonb,
  planification text NOT NULL DEFAULT 'maintenant',
  date_creation timestamptz NOT NULL DEFAULT now(),
  date_maj timestamptz NOT NULL DEFAULT now()
);
GRANT SELECT, INSERT, UPDATE, DELETE ON public.campagnes TO anon, authenticated;
GRANT ALL ON public.campagnes TO service_role;
ALTER TABLE public.campagnes ENABLE ROW LEVEL SECURITY;
CREATE POLICY "campagnes_public_access" ON public.campagnes FOR ALL TO anon, authenticated USING (true) WITH CHECK (true);

-- EMAILS ENVOYES: liaison campagne
ALTER TABLE public.emails_envoyes ADD COLUMN IF NOT EXISTS campagne_id uuid REFERENCES public.campagnes(id) ON DELETE SET NULL;
ALTER TABLE public.emails_envoyes ADD COLUMN IF NOT EXISTS destinataire text;

-- REPONSES EMAILS (inbox)
CREATE TABLE IF NOT EXISTS public.reponses_emails (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  lead_id text REFERENCES public.leads(id) ON DELETE SET NULL,
  campagne_id uuid REFERENCES public.campagnes(id) ON DELETE SET NULL,
  email_expediteur text,
  sujet text,
  contenu text,
  classification text NOT NULL DEFAULT 'autre',
  date_reception timestamptz NOT NULL DEFAULT now(),
  lu boolean NOT NULL DEFAULT false
);
GRANT SELECT, INSERT, UPDATE, DELETE ON public.reponses_emails TO anon, authenticated;
GRANT ALL ON public.reponses_emails TO service_role;
ALTER TABLE public.reponses_emails ENABLE ROW LEVEL SECURITY;
CREATE POLICY "reponses_emails_public_access" ON public.reponses_emails FOR ALL TO anon, authenticated USING (true) WITH CHECK (true);

-- FILE D'ENVOI
CREATE TABLE IF NOT EXISTS public.file_envoi (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  campagne_id uuid REFERENCES public.campagnes(id) ON DELETE CASCADE,
  lead_id text REFERENCES public.leads(id) ON DELETE CASCADE,
  sujet_genere text,
  contenu_genere text,
  statut text NOT NULL DEFAULT 'programme',
  date_prevue date NOT NULL DEFAULT (now()::date),
  date_creation timestamptz NOT NULL DEFAULT now()
);
GRANT SELECT, INSERT, UPDATE, DELETE ON public.file_envoi TO anon, authenticated;
GRANT ALL ON public.file_envoi TO service_role;
ALTER TABLE public.file_envoi ENABLE ROW LEVEL SECURITY;
CREATE POLICY "file_envoi_public_access" ON public.file_envoi FOR ALL TO anon, authenticated USING (true) WITH CHECK (true);

-- EQUIPE
CREATE TABLE IF NOT EXISTS public.equipe (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  nom text NOT NULL,
  email text NOT NULL,
  role text NOT NULL DEFAULT 'agent',
  date_ajout timestamptz NOT NULL DEFAULT now()
);
GRANT SELECT, INSERT, UPDATE, DELETE ON public.equipe TO anon, authenticated;
GRANT ALL ON public.equipe TO service_role;
ALTER TABLE public.equipe ENABLE ROW LEVEL SECURITY;
CREATE POLICY "equipe_public_access" ON public.equipe FOR ALL TO anon, authenticated USING (true) WITH CHECK (true);

-- PARAMETRES (ligne unique)
CREATE TABLE IF NOT EXISTS public.parametres (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  nom_agence text NOT NULL DEFAULT 'Sirenly',
  logo_url text,
  fuseau_horaire text NOT NULL DEFAULT 'Europe/Paris',
  expediteur_nom text,
  expediteur_email text,
  email_reception text,
  contexte_ia text,
  classification_auto boolean NOT NULL DEFAULT true,
  radar_departement text DEFAULT '74',
  exclusions jsonb NOT NULL DEFAULT '["holding","portage","gestion de participations","société civile immobilière","coursier","livreur","livraison de repas","uber eats","à vélo"]'::jsonb,
  notif_recap_quotidien boolean NOT NULL DEFAULT true,
  notif_reponse_interessee boolean NOT NULL DEFAULT true,
  date_maj timestamptz NOT NULL DEFAULT now()
);
GRANT SELECT, INSERT, UPDATE, DELETE ON public.parametres TO anon, authenticated;
GRANT ALL ON public.parametres TO service_role;
ALTER TABLE public.parametres ENABLE ROW LEVEL SECURITY;
CREATE POLICY "parametres_public_access" ON public.parametres FOR ALL TO anon, authenticated USING (true) WITH CHECK (true);

INSERT INTO public.parametres (nom_agence) SELECT 'Sirenly' WHERE NOT EXISTS (SELECT 1 FROM public.parametres);

-- REALTIME
ALTER PUBLICATION supabase_realtime ADD TABLE public.campagnes;
ALTER PUBLICATION supabase_realtime ADD TABLE public.reponses_emails;
ALTER PUBLICATION supabase_realtime ADD TABLE public.file_envoi;
ALTER PUBLICATION supabase_realtime ADD TABLE public.profils_ciblage;
ALTER PUBLICATION supabase_realtime ADD TABLE public.equipe;
ALTER PUBLICATION supabase_realtime ADD TABLE public.parametres;