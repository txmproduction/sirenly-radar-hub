import { useQuery, useQueryClient } from "@tanstack/react-query";
import { createFileRoute } from "@tanstack/react-router";
import { useServerFn } from "@tanstack/react-start";
import { useState } from "react";
import { toast } from "sonner";

import { PageHeader } from "@/components/sirenly-ui";
import { supabase } from "@/integrations/supabase/client";
import { SECTEURS, TRANCHES_EFFECTIF, secteurLabel } from "@/lib/secteurs";
import { generateLeads, reparerEmailsInvalides } from "@/lib/sirenly.functions";
import { formatDate } from "@/lib/sirenly";

export const Route = createFileRoute("/radar")({
  head: () => ({
    meta: [
      { title: "Génération de leads — Sirenly" },
      {
        name: "description",
        content:
          "Radar de prospection : nouvelles entreprises (BODACC) ou entreprises établies, par secteur et effectif.",
      },
      { property: "og:title", content: "Génération de leads — Sirenly" },
      {
        property: "og:description",
        content: "Ciblez vos prospects par département, secteur d'activité et taille d'entreprise.",
      },
    ],
  }),
  component: RadarPage,
});

function RadarPage() {
  const qc = useQueryClient();
  const lancer = useServerFn(generateLeads);
  const lot = useServerFn(enrichirLot);
  const reparer = useServerFn(reparerEmailsInvalides);
  const [reparation, setReparation] = useState(false);
  const [progression, setProgression] = useState<{ faits: number; total: number } | null>(null);


  async function lancerReparation() {
    setReparation(true);
    try {
      const res = await reparer({});
      toast.success(
        `${res.suspects} email(s) invalide(s) · ${res.corriges} corrigé(s) · ${res.reenrichis} nouvel(le)s adresse(s)`,
      );
      void qc.invalidateQueries({ queryKey: ["leads-liste"] });
    } catch (e) {
      toast.error(e instanceof Error ? e.message : "Erreur de réparation");
    } finally {
      setReparation(false);
    }
  }


  const [source, setSource] = useState<"bodacc" | "etablies">("bodacc");
  const [departement, setDepartement] = useState("74");
  const [jours, setJours] = useState(7);
  const [secteurs, setSecteurs] = useState<string[]>([]);
  const [autreSecteur, setAutreSecteur] = useState("");
  const [effectifs, setEffectifs] = useState<string[]>([]);
  const [chargement, setChargement] = useState(false);
  const [resultat, setResultat] = useState<string | null>(null);
  const [nomProfil, setNomProfil] = useState("");

  const { data: profils } = useQuery({
    queryKey: ["profils"],
    queryFn: async () =>
      (await supabase.from("profils_ciblage").select("*").order("date_creation", { ascending: false }))
        .data ?? [],
  });

  function toggle(list: string[], set: (v: string[]) => void, value: string) {
    set(list.includes(value) ? list.filter((x) => x !== value) : [...list, value]);
  }

  async function lancerRadar() {
    setChargement(true);
    setResultat(null);
    setProgression(null);
    try {
      const res = await lancer({
        data: { source, departement, jours, secteurs, autreSecteur, effectifs },
      });
      setResultat(
        `${res.total} entreprise(s) analysée(s) · ${res.ajoutes} ajoutée(s) · ${res.misAJour} mise(s) à jour${res.googleActif ? "" : " · enrichissement Google inactif"}`,
      );
      toast.success(`${res.ajoutes} nouveau(x) lead(s) — enrichissement en cours`);
      void qc.invalidateQueries({ queryKey: ["leads-liste"] });
      setChargement(false);
      await enrichirEnArrierePlan(res.aEnrichir);
    } catch (e) {
      toast.error(e instanceof Error ? e.message : "Erreur du radar");
      setChargement(false);
    }
  }

  /** Enrichissement par lots successifs (évite tout timeout sur gros volumes). */
  async function enrichirEnArrierePlan(total: number) {
    if (!total) return;
    let restants = total;
    setProgression({ faits: 0, total });
    while (restants > 0) {
      try {
        const r = await lot({ data: { taille: 8 } });
        restants = r.restants;
        setProgression({ faits: Math.max(0, total - restants), total });
        void qc.invalidateQueries({ queryKey: ["leads-liste"] });
        if (r.traites === 0) break;
      } catch {
        break;
      }
    }
    setProgression(null);
    toast.success("Enrichissement terminé");
    void qc.invalidateQueries({ queryKey: ["leads-liste"] });
  }


  async function enregistrerProfil() {
    if (!nomProfil.trim()) {
      toast.error("Donnez un nom au profil.");
      return;
    }
    const { error } = await supabase.from("profils_ciblage").insert({
      nom: nomProfil,
      source,
      secteurs,
      departement,
      effectif_min: effectifs[0] ?? null,
      effectif_max: effectifs[effectifs.length - 1] ?? null,
    });
    if (error) toast.error(error.message);
    else {
      toast.success("Ciblage enregistré");
      setNomProfil("");
      void qc.invalidateQueries({ queryKey: ["profils"] });
    }
  }

  function chargerProfil(p: Record<string, unknown>) {
    setSource((p["source"] as "bodacc" | "etablies") ?? "bodacc");
    setDepartement(String(p["departement"] ?? "74"));
    setSecteurs(Array.isArray(p["secteurs"]) ? (p["secteurs"] as string[]) : []);
    const min = p["effectif_min"] as string | null;
    const max = p["effectif_max"] as string | null;
    setEffectifs([min, max].filter(Boolean) as string[]);
    toast.success("Profil chargé");
  }

  return (
    <div className="space-y-6">
      <PageHeader
        titre="Génération de leads"
        sousTitre="Ciblez par source, secteur, département et effectif"
      />

      <div className="panel flex flex-wrap gap-2 p-2">
        {(
          [
            ["bodacc", "Nouvelles entreprises (BODACC)"],
            ["etablies", "Entreprises établies"],
          ] as const
        ).map(([id, label]) => (
          <button
            key={id}
            onClick={() => setSource(id)}
            className={`rounded-lg px-4 py-2 text-sm font-medium transition-colors ${
              source === id ? "bg-primary-soft text-primary-strong" : "text-muted-foreground hover:bg-muted"
            }`}
          >
            {label}
          </button>
        ))}
      </div>

      <div className="panel flex flex-wrap items-center justify-between gap-3 p-4">
        <div>
          <p className="text-sm font-medium">Nettoyer les emails invalides</p>
          <p className="text-sm text-muted-foreground">
            Détecte les faux positifs (moteurs de recherche, adresses techniques) et relance la
            cascade d'enrichissement sur ces leads.
          </p>
        </div>
        <button
          onClick={lancerReparation}
          disabled={reparation}
          className="rounded-lg border border-border px-4 py-2 text-sm font-medium hover:bg-muted disabled:opacity-60"
        >
          {reparation ? "Réparation…" : "Réparer les emails"}
        </button>
      </div>



      <div className="grid gap-6 lg:grid-cols-[minmax(0,1fr)_320px]">
        <section className="panel space-y-6 p-6">
          <div className="grid gap-4 sm:grid-cols-2">
            <label className="block">
              <span className="th-label">Département</span>
              <input
                value={departement}
                onChange={(e) => setDepartement(e.target.value)}
                placeholder="74"
                className="mt-1 h-10 w-full rounded-lg border border-border bg-background px-3 text-sm outline-none focus:border-primary"
              />
            </label>
            {source === "bodacc" ? (
              <label className="block">
                <span className="th-label">Période (jours)</span>
                <input
                  type="number"
                  min={1}
                  max={90}
                  value={jours}
                  onChange={(e) => setJours(Number(e.target.value))}
                  className="mt-1 h-10 w-full rounded-lg border border-border bg-background px-3 text-sm outline-none focus:border-primary"
                />
              </label>
            ) : (
              <div>
                <span className="th-label">Tranches d'effectif salarié</span>
                <div className="mt-1 flex flex-wrap gap-1.5">
                  {TRANCHES_EFFECTIF.map((t) => (
                    <button
                      key={t.value}
                      onClick={() => toggle(effectifs, setEffectifs, t.value)}
                      className={`rounded-full border px-3 py-1 text-xs font-medium ${
                        effectifs.includes(t.value)
                          ? "border-primary bg-primary-soft text-primary-strong"
                          : "border-border bg-card text-muted-foreground hover:bg-muted"
                      }`}
                    >
                      {t.label}
                    </button>
                  ))}
                </div>
              </div>
            )}
          </div>

          <div>
            <span className="th-label">Secteurs ciblés</span>
            <div className="mt-2 grid gap-2 sm:grid-cols-2 xl:grid-cols-3">
              {SECTEURS.map((s) => (
                <label
                  key={s.id}
                  className={`flex cursor-pointer items-center gap-2 rounded-xl border px-3 py-2 text-sm transition-colors ${
                    secteurs.includes(s.id)
                      ? "border-primary bg-primary-soft text-primary-strong"
                      : "border-border hover:bg-muted"
                  }`}
                >
                  <input
                    type="checkbox"
                    checked={secteurs.includes(s.id)}
                    onChange={() => toggle(secteurs, setSecteurs, s.id)}
                    className="accent-[var(--primary)]"
                  />
                  <span className="truncate">{s.label}</span>
                </label>
              ))}
            </div>
            <input
              value={autreSecteur}
              onChange={(e) => setAutreSecteur(e.target.value)}
              placeholder="Autre secteur (texte libre)…"
              className="mt-3 h-10 w-full rounded-lg border border-border bg-background px-3 text-sm outline-none focus:border-primary"
            />
          </div>

          <div className="flex flex-wrap items-center gap-3">
            <button
              onClick={() => void lancerRadar()}
              disabled={chargement}
              className="rounded-lg bg-primary px-5 py-2.5 text-sm font-semibold text-primary-foreground hover:opacity-90 disabled:opacity-60"
            >
              {chargement ? "Radar en cours…" : "Lancer le radar"}
            </button>
            {resultat && <p className="text-sm text-muted-foreground">{resultat}</p>}
          </div>
        </section>

        <aside className="space-y-6">
          <section className="panel p-6">
            <h2 className="font-display text-base font-bold">Enregistrer ce ciblage</h2>
            <input
              value={nomProfil}
              onChange={(e) => setNomProfil(e.target.value)}
              placeholder="Cible nettoyage — BTP 74"
              className="mt-3 h-10 w-full rounded-lg border border-border bg-background px-3 text-sm outline-none focus:border-primary"
            />
            <button
              onClick={() => void enregistrerProfil()}
              className="mt-2 w-full rounded-lg border border-input bg-card px-3 py-2 text-sm font-medium hover:bg-muted"
            >
              Enregistrer
            </button>
          </section>

          <section className="panel p-6">
            <h2 className="font-display text-base font-bold">Profils sauvegardés</h2>
            <div className="mt-3 space-y-2">
              {(profils ?? []).length === 0 && (
                <p className="text-sm text-muted-foreground">Aucun profil enregistré.</p>
              )}
              {(profils ?? []).map((p) => (
                <button
                  key={p.id}
                  onClick={() => chargerProfil(p as Record<string, unknown>)}
                  className="block w-full rounded-xl border border-border p-3 text-left hover:bg-muted/60"
                >
                  <p className="truncate text-sm font-medium">{p.nom}</p>
                  <p className="truncate text-xs text-muted-foreground">
                    {p.source === "etablies" ? "Établies" : "BODACC"} · {p.departement} ·{" "}
                    {(Array.isArray(p.secteurs) ? (p.secteurs as string[]) : [])
                      .map(secteurLabel)
                      .join(", ") || "tous secteurs"}
                  </p>
                  <p className="text-[11px] text-muted-foreground">{formatDate(p.date_creation)}</p>
                </button>
              ))}
            </div>
          </section>
        </aside>
      </div>
    </div>
  );
}
