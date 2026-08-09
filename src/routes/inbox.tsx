import { useQuery, useQueryClient } from "@tanstack/react-query";
import { createFileRoute, Link } from "@tanstack/react-router";
import { useState } from "react";
import { toast } from "sonner";

import { EmptyState, PageHeader, Pill } from "@/components/sirenly-ui";
import { supabase } from "@/integrations/supabase/client";
import {
  CLASSIFICATIONS_EMAIL,
  classificationEmailMeta,
  extrait,
  formatDate,
  useRealtime,
} from "@/lib/sirenly";

export const Route = createFileRoute("/inbox")({
  head: () => ({
    meta: [
      { title: "Boîte principale — Sirenly" },
      {
        name: "description",
        content: "Toutes les réponses email reçues, classées automatiquement par l'IA.",
      },
      { property: "og:title", content: "Boîte principale — Sirenly" },
      {
        property: "og:description",
        content: "Consultez et qualifiez les réponses de vos campagnes de prospection.",
      },
    ],
  }),
  component: InboxPage,
});

function InboxPage() {
  const qc = useQueryClient();
  useRealtime("reponses_emails", ["inbox"]);
  const [classification, setClassification] = useState("tous");
  const [campagne, setCampagne] = useState("toutes");
  const [selection, setSelection] = useState<string | null>(null);

  const { data } = useQuery({
    queryKey: ["inbox"],
    queryFn: async () => {
      const [reponses, campagnes, emails] = await Promise.all([
        supabase
          .from("reponses_emails")
          .select("*")
          .order("date_reception", { ascending: false }),
        supabase.from("campagnes").select("id, nom"),
        supabase.from("emails_envoyes").select("id, lead_id, sujet, contenu, date_envoi"),
      ]);
      return {
        reponses: reponses.data ?? [],
        campagnes: campagnes.data ?? [],
        emails: emails.data ?? [],
      };
    },
  });

  const reponses = (data?.reponses ?? []).filter(
    (r) =>
      (classification === "tous" || r.classification === classification) &&
      (campagne === "toutes" || r.campagne_id === campagne),
  );
  const active = reponses.find((r) => r.id === selection) ?? reponses[0] ?? null;
  const emailsDuLead = (data?.emails ?? []).filter((e) => active && e.lead_id === active.lead_id);
  const nomCampagne = (id: string | null) =>
    data?.campagnes.find((c) => c.id === id)?.nom ?? "—";

  async function marquerQualifie(statut: "meeting" | "info_request") {
    if (!active?.lead_id) {
      toast.error("Cette réponse n'est reliée à aucun lead.");
      return;
    }
    const { error } = await supabase
      .from("leads")
      .update({ statut, derniere_activite: new Date().toISOString() })
      .eq("id", active.lead_id);
    if (error) toast.error(error.message);
    else {
      toast.success("Lead mis à jour");
      void qc.invalidateQueries({ queryKey: ["inbox"] });
    }
  }

  async function marquerLu(id: string) {
    await supabase.from("reponses_emails").update({ lu: true }).eq("id", id);
    void qc.invalidateQueries({ queryKey: ["inbox"] });
  }

  return (
    <div className="space-y-6">
      <PageHeader
        titre="Boîte principale"
        sousTitre={`${reponses.length} réponse${reponses.length > 1 ? "s" : ""} reçue${reponses.length > 1 ? "s" : ""}`}
        actions={
          <div className="flex flex-wrap gap-2">
            <select
              value={classification}
              onChange={(e) => setClassification(e.target.value)}
              className="h-9 rounded-lg border border-border bg-card px-3 text-sm"
            >
              <option value="tous">Toutes classifications</option>
              {CLASSIFICATIONS_EMAIL.map((c) => (
                <option key={c.value} value={c.value}>
                  {c.label}
                </option>
              ))}
            </select>
            <select
              value={campagne}
              onChange={(e) => setCampagne(e.target.value)}
              className="h-9 rounded-lg border border-border bg-card px-3 text-sm"
            >
              <option value="toutes">Toutes campagnes</option>
              {(data?.campagnes ?? []).map((c) => (
                <option key={c.id} value={c.id}>
                  {c.nom}
                </option>
              ))}
            </select>
          </div>
        }
      />

      {reponses.length === 0 ? (
        <EmptyState
          titre="Aucune réponse"
          texte="Les réponses reçues via le webhook Brevo apparaîtront ici, classées par l'IA."
        />
      ) : (
        <div className="grid gap-5 lg:grid-cols-[minmax(0,360px)_minmax(0,1fr)]">
          <div className="panel divide-y divide-border overflow-hidden">
            {reponses.map((r) => {
              const meta = classificationEmailMeta(r.classification);
              const isActive = active?.id === r.id;
              return (
                <button
                  key={r.id}
                  onClick={() => {
                    setSelection(r.id);
                    if (!r.lu) void marquerLu(r.id);
                  }}
                  className={`block w-full px-4 py-3 text-left transition-colors ${isActive ? "bg-primary-soft" : "hover:bg-muted/60"}`}
                >
                  <div className="flex items-center justify-between gap-2">
                    <span className="truncate text-sm font-semibold">{r.email_expediteur}</span>
                    {!r.lu && <span className="size-2 shrink-0 rounded-full bg-primary" />}
                  </div>
                  <p className="truncate text-xs font-medium text-muted-foreground">{r.sujet}</p>
                  <p className="mt-1 text-xs text-muted-foreground">{extrait(r.contenu, 70)}</p>
                  <div className="mt-2 flex flex-wrap items-center gap-2">
                    <Pill label={meta.label} classes={meta.classes} />
                    <span className="text-[11px] text-muted-foreground">
                      {nomCampagne(r.campagne_id)} · {formatDate(r.date_reception)}
                    </span>
                  </div>
                </button>
              );
            })}
          </div>

          {active && (
            <div className="panel p-6">
              <div className="grid grid-cols-[minmax(0,1fr)_auto] items-start gap-4">
                <div className="min-w-0">
                  <h2 className="truncate font-display text-xl font-bold">{active.sujet}</h2>
                  <p className="truncate text-sm text-muted-foreground">
                    {active.email_expediteur} · {formatDate(active.date_reception)}
                  </p>
                </div>
                <Pill
                  label={classificationEmailMeta(active.classification).label}
                  classes={classificationEmailMeta(active.classification).classes}
                />
              </div>

              <div className="mt-6 space-y-4">
                {emailsDuLead.map((e) => (
                  <div key={e.id} className="rounded-xl border border-border bg-muted/40 p-4">
                    <p className="text-xs font-semibold uppercase tracking-wide text-muted-foreground">
                      Envoyé · {formatDate(e.date_envoi)}
                    </p>
                    <p className="mt-1 text-sm font-medium">{e.sujet}</p>
                    <p className="mt-2 whitespace-pre-wrap text-sm text-muted-foreground">
                      {e.contenu}
                    </p>
                  </div>
                ))}
                <div className="rounded-xl border border-primary/25 bg-primary-soft p-4">
                  <p className="text-xs font-semibold uppercase tracking-wide text-primary-strong">
                    Réponse reçue
                  </p>
                  <p className="mt-2 whitespace-pre-wrap text-sm">{active.contenu}</p>
                </div>
              </div>

              <div className="mt-6 flex flex-wrap gap-2">
                <button
                  onClick={() => void marquerQualifie("meeting")}
                  className="rounded-lg bg-primary px-4 py-2 text-sm font-semibold text-primary-foreground hover:opacity-90"
                >
                  Marquer comme qualifié (Meeting)
                </button>
                <button
                  onClick={() => void marquerQualifie("info_request")}
                  className="rounded-lg border border-input bg-card px-4 py-2 text-sm font-medium hover:bg-muted"
                >
                  Demande d'info
                </button>
                {active.lead_id && (
                  <Link
                    to="/leads/$id"
                    params={{ id: active.lead_id }}
                    className="rounded-lg border border-input bg-card px-4 py-2 text-sm font-medium hover:bg-muted"
                  >
                    Ouvrir la fiche lead
                  </Link>
                )}
              </div>
            </div>
          )}
        </div>
      )}
    </div>
  );
}
