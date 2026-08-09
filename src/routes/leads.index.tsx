import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { createFileRoute, Link } from "@tanstack/react-router";
import { Phone, Star } from "lucide-react";
import { useState } from "react";
import { toast } from "sonner";

import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { Textarea } from "@/components/ui/textarea";
import { supabase } from "@/integrations/supabase/client";
import { STATUTS, statutClasses, statutLabel, useRealtime } from "@/lib/sirenly";

export const Route = createFileRoute("/leads/")({
  head: () => ({
    meta: [
      { title: "Qualification des leads — Sirenly" },
      {
        name: "description",
        content: "Filtrez, qualifiez et planifiez les rendez-vous de vos leads en temps réel.",
      },
      { property: "og:title", content: "Qualification des leads — Sirenly" },
      {
        property: "og:description",
        content: "Filtrez, qualifiez et planifiez les rendez-vous de vos leads.",
      },
    ],
  }),
  component: LeadsPage,
});

type Lead = {
  id: string;
  nom: string | null;
  commune: string | null;
  activite: string | null;
  telephone: string | null;
  note_google: string | null;
  nb_avis_google: string | null;
  statut: string | null;
  notes: string | null;
  rdv_date: string | null;
  rdv_heure: string | null;
};

function LeadsPage() {
  useRealtime("leads", ["leads"]);
  const queryClient = useQueryClient();
  const [filtre, setFiltre] = useState("tous");
  const [recherche, setRecherche] = useState("");

  const { data: leads = [], isLoading } = useQuery({
    queryKey: ["leads"],
    queryFn: async () => {
      const { data, error } = await supabase
        .from("leads")
        .select(
          "id, nom, commune, activite, telephone, note_google, nb_avis_google, statut, notes, rdv_date, rdv_heure",
        )
        .order("date_maj", { ascending: false })
        .limit(500);
      if (error) throw error;
      return (data ?? []) as Lead[];
    },
  });

  const update = useMutation({
    mutationFn: async ({
      id,
      patch,
    }: {
      id: string;
      patch: { statut?: string; notes?: string; rdv_date?: string; rdv_heure?: string };
    }) => {
      const { error } = await supabase
        .from("leads")
        .update({ ...patch, date_maj: new Date().toISOString() })
        .eq("id", id);
      if (error) throw error;
    },
    onSuccess: () => {
      void queryClient.invalidateQueries({ queryKey: ["leads"] });
      toast.success("Lead mis à jour");
    },
    onError: (e: Error) => toast.error("Mise à jour impossible", { description: e.message }),
  });

  const visibles = leads.filter((l) => {
    const okStatut = filtre === "tous" || (l.statut ?? "non_qualifie") === filtre;
    const q = recherche.trim().toLowerCase();
    const okRecherche =
      !q ||
      [l.nom, l.commune, l.activite].some((v) => (v ?? "").toLowerCase().includes(q));
    return okStatut && okRecherche;
  });

  return (
    <div className="space-y-6">
      <header className="flex flex-wrap items-end justify-between gap-4">
        <div>
          <h1 className="text-2xl font-extrabold tracking-tight sm:text-3xl">Qualification</h1>
          <p className="mt-1 text-sm text-muted-foreground">
            {visibles.length} lead(s) affiché(s) · synchronisation temps réel
          </p>
        </div>
        <div className="flex flex-wrap gap-2">
          <Input
            value={recherche}
            onChange={(e) => setRecherche(e.target.value)}
            placeholder="Rechercher…"
            className="w-48"
          />
          <Select value={filtre} onValueChange={setFiltre}>
            <SelectTrigger className="w-52">
              <SelectValue />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="tous">Tous les statuts</SelectItem>
              {STATUTS.map((s) => (
                <SelectItem key={s.value} value={s.value}>
                  {s.label}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
        </div>
      </header>

      {isLoading && <p className="text-sm text-muted-foreground">Chargement…</p>}
      {!isLoading && visibles.length === 0 && (
        <p className="panel p-6 text-sm text-muted-foreground">
          Aucun lead ne correspond. Lancez le radar depuis la page Génération.
        </p>
      )}

      <div className="space-y-4">
        {visibles.map((lead) => (
          <article key={lead.id} className="panel p-5">
            <div className="flex flex-wrap items-start justify-between gap-3">
              <div className="min-w-0">
                <Link
                  to="/leads/$id"
                  params={{ id: lead.id }}
                  className="text-base font-bold hover:text-primary"
                >
                  {lead.nom ?? "Sans nom"}
                </Link>
                <p className="mt-1 text-xs text-muted-foreground">
                  {[lead.commune, lead.activite].filter(Boolean).join(" · ") || "—"}
                </p>
                <div className="mt-2 flex flex-wrap items-center gap-3 text-xs text-muted-foreground">
                  {lead.telephone && (
                    <span className="inline-flex items-center gap-1">
                      <Phone className="size-3.5" /> {lead.telephone}
                    </span>
                  )}
                  {lead.note_google && (
                    <span className="inline-flex items-center gap-1 text-accent">
                      <Star className="size-3.5" /> {lead.note_google}
                      {lead.nb_avis_google ? ` (${lead.nb_avis_google})` : ""}
                    </span>
                  )}
                </div>
              </div>
              <span
                className={`rounded-full border px-2.5 py-1 text-xs font-semibold ${statutClasses(lead.statut)}`}
              >
                {statutLabel(lead.statut)}
              </span>
            </div>

            <div className="mt-4 grid gap-3 md:grid-cols-3">
              <Select
                value={lead.statut ?? "non_qualifie"}
                onValueChange={(value) => update.mutate({ id: lead.id, patch: { statut: value } })}
              >
                <SelectTrigger>
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  {STATUTS.map((s) => (
                    <SelectItem key={s.value} value={s.value}>
                      {s.label}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
              <Input
                type="date"
                defaultValue={lead.rdv_date ?? ""}
                onBlur={(e) =>
                  e.target.value !== (lead.rdv_date ?? "") &&
                  update.mutate({ id: lead.id, patch: { rdv_date: e.target.value } })
                }
              />
              <Input
                type="time"
                defaultValue={lead.rdv_heure ?? ""}
                onBlur={(e) =>
                  e.target.value !== (lead.rdv_heure ?? "") &&
                  update.mutate({ id: lead.id, patch: { rdv_heure: e.target.value } })
                }
              />
            </div>

            <div className="mt-3 grid gap-3 md:grid-cols-[1fr_auto] md:items-end">
              <Textarea
                defaultValue={lead.notes ?? ""}
                placeholder="Notes de qualification…"
                rows={2}
                onBlur={(e) =>
                  e.target.value !== (lead.notes ?? "") &&
                  update.mutate({ id: lead.id, patch: { notes: e.target.value } })
                }
              />
              <Button asChild variant="secondary">
                <Link to="/leads/$id" params={{ id: lead.id }}>
                  Voir la fiche
                </Link>
              </Button>
            </div>
          </article>
        ))}
      </div>
    </div>
  );
}
