import { useQuery } from "@tanstack/react-query";
import { createFileRoute, Link } from "@tanstack/react-router";
import { useState } from "react";

import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { supabase } from "@/integrations/supabase/client";
import { CLASSIFICATIONS, classificationMeta, formatDate, useRealtime } from "@/lib/sirenly";

export const Route = createFileRoute("/reponses")({
  head: () => ({
    meta: [
      { title: "Réponses formulaire — Sirenly" },
      {
        name: "description",
        content:
          "Toutes les réponses au formulaire de prospection, classées chaud, tiède ou froid.",
      },
      { property: "og:title", content: "Réponses formulaire — Sirenly" },
      {
        property: "og:description",
        content: "Réponses au formulaire classées chaud, tiède ou froid.",
      },
    ],
  }),
  component: ReponsesPage,
});

function ReponsesPage() {
  useRealtime("reponses_formulaire", ["reponses"]);
  const [filtre, setFiltre] = useState("tous");

  const { data: reponses = [], isLoading } = useQuery({
    queryKey: ["reponses"],
    queryFn: async () => {
      const { data, error } = await supabase
        .from("reponses_formulaire")
        .select("*")
        .order("date_reponse", { ascending: false });
      if (error) throw error;
      return data ?? [];
    },
  });

  const visibles = reponses.filter((r) => filtre === "tous" || r.classification === filtre);

  return (
    <div className="space-y-6">
      <header className="flex flex-wrap items-end justify-between gap-4">
        <div>
          <h1 className="text-2xl font-extrabold tracking-tight sm:text-3xl">
            Réponses formulaire
          </h1>
          <p className="mt-1 text-sm text-muted-foreground">
            {visibles.length} réponse(s) · classification automatique
          </p>
        </div>
        <Select value={filtre} onValueChange={setFiltre}>
          <SelectTrigger className="w-52">
            <SelectValue />
          </SelectTrigger>
          <SelectContent>
            <SelectItem value="tous">Toutes</SelectItem>
            {CLASSIFICATIONS.map((c) => (
              <SelectItem key={c.value} value={c.value}>
                {c.label}
              </SelectItem>
            ))}
          </SelectContent>
        </Select>
      </header>

      {isLoading && <p className="text-sm text-muted-foreground">Chargement…</p>}
      {!isLoading && visibles.length === 0 && (
        <p className="panel p-6 text-sm text-muted-foreground">Aucune réponse enregistrée.</p>
      )}

      <div className="space-y-3">
        {visibles.map((reponse) => {
          const meta = classificationMeta(reponse.classification);
          const entries = Object.entries((reponse.reponses ?? {}) as Record<string, unknown>);
          return (
            <article key={reponse.id} className="panel p-5">
              <div className="flex flex-wrap items-center justify-between gap-3">
                <div>
                  <p className="text-base font-bold">
                    {reponse.nom_entreprise || "Entreprise inconnue"}
                  </p>
                  <p className="text-xs text-muted-foreground">
                    {formatDate(reponse.date_reponse)}
                  </p>
                </div>
                <div className="flex items-center gap-3">
                  <span
                    className={`rounded-full border px-2.5 py-1 text-xs font-semibold ${meta.classes}`}
                  >
                    {meta.label}
                  </span>
                  {reponse.lead_id && (
                    <Link
                      to="/leads/$id"
                      params={{ id: reponse.lead_id }}
                      className="text-xs font-semibold text-primary hover:underline"
                    >
                      Voir la fiche →
                    </Link>
                  )}
                </div>
              </div>
              {entries.length > 0 && (
                <dl className="mt-4 space-y-1.5 border-t border-border pt-3">
                  {entries.map(([key, value]) => (
                    <div key={key} className="grid gap-1 text-xs sm:grid-cols-[220px_1fr]">
                      <dt className="font-medium text-muted-foreground">{key}</dt>
                      <dd className="break-words">
                        {typeof value === "object" ? JSON.stringify(value) : String(value)}
                      </dd>
                    </div>
                  ))}
                </dl>
              )}
            </article>
          );
        })}
      </div>
    </div>
  );
}
