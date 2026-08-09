import { useQuery, useQueryClient } from "@tanstack/react-query";
import { createFileRoute, Link } from "@tanstack/react-router";
import { useState } from "react";
import { toast } from "sonner";

import { PageHeader } from "@/components/sirenly-ui";
import { supabase } from "@/integrations/supabase/client";
import { PIPELINE, colonnePipeline, formatDate, useRealtime } from "@/lib/sirenly";

export const Route = createFileRoute("/pipeline")({
  head: () => ({
    meta: [
      { title: "Pipeline — Sirenly" },
      {
        name: "description",
        content: "Vue kanban CRM : déplacez vos leads du premier contact jusqu'au client.",
      },
      { property: "og:title", content: "Pipeline — Sirenly" },
      {
        property: "og:description",
        content: "Suivez l'avancement commercial de chaque prospect en un coup d'œil.",
      },
    ],
  }),
  component: PipelinePage,
});

function PipelinePage() {
  const qc = useQueryClient();
  useRealtime("leads", ["pipeline"]);
  const [drag, setDrag] = useState<string | null>(null);

  const { data } = useQuery({
    queryKey: ["pipeline"],
    queryFn: async () => {
      const [leads, campagnes] = await Promise.all([
        supabase.from("leads").select("*").order("date_maj", { ascending: false }),
        supabase.from("campagnes").select("id, nom"),
      ]);
      return { leads: leads.data ?? [], campagnes: campagnes.data ?? [] };
    },
  });

  async function deposer(colonne: string) {
    if (!drag) return;
    const { error } = await supabase
      .from("leads")
      .update({ statut: colonne, derniere_activite: new Date().toISOString() })
      .eq("id", drag);
    setDrag(null);
    if (error) toast.error(error.message);
    else {
      toast.success("Statut mis à jour");
      void qc.invalidateQueries({ queryKey: ["pipeline"] });
    }
  }

  const nomCampagne = (id: string | null) =>
    data?.campagnes.find((c) => c.id === id)?.nom ?? null;

  return (
    <div className="space-y-6">
      <PageHeader
        titre="Pipeline"
        sousTitre="Glissez une carte pour changer le statut du lead"
      />

      <div className="-mx-4 overflow-x-auto px-4 pb-4 sm:mx-0 sm:px-0">
        <div className="flex min-w-max gap-4">
          {PIPELINE.map((col) => {
            const leads = (data?.leads ?? []).filter((l) => colonnePipeline(l.statut) === col.id);
            return (
              <div
                key={col.id}
                onDragOver={(e) => e.preventDefault()}
                onDrop={() => void deposer(col.id)}
                className="flex w-[260px] flex-col rounded-2xl border border-border bg-muted/40 p-3"
              >
                <div className="flex items-center justify-between px-1 pb-3">
                  <p className="th-label">{col.label}</p>
                  <span className="rounded-full bg-card px-2 py-0.5 text-xs font-semibold">
                    {leads.length}
                  </span>
                </div>
                <div className="space-y-2">
                  {leads.map((l) => (
                    <div
                      key={l.id}
                      draggable
                      onDragStart={() => setDrag(l.id)}
                      className="cursor-grab rounded-xl border border-border bg-card p-3 shadow-sm active:cursor-grabbing"
                    >
                      <Link
                        to="/leads/$id"
                        params={{ id: l.id }}
                        className="line-clamp-2 text-sm font-semibold hover:text-primary"
                      >
                        {l.nom ?? l.id}
                      </Link>
                      <p className="mt-1 line-clamp-1 text-xs text-muted-foreground">
                        {l.activite || "—"}
                      </p>
                      <p className="text-xs text-muted-foreground">{l.commune || "—"}</p>
                      {nomCampagne(l.campagne_id) && (
                        <span className="mt-2 inline-flex rounded-full bg-primary-soft px-2 py-0.5 text-[11px] font-medium text-primary-strong">
                          {nomCampagne(l.campagne_id)}
                        </span>
                      )}
                      <p className="mt-2 text-[11px] text-muted-foreground">
                        {formatDate(l.derniere_activite ?? l.date_maj)}
                      </p>
                    </div>
                  ))}
                  {leads.length === 0 && (
                    <p className="rounded-xl border border-dashed border-border px-3 py-6 text-center text-xs text-muted-foreground">
                      Vide
                    </p>
                  )}
                </div>
              </div>
            );
          })}
        </div>
      </div>
    </div>
  );
}
