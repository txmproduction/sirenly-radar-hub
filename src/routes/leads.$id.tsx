import { useQuery } from "@tanstack/react-query";
import { createFileRoute, Link } from "@tanstack/react-router";
import { ArrowLeft } from "lucide-react";

import { supabase } from "@/integrations/supabase/client";
import {
  classificationMeta,
  formatDate,
  statutClasses,
  statutLabel,
  useRealtime,
} from "@/lib/sirenly";

export const Route = createFileRoute("/leads/$id")({
  head: () => ({
    meta: [
      { title: "Fiche lead — Sirenly" },
      {
        name: "description",
        content: "Historique complet d'un lead : infos BODACC, Google Places, emails et réponses.",
      },
      { property: "og:title", content: "Fiche lead — Sirenly" },
      {
        property: "og:description",
        content: "Infos BODACC, Google Places, emails envoyés et réponse au formulaire.",
      },
    ],
  }),
  component: LeadDetail,
});

function Field({ label, value }: { label: string; value: string | null | undefined }) {
  return (
    <div className="rounded-xl border border-border bg-secondary/40 px-4 py-3">
      <p className="text-[11px] font-semibold uppercase tracking-wide text-muted-foreground">
        {label}
      </p>
      <p className="mt-1 text-sm font-medium break-words">{value || "—"}</p>
    </div>
  );
}

function LeadDetail() {
  const { id } = Route.useParams();
  useRealtime("leads", ["lead", "lead-emails", "lead-reponse"]);
  useRealtime("emails_envoyes", ["lead-emails"]);
  useRealtime("reponses_formulaire", ["lead-reponse"]);

  const { data: lead, isLoading } = useQuery({
    queryKey: ["lead", id],
    queryFn: async () => {
      const { data, error } = await supabase.from("leads").select("*").eq("id", id).maybeSingle();
      if (error) throw error;
      return data;
    },
  });

  const { data: emails = [] } = useQuery({
    queryKey: ["lead-emails", id],
    queryFn: async () => {
      const { data, error } = await supabase
        .from("emails_envoyes")
        .select("*")
        .eq("lead_id", id)
        .order("date_envoi", { ascending: false });
      if (error) throw error;
      return data ?? [];
    },
  });

  const { data: reponses = [] } = useQuery({
    queryKey: ["lead-reponse", id],
    queryFn: async () => {
      const { data, error } = await supabase
        .from("reponses_formulaire")
        .select("*")
        .eq("lead_id", id)
        .order("date_reponse", { ascending: false });
      if (error) throw error;
      return data ?? [];
    },
  });

  if (isLoading) return <p className="text-sm text-muted-foreground">Chargement…</p>;
  if (!lead) return <p className="panel p-6 text-sm text-muted-foreground">Lead introuvable.</p>;

  return (
    <div className="space-y-6">
      <Link
        to="/leads"
        className="inline-flex items-center gap-2 text-sm text-muted-foreground hover:text-foreground"
      >
        <ArrowLeft className="size-4" /> Retour à la qualification
      </Link>

      <header className="panel flex flex-wrap items-start justify-between gap-4 p-6">
        <div>
          <h1 className="text-2xl font-extrabold tracking-tight">{lead.nom ?? "Sans nom"}</h1>
          <p className="mt-1 text-sm text-muted-foreground">
            {[lead.commune, lead.activite].filter(Boolean).join(" · ") || "—"}
          </p>
        </div>
        <span
          className={`rounded-full border px-3 py-1 text-xs font-semibold ${statutClasses(lead.statut)}`}
        >
          {statutLabel(lead.statut)}
        </span>
      </header>

      <section className="grid gap-3 sm:grid-cols-2 xl:grid-cols-3">
        <Field label="Contact" value={lead.contact} />
        <Field label="Téléphone" value={lead.telephone} />
        <Field label="Adresse" value={lead.adresse} />
        <Field label="Code postal" value={lead.code_postal} />
        <Field label="Commune" value={lead.commune} />
        <Field label="Forme juridique" value={lead.forme_juridique} />
        <Field label="Activité" value={lead.activite} />
        <Field
          label="Google"
          value={
            lead.note_google
              ? `${lead.note_google} ★ (${lead.nb_avis_google || 0} avis)`
              : "Non trouvé"
          }
        />
        <Field
          label="Rendez-vous"
          value={[lead.rdv_date, lead.rdv_heure].filter(Boolean).join(" à ")}
        />
        <Field label="Qualifié par" value={lead.qualifie_par} />
        <Field label="Dernière mise à jour" value={formatDate(lead.date_maj)} />
        <Field label="Notes" value={lead.notes} />
      </section>

      <section className="panel p-5">
        <h2 className="text-sm font-semibold uppercase tracking-wide text-muted-foreground">
          Emails envoyés
        </h2>
        <div className="mt-4 space-y-2">
          {emails.length === 0 && (
            <p className="text-sm text-muted-foreground">Aucun email envoyé à ce lead.</p>
          )}
          {emails.map((email) => (
            <div
              key={email.id}
              className="rounded-xl border border-border bg-secondary/40 px-4 py-3"
            >
              <div className="flex flex-wrap items-center justify-between gap-2">
                <p className="text-sm font-semibold">{email.sujet || "(sans sujet)"}</p>
                <div className="flex items-center gap-3 text-xs">
                  <span className="text-muted-foreground">{formatDate(email.date_envoi)}</span>
                  <span className="rounded-full border border-primary/30 bg-primary/15 px-2 py-0.5 font-semibold text-primary">
                    {email.statut_envoi || "envoyé"}
                  </span>
                </div>
              </div>
              {email.contenu && (
                <p className="mt-2 line-clamp-3 text-xs text-muted-foreground">{email.contenu}</p>
              )}
            </div>
          ))}
        </div>
      </section>

      <section className="panel p-5">
        <h2 className="text-sm font-semibold uppercase tracking-wide text-muted-foreground">
          Réponse au formulaire
        </h2>
        <div className="mt-4 space-y-3">
          {reponses.length === 0 && (
            <p className="text-sm text-muted-foreground">Ce lead n'a pas encore répondu.</p>
          )}
          {reponses.map((reponse) => {
            const meta = classificationMeta(reponse.classification);
            const entries = Object.entries(
              (reponse.reponses ?? {}) as Record<string, unknown>,
            );
            return (
              <div
                key={reponse.id}
                className="rounded-xl border border-border bg-secondary/40 px-4 py-3"
              >
                <div className="flex flex-wrap items-center justify-between gap-2">
                  <p className="text-sm font-semibold">
                    {reponse.nom_entreprise || lead.nom || "Réponse"}
                  </p>
                  <div className="flex items-center gap-3 text-xs">
                    <span className="text-muted-foreground">
                      {formatDate(reponse.date_reponse)}
                    </span>
                    <span
                      className={`rounded-full border px-2 py-0.5 font-semibold ${meta.classes}`}
                    >
                      {meta.label}
                    </span>
                  </div>
                </div>
                <dl className="mt-3 space-y-1.5">
                  {entries.map(([key, value]) => (
                    <div key={key} className="grid gap-1 text-xs sm:grid-cols-[220px_1fr]">
                      <dt className="font-medium text-muted-foreground">{key}</dt>
                      <dd className="break-words">
                        {typeof value === "object" ? JSON.stringify(value) : String(value)}
                      </dd>
                    </div>
                  ))}
                </dl>
              </div>
            );
          })}
        </div>
      </section>
    </div>
  );
}
