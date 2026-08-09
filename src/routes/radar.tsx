import { useMutation } from "@tanstack/react-query";
import { createFileRoute } from "@tanstack/react-router";
import { useServerFn } from "@tanstack/react-start";
import { Radar } from "lucide-react";
import { useState } from "react";
import { toast } from "sonner";

import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { generateLeads } from "@/lib/sirenly.functions";

export const Route = createFileRoute("/radar")({
  head: () => ({
    meta: [
      { title: "Génération de leads — Sirenly" },
      {
        name: "description",
        content:
          "Lancez le radar BODACC par département et enrichissez les créations d'entreprises via Google Places.",
      },
      { property: "og:title", content: "Génération de leads — Sirenly" },
      {
        property: "og:description",
        content: "Radar BODACC par département enrichi par Google Places.",
      },
    ],
  }),
  component: RadarPage,
});

function RadarPage() {
  const [departement, setDepartement] = useState("74");
  const [jours, setJours] = useState(7);
  const run = useServerFn(generateLeads);

  const mutation = useMutation({
    mutationFn: () => run({ data: { departement, jours } }),
    onSuccess: (res) => {
      toast.success(`${res.ajoutes} nouveau(x) lead(s) ajouté(s)`, {
        description: `${res.total} annonce(s) retenue(s), ${res.misAJour} mise(s) à jour${
          res.googleActif ? "" : " · Google Places non configuré"
        }`,
      });
    },
    onError: (error: Error) => toast.error("Échec du radar", { description: error.message }),
  });

  return (
    <div className="space-y-6">
      <header>
        <p className="text-sm text-muted-foreground">
          Créations d'entreprises BODACC, filtrées puis enrichies avec Google Places.
        </p>
      </header>


      <section className="panel max-w-xl space-y-5 p-6">
        <div className="grid gap-4 sm:grid-cols-2">
          <div className="space-y-2">
            <Label htmlFor="departement">Département</Label>
            <Input
              id="departement"
              value={departement}
              onChange={(e) => setDepartement(e.target.value)}
              placeholder="74"
            />
          </div>
          <div className="space-y-2">
            <Label htmlFor="jours">Nombre de jours</Label>
            <Input
              id="jours"
              type="number"
              min={1}
              max={90}
              value={jours}
              onChange={(e) => setJours(Number(e.target.value) || 7)}
            />
          </div>
        </div>

        <Button
          className="w-full bg-brand font-semibold text-primary-foreground hover:opacity-90"
          disabled={mutation.isPending || !departement}
          onClick={() => mutation.mutate()}
        >
          <Radar className={`size-4 ${mutation.isPending ? "animate-spin" : ""}`} />
          {mutation.isPending ? "Radar en cours…" : "Lancer le radar"}
        </Button>

        {mutation.data && (
          <div className="rounded-xl border border-border bg-secondary/40 p-4 text-sm">
            <p className="font-semibold text-primary">
              {mutation.data.ajoutes} lead(s) ajouté(s)
            </p>
            <p className="mt-1 text-muted-foreground">
              {mutation.data.total} annonce(s) retenue(s) · {mutation.data.misAJour} fiche(s)
              actualisée(s) — statuts et notes existants préservés.
            </p>
          </div>
        )}

        <p className="text-xs text-muted-foreground">
          Exclusions automatiques : holding, portage, gestion de participations, SCI, coursier,
          livreur, livraison de repas, Uber Eats, à vélo.
        </p>
      </section>
    </div>
  );
}
