import { useQuery } from "@tanstack/react-query";
import { createFileRoute, Link } from "@tanstack/react-router";
import { useState } from "react";

import { EmptyState, PageHeader, Pill } from "@/components/sirenly-ui";
import { supabase } from "@/integrations/supabase/client";
import { STATUTS, formatDate, statutMeta, useRealtime } from "@/lib/sirenly";

type Search = { q?: string };

export const Route = createFileRoute("/leads/")({
  validateSearch: (search: Record<string, unknown>): Search => ({
    q: typeof search["q"] === "string" ? search["q"] : undefined,
  }),
  head: () => ({
    meta: [
      { title: "Tous les leads — Sirenly" },
      {
        name: "description",
        content: "Liste complète des leads : filtres par statut, campagne, commune et fiche Google.",
      },
      { property: "og:title", content: "Tous les leads — Sirenly" },
      {
        property: "og:description",
        content: "Qualifiez et suivez tous vos prospects B2B au même endroit.",
      },
    ],
  }),
  component: LeadsPage,
});

function LeadsPage() {
  const { q: qInit } = Route.useSearch();
  useRealtime("leads", ["leads-liste"]);
  const [q, setQ] = useState(qInit ?? "");
  const [statut, setStatut] = useState("tous");
  const [campagne, setCampagne] = useState("toutes");
  const [google, setGoogle] = useState("tous");
  const [commune, setCommune] = useState("toutes");

  const { data } = useQuery({
    queryKey: ["leads-liste"],
    queryFn: async () => {
      const [leads, campagnes] = await Promise.all([
        supabase.from("leads").select("*").order("date_maj", { ascending: false }),
        supabase.from("campagnes").select("id, nom"),
      ]);
      return { leads: leads.data ?? [], campagnes: campagnes.data ?? [] };
    },
  });

  const communes = Array.from(
    new Set((data?.leads ?? []).map((l) => l.commune).filter(Boolean) as string[]),
  ).sort();

  const leads = (data?.leads ?? []).filter((l) => {
    const okQ = !q || (l.nom ?? "").toLowerCase().includes(q.toLowerCase());
    const okStatut = statut === "tous" || (l.statut ?? "") === statut;
    const okCamp = campagne === "toutes" || l.campagne_id === campagne;
    const okGoogle =
      google === "tous" || (google === "oui" ? Boolean(l.note_google) : !l.note_google);
    const okCommune = commune === "toutes" || l.commune === commune;
    return okQ && okStatut && okCamp && okGoogle && okCommune;
  });

  const nomCampagne = (id: string | null) =>
    data?.campagnes.find((c) => c.id === id)?.nom ?? "—";

  return (
    <div className="space-y-6">
      <PageHeader titre="Tous les leads" sousTitre={`${leads.length} lead(s) affiché(s)`} />

      <div className="panel flex flex-wrap gap-2 p-4">
        <input
          value={q}
          onChange={(e) => setQ(e.target.value)}
          placeholder="Rechercher par nom…"
          className="h-9 min-w-[180px] flex-1 rounded-lg border border-border bg-background px-3 text-sm outline-none focus:border-primary"
        />
        <select
          value={statut}
          onChange={(e) => setStatut(e.target.value)}
          className="h-9 rounded-lg border border-border bg-card px-3 text-sm"
        >
          <option value="tous">Tous les statuts</option>
          {STATUTS.map((s) => (
            <option key={s.value} value={s.value}>
              {s.label}
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
        <select
          value={google}
          onChange={(e) => setGoogle(e.target.value)}
          className="h-9 rounded-lg border border-border bg-card px-3 text-sm"
        >
          <option value="tous">Fiche Google : tous</option>
          <option value="oui">Avec fiche Google</option>
          <option value="non">Sans fiche Google</option>
        </select>
        <select
          value={commune}
          onChange={(e) => setCommune(e.target.value)}
          className="h-9 rounded-lg border border-border bg-card px-3 text-sm"
        >
          <option value="toutes">Toutes communes</option>
          {communes.map((c) => (
            <option key={c} value={c}>
              {c}
            </option>
          ))}
        </select>
      </div>

      {leads.length === 0 ? (
        <EmptyState
          titre="Aucun lead"
          texte="Lancez le radar depuis la page Génération pour alimenter votre base."
        />
      ) : (
        <div className="panel overflow-x-auto">
          <table className="w-full min-w-[900px] text-sm">
            <thead>
              <tr className="border-b border-border">
                {[
                  "Nom",
                  "Contact",
                  "Activité",
                  "Commune",
                  "Téléphone",
                  "Note Google",
                  "Statut",
                  "Campagne",
                  "Dernière activité",
                ].map((h) => (
                  <th key={h} className="th-label px-4 py-3 text-left">
                    {h}
                  </th>
                ))}
              </tr>
            </thead>
            <tbody>
              {leads.map((l) => {
                const meta = statutMeta(l.statut);
                return (
                  <tr key={l.id} className="border-b border-border last:border-0 hover:bg-muted/50">
                    <td className="px-4 py-3">
                      <Link
                        to="/leads/$id"
                        params={{ id: l.id }}
                        className="font-medium hover:text-primary"
                      >
                        {l.nom ?? l.id}
                      </Link>
                    </td>
                    <td className="px-4 py-3 text-muted-foreground">{l.contact || "—"}</td>
                    <td className="max-w-[220px] truncate px-4 py-3 text-muted-foreground">
                      {l.activite || "—"}
                    </td>
                    <td className="px-4 py-3 text-muted-foreground">{l.commune || "—"}</td>
                    <td className="px-4 py-3 text-muted-foreground">{l.telephone || "—"}</td>
                    <td className="px-4 py-3 text-muted-foreground">
                      {l.note_google ? `${l.note_google} (${l.nb_avis_google || 0})` : "—"}
                    </td>
                    <td className="px-4 py-3">
                      <Pill label={meta.label} classes={meta.classes} />
                    </td>
                    <td className="px-4 py-3 text-muted-foreground">
                      {nomCampagne(l.campagne_id)}
                    </td>
                    <td className="px-4 py-3 text-muted-foreground">
                      {formatDate(l.derniere_activite ?? l.date_maj)}
                    </td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        </div>
      )}
    </div>
  );
}
