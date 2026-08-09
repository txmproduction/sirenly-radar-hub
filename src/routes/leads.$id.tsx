import { useQuery, useQueryClient } from "@tanstack/react-query";
import { createFileRoute, Link } from "@tanstack/react-router";
import { useEffect, useState } from "react";
import { toast } from "sonner";

import { EmptyState, PageHeader, Pill } from "@/components/sirenly-ui";
import { supabase } from "@/integrations/supabase/client";
import {
  CLASSIFICATIONS_EMAIL,
  STATUTS,
  classificationEmailMeta,
  classificationMeta,
  formatDate,
  statutMeta,
  useRealtime,
} from "@/lib/sirenly";

export const Route = createFileRoute("/leads/$id")({
  head: () => ({
    meta: [
      { title: "Fiche lead — Sirenly" },
      {
        name: "description",
        content: "Détail du lead : informations BODACC, Google Places, emails et réponses.",
      },
      { property: "og:title", content: "Fiche lead — Sirenly" },
      {
        property: "og:description",
        content: "Historique complet du prospect et qualification commerciale.",
      },
    ],
  }),
  component: LeadDetail,
});

function LeadDetail() {
  const { id } = Route.useParams();
  const qc = useQueryClient();
  useRealtime("leads", ["lead-detail"]);
  useRealtime("reponses_emails", ["lead-detail"]);

  const { data } = useQuery({
    queryKey: ["lead-detail", id],
    queryFn: async () => {
      const [lead, emails, repEmails, repForm] = await Promise.all([
        supabase.from("leads").select("*").eq("id", id).maybeSingle(),
        supabase
          .from("emails_envoyes")
          .select("*")
          .eq("lead_id", id)
          .order("date_envoi", { ascending: false }),
        supabase
          .from("reponses_emails")
          .select("*")
          .eq("lead_id", id)
          .order("date_reception", { ascending: false }),
        supabase.from("reponses_formulaire").select("*").eq("lead_id", id).maybeSingle(),
      ]);
      return {
        lead: lead.data,
        emails: emails.data ?? [],
        repEmails: repEmails.data ?? [],
        repForm: repForm.data,
      };
    },
  });

  const lead = data?.lead;
  const [notes, setNotes] = useState("");
  const [rdvDate, setRdvDate] = useState("");
  const [rdvHeure, setRdvHeure] = useState("");

  useEffect(() => {
    if (lead) {
      setNotes(lead.notes ?? "");
      setRdvDate(lead.rdv_date ?? "");
      setRdvHeure(lead.rdv_heure ?? "");
    }
  }, [lead?.id]);

  async function maj(patch: Record<string, unknown>) {
    const { error } = await supabase
      .from("leads")
      .update({ ...patch, derniere_activite: new Date().toISOString() })
      .eq("id", id);
    if (error) toast.error(error.message);
    else {
      toast.success("Lead mis à jour");
      void qc.invalidateQueries({ queryKey: ["lead-detail", id] });
    }
  }

  if (!lead) {
    return (
      <div className="space-y-6">
        <PageHeader titre="Fiche lead" />
        <EmptyState titre="Lead introuvable" />
      </div>
    );
  }

  const infos: Array<[string, string]> = [
    ["Contact", lead.contact || "—"],
    ["Téléphone", lead.telephone || "—"],
    ["Email", lead.email || "—"],
    ["Activité", lead.activite || "—"],
    ["Forme juridique", lead.forme_juridique || "—"],
    ["SIREN", lead.siren || "—"],
    ["Effectif", lead.effectif || "—"],
    ["Adresse", [lead.adresse, lead.code_postal, lead.commune].filter(Boolean).join(" ") || "—"],
    [
      "Google",
      lead.note_google ? `${lead.note_google} ★ · ${lead.nb_avis_google || 0} avis` : "Aucune fiche",
    ],
    ["Source", lead.source || "bodacc"],
    ["Mise à jour", formatDate(lead.date_maj)],
  ];

  return (
    <div className="space-y-6">
      <PageHeader
        titre={lead.nom ?? lead.id}
        sousTitre={[lead.activite, lead.commune].filter(Boolean).join(" · ")}
        actions={
          <>
            <Pill label={statutMeta(lead.statut).label} classes={statutMeta(lead.statut).classes} />
            <Link
              to="/leads"
              search={{ q: "" }}
              className="rounded-lg border border-input bg-card px-3 py-2 text-sm font-medium hover:bg-muted"
            >
              Retour
            </Link>
          </>
        }
      />

      <div className="grid gap-6 lg:grid-cols-[minmax(0,1fr)_320px]">
        <div className="space-y-6">
          <section className="panel p-6">
            <h2 className="font-display text-lg font-bold">Informations</h2>
            <dl className="mt-4 grid gap-x-6 gap-y-3 sm:grid-cols-2">
              {infos.map(([k, v]) => (
                <div key={k} className="min-w-0">
                  <dt className="th-label">{k}</dt>
                  <dd className="truncate text-sm">{v}</dd>
                </div>
              ))}
            </dl>
          </section>

          <section className="panel p-6">
            <h2 className="font-display text-lg font-bold">Emails envoyés</h2>
            <div className="mt-4 space-y-3">
              {data?.emails.length === 0 && <EmptyState titre="Aucun email envoyé" />}
              {data?.emails.map((e) => (
                <div key={e.id} className="rounded-xl border border-border p-4">
                  <div className="flex flex-wrap items-center justify-between gap-2">
                    <p className="text-sm font-medium">{e.sujet}</p>
                    <span className="text-xs text-muted-foreground">
                      {formatDate(e.date_envoi)} · {e.statut_envoi ?? "envoyé"}
                    </span>
                  </div>
                  <p className="mt-2 whitespace-pre-wrap text-sm text-muted-foreground">
                    {e.contenu}
                  </p>
                </div>
              ))}
            </div>
          </section>

          <section className="panel p-6">
            <h2 className="font-display text-lg font-bold">Réponses reçues</h2>
            <div className="mt-4 space-y-3">
              {data?.repEmails.length === 0 && <EmptyState titre="Aucune réponse email" />}
              {data?.repEmails.map((r) => {
                const meta = classificationEmailMeta(r.classification);
                return (
                  <div key={r.id} className="rounded-xl border border-primary/25 bg-primary-soft p-4">
                    <div className="flex flex-wrap items-center justify-between gap-2">
                      <p className="text-sm font-medium">{r.sujet}</p>
                      <Pill label={meta.label} classes={meta.classes} />
                    </div>
                    <p className="mt-2 whitespace-pre-wrap text-sm">{r.contenu}</p>
                    <p className="mt-2 text-xs text-muted-foreground">
                      {formatDate(r.date_reception)}
                    </p>
                  </div>
                );
              })}
            </div>
          </section>

          {data?.repForm && (
            <section className="panel p-6">
              <div className="flex flex-wrap items-center justify-between gap-2">
                <h2 className="font-display text-lg font-bold">Réponse au formulaire</h2>
                <Pill
                  label={classificationMeta(data.repForm.classification).label}
                  classes={classificationMeta(data.repForm.classification).classes}
                />
              </div>
              <div className="mt-4 space-y-2">
                {Object.entries((data.repForm.reponses ?? {}) as Record<string, unknown>).map(
                  ([k, v]) => (
                    <div key={k} className="rounded-lg border border-border px-3 py-2">
                      <p className="th-label">{k}</p>
                      <p className="text-sm">{String(v)}</p>
                    </div>
                  ),
                )}
              </div>
            </section>
          )}
        </div>

        <aside className="space-y-6">
          <section className="panel p-6">
            <h2 className="font-display text-base font-bold">Statut</h2>
            <div className="mt-3 flex flex-wrap gap-2">
              {STATUTS.map((s) => (
                <button
                  key={s.value}
                  onClick={() => void maj({ statut: s.value })}
                  className={`rounded-full border px-2.5 py-1 text-xs font-medium transition-opacity hover:opacity-80 ${
                    lead.statut === s.value ? s.classes : "border-border bg-card text-muted-foreground"
                  }`}
                >
                  {s.label}
                </button>
              ))}
            </div>
          </section>

          <section className="panel p-6">
            <h2 className="font-display text-base font-bold">Rendez-vous</h2>
            <div className="mt-3 grid grid-cols-2 gap-2">
              <input
                type="date"
                value={rdvDate}
                onChange={(e) => setRdvDate(e.target.value)}
                className="h-9 rounded-lg border border-border bg-background px-2 text-sm"
              />
              <input
                type="time"
                value={rdvHeure}
                onChange={(e) => setRdvHeure(e.target.value)}
                className="h-9 rounded-lg border border-border bg-background px-2 text-sm"
              />
            </div>
            <button
              onClick={() => void maj({ rdv_date: rdvDate, rdv_heure: rdvHeure })}
              className="mt-3 w-full rounded-lg bg-primary px-3 py-2 text-sm font-semibold text-primary-foreground hover:opacity-90"
            >
              Enregistrer le RDV
            </button>
          </section>

          <section className="panel p-6">
            <h2 className="font-display text-base font-bold">Notes</h2>
            <textarea
              value={notes}
              onChange={(e) => setNotes(e.target.value)}
              rows={6}
              className="mt-3 w-full rounded-lg border border-border bg-background p-3 text-sm outline-none focus:border-primary"
              placeholder="Notes internes…"
            />
            <button
              onClick={() => void maj({ notes })}
              className="mt-2 w-full rounded-lg border border-input bg-card px-3 py-2 text-sm font-medium hover:bg-muted"
            >
              Enregistrer les notes
            </button>
          </section>

          <section className="panel p-6">
            <h2 className="font-display text-base font-bold">Classifications IA</h2>
            <div className="mt-3 flex flex-wrap gap-2">
              {CLASSIFICATIONS_EMAIL.map((c) => (
                <Pill key={c.value} label={c.label} classes={c.classes} />
              ))}
            </div>
          </section>
        </aside>
      </div>
    </div>
  );
}
