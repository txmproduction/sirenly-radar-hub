import { useQuery } from "@tanstack/react-query";
import { createFileRoute, Link } from "@tanstack/react-router";
import { useState } from "react";

import { EmptyState, PageHeader, Pill } from "@/components/sirenly-ui";
import { supabase } from "@/integrations/supabase/client";
import { CLASSIFICATIONS, classificationMeta, formatDate, useRealtime } from "@/lib/sirenly";

export const Route = createFileRoute("/reponses")({
  head: () => ({
    meta: [
      { title: "Réponses formulaire — Sirenly" },
      {
        name: "description",
        content: "Toutes les réponses au formulaire, classées chaud, tiède ou froid.",
      },
      { property: "og:title", content: "Réponses formulaire — Sirenly" },
      {
        property: "og:description",
        content: "Priorisez vos prospects selon la température de leur réponse.",
      },
    ],
  }),
  component: ReponsesPage,
});

function ReponsesPage() {
  useRealtime("reponses_formulaire", ["reponses-formulaire"]);
  const [filtre, setFiltre] = useState("toutes");

  const { data } = useQuery({
    queryKey: ["reponses-formulaire"],
    queryFn: async () =>
      (
        await supabase
          .from("reponses_formulaire")
          .select("*")
          .order("date_reponse", { ascending: false })
      ).data ?? [],
  });

  const reponses = (data ?? []).filter(
    (r) => filtre === "toutes" || r.classification === filtre,
  );

  return (
    <div className="space-y-6">
      <PageHeader
        titre="Réponses formulaire"
        sousTitre={`${reponses.length} réponse(s)`}
        actions={
          <select
            value={filtre}
            onChange={(e) => setFiltre(e.target.value)}
            className="h-9 rounded-lg border border-border bg-card px-3 text-sm"
          >
            <option value="toutes">Toutes</option>
            {CLASSIFICATIONS.map((c) => (
              <option key={c.value} value={c.value}>
                {c.label}
              </option>
            ))}
          </select>
        }
      />

      {reponses.length === 0 ? (
        <EmptyState titre="Aucune réponse" texte="Les retours du formulaire s'afficheront ici." />
      ) : (
        <div className="grid gap-4 md:grid-cols-2">
          {reponses.map((r) => {
            const meta = classificationMeta(r.classification);
            return (
              <article key={r.id} className="panel p-5">
                <div className="grid grid-cols-[minmax(0,1fr)_auto] items-start gap-3">
                  <div className="min-w-0">
                    <h2 className="truncate font-display text-base font-bold">
                      {r.nom_entreprise ?? "Entreprise inconnue"}
                    </h2>
                    <p className="text-xs text-muted-foreground">{formatDate(r.date_reponse)}</p>
                  </div>
                  <Pill label={meta.label} classes={meta.classes} />
                </div>

                <div className="mt-4 space-y-2">
                  {Object.entries((r.reponses ?? {}) as Record<string, unknown>).map(([k, v]) => (
                    <div key={k} className="rounded-lg border border-border px-3 py-2">
                      <p className="th-label">{k}</p>
                      <p className="text-sm">{String(v)}</p>
                    </div>
                  ))}
                </div>

                {r.lead_id && (
                  <Link
                    to="/leads/$id"
                    params={{ id: r.lead_id }}
                    className="mt-4 inline-flex rounded-lg border border-input bg-card px-3 py-1.5 text-sm font-medium hover:bg-muted"
                  >
                    Voir la fiche lead
                  </Link>
                )}
              </article>
            );
          })}
        </div>
      )}
    </div>
  );
}
