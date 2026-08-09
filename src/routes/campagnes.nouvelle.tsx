import { useQuery, useQueryClient } from "@tanstack/react-query";
import { createFileRoute, useNavigate } from "@tanstack/react-router";
import { useServerFn } from "@tanstack/react-start";
import { useState } from "react";
import { toast } from "sonner";

import { PageHeader } from "@/components/sirenly-ui";
import { supabase } from "@/integrations/supabase/client";
import { apercuIA } from "@/lib/sirenly.functions";
import { STATUTS } from "@/lib/sirenly";

export const Route = createFileRoute("/campagnes/nouvelle")({
  head: () => ({
    meta: [
      { title: "Nouvelle campagne — Sirenly" },
      {
        name: "description",
        content: "Assistant en 3 étapes : sélection de la cible, message et lancement.",
      },
      { property: "og:title", content: "Nouvelle campagne — Sirenly" },
      {
        property: "og:description",
        content: "Créez une campagne email personnalisée par IA en quelques minutes.",
      },
    ],
  }),
  component: NouvelleCampagne,
});

const ETAPES = ["Cible", "Message", "Lancement"];

function NouvelleCampagne() {
  const navigate = useNavigate();
  const qc = useQueryClient();
  const genererApercu = useServerFn(apercuIA);

  const [etape, setEtape] = useState(0);
  const [nom, setNom] = useState("");
  const [statut, setStatut] = useState("tous");
  const [activite, setActivite] = useState("");
  const [commune, setCommune] = useState("toutes");
  const [google, setGoogle] = useState("tous");
  const [mode, setMode] = useState<"template" | "ia">("template");
  const [sujet, setSujet] = useState("");
  const [corps, setCorps] = useState("");
  const [brief, setBrief] = useState("");
  const [apercus, setApercus] = useState<Array<{ nom: string; sujet: string; corps: string }>>([]);
  const [chargement, setChargement] = useState(false);
  const [profil, setProfil] = useState("");

  const { data } = useQuery({
    queryKey: ["campagne-cible"],
    queryFn: async () => {
      const [leads, profils] = await Promise.all([
        supabase.from("leads").select("*"),
        supabase.from("profils_ciblage").select("*").order("date_creation", { ascending: false }),
      ]);
      return { leads: leads.data ?? [], profils: profils.data ?? [] };
    },
  });

  const communes = Array.from(
    new Set((data?.leads ?? []).map((l) => l.commune).filter(Boolean) as string[]),
  ).sort();

  const cibles = (data?.leads ?? []).filter((l) => {
    const okStatut = statut === "tous" || (l.statut ?? "") === statut;
    const okAct =
      !activite || (l.activite ?? "").toLowerCase().includes(activite.toLowerCase());
    const okCommune = commune === "toutes" || l.commune === commune;
    const okGoogle =
      google === "tous" || (google === "oui" ? Boolean(l.note_google) : !l.note_google);
    return okStatut && okAct && okCommune && okGoogle;
  });

  async function lancerApercu() {
    if (!brief.trim()) {
      toast.error("Écrivez d'abord un brief.");
      return;
    }
    setChargement(true);
    try {
      const res = await genererApercu({
        data: { brief, leadIds: cibles.slice(0, 3).map((l) => l.id) },
      });
      setApercus(res);
    } catch (e) {
      toast.error(e instanceof Error ? e.message : "Erreur lors de la génération");
    } finally {
      setChargement(false);
    }
  }

  async function creer(lancer: boolean) {
    if (!nom.trim()) {
      toast.error("Donnez un nom à la campagne.");
      return;
    }
    setChargement(true);
    const { data: created, error } = await supabase
      .from("campagnes")
      .insert({
        nom,
        statut: lancer ? "en_cours" : "brouillon",
        mode,
        sujet,
        corps,
        brief_ia: brief,
        lead_ids: cibles.map((l) => l.id),
        profil_ciblage_id: profil || null,
      })
      .select("id")
      .maybeSingle();
    setChargement(false);

    if (error || !created) {
      toast.error(error?.message ?? "Création impossible");
      return;
    }
    void qc.invalidateQueries({ queryKey: ["campagnes"] });
    toast.success(lancer ? "Campagne créée et prête à l'envoi" : "Brouillon enregistré");
    void navigate({ to: "/campagnes/$id", params: { id: created.id } });
  }

  return (
    <div className="space-y-6">
      <PageHeader titre="Nouvelle campagne" sousTitre="Cible, message et lancement en 3 étapes" />

      <div className="panel flex flex-wrap gap-2 p-3">
        {ETAPES.map((e, i) => (
          <button
            key={e}
            onClick={() => setEtape(i)}
            className={`rounded-lg px-4 py-2 text-sm font-medium transition-colors ${
              etape === i ? "bg-primary-soft text-primary-strong" : "text-muted-foreground hover:bg-muted"
            }`}
          >
            {i + 1}. {e}
          </button>
        ))}
      </div>

      {etape === 0 && (
        <section className="panel space-y-4 p-6">
          <div className="grid gap-4 sm:grid-cols-2">
            <label className="block">
              <span className="th-label">Nom de la campagne</span>
              <input
                value={nom}
                onChange={(e) => setNom(e.target.value)}
                placeholder="Prospection nettoyage 74"
                className="mt-1 h-10 w-full rounded-lg border border-border bg-background px-3 text-sm outline-none focus:border-primary"
              />
            </label>
            <label className="block">
              <span className="th-label">Profil de ciblage sauvegardé</span>
              <select
                value={profil}
                onChange={(e) => setProfil(e.target.value)}
                className="mt-1 h-10 w-full rounded-lg border border-border bg-card px-3 text-sm"
              >
                <option value="">Aucun</option>
                {(data?.profils ?? []).map((p) => (
                  <option key={p.id} value={p.id}>
                    {p.nom}
                  </option>
                ))}
              </select>
            </label>
          </div>

          <div className="grid gap-3 sm:grid-cols-2 xl:grid-cols-4">
            <select
              value={statut}
              onChange={(e) => setStatut(e.target.value)}
              className="h-10 rounded-lg border border-border bg-card px-3 text-sm"
            >
              <option value="tous">Tous les statuts</option>
              {STATUTS.map((s) => (
                <option key={s.value} value={s.value}>
                  {s.label}
                </option>
              ))}
            </select>
            <input
              value={activite}
              onChange={(e) => setActivite(e.target.value)}
              placeholder="Activité contient…"
              className="h-10 rounded-lg border border-border bg-background px-3 text-sm outline-none focus:border-primary"
            />
            <select
              value={commune}
              onChange={(e) => setCommune(e.target.value)}
              className="h-10 rounded-lg border border-border bg-card px-3 text-sm"
            >
              <option value="toutes">Toutes communes</option>
              {communes.map((c) => (
                <option key={c} value={c}>
                  {c}
                </option>
              ))}
            </select>
            <select
              value={google}
              onChange={(e) => setGoogle(e.target.value)}
              className="h-10 rounded-lg border border-border bg-card px-3 text-sm"
            >
              <option value="tous">Fiche Google : tous</option>
              <option value="oui">Avec fiche</option>
              <option value="non">Sans fiche</option>
            </select>
          </div>

          <div className="flex flex-wrap items-center justify-between gap-3 rounded-xl bg-primary-soft px-4 py-3">
            <p className="text-sm font-semibold text-primary-strong">
              {cibles.length} lead(s) sélectionné(s)
            </p>
            <button
              onClick={() => void navigate({ to: "/radar" })}
              className="rounded-lg border border-input bg-card px-3 py-1.5 text-sm font-medium hover:bg-muted"
            >
              Générer de nouveaux leads
            </button>
          </div>

          <div className="flex justify-end">
            <button
              onClick={() => setEtape(1)}
              className="rounded-lg bg-primary px-4 py-2 text-sm font-semibold text-primary-foreground hover:opacity-90"
            >
              Continuer
            </button>
          </div>
        </section>
      )}

      {etape === 1 && (
        <section className="panel space-y-5 p-6">
          <div className="flex flex-wrap gap-2">
            <button
              onClick={() => setMode("template")}
              className={`rounded-lg px-4 py-2 text-sm font-medium ${mode === "template" ? "bg-primary-soft text-primary-strong" : "border border-border"}`}
            >
              Template classique
            </button>
            <button
              onClick={() => setMode("ia")}
              className={`rounded-lg px-4 py-2 text-sm font-medium ${mode === "ia" ? "bg-primary-soft text-primary-strong" : "border border-border"}`}
            >
              Personnalisation IA
            </button>
          </div>

          {mode === "template" ? (
            <div className="space-y-3">
              <input
                value={sujet}
                onChange={(e) => setSujet(e.target.value)}
                placeholder="Sujet — variables : {{nom}}, {{contact}}, {{activite}}, {{commune}}"
                className="h-10 w-full rounded-lg border border-border bg-background px-3 text-sm outline-none focus:border-primary"
              />
              <textarea
                value={corps}
                onChange={(e) => setCorps(e.target.value)}
                rows={10}
                placeholder={"Bonjour {{contact}},\n\nJ'ai vu que {{nom}} ({{activite}}) est basé à {{commune}}…"}
                className="w-full rounded-lg border border-border bg-background p-3 text-sm outline-none focus:border-primary"
              />
            </div>
          ) : (
            <div className="space-y-3">
              <textarea
                value={brief}
                onChange={(e) => setBrief(e.target.value)}
                rows={6}
                placeholder="Brief : ton, offre, objectif. Ex : ton direct et local, offre de création de site vitrine + fiche Google, objectif décrocher un échange de 15 min."
                className="w-full rounded-lg border border-border bg-background p-3 text-sm outline-none focus:border-primary"
              />
              <button
                onClick={() => void lancerApercu()}
                disabled={chargement}
                className="rounded-lg border border-input bg-card px-4 py-2 text-sm font-medium hover:bg-muted disabled:opacity-60"
              >
                {chargement ? "Génération…" : "Aperçu sur 3 leads"}
              </button>
              <div className="space-y-3">
                {apercus.map((a, i) => (
                  <div key={i} className="rounded-xl border border-border p-4">
                    <p className="th-label">{a.nom}</p>
                    <p className="mt-1 text-sm font-semibold">{a.sujet}</p>
                    <p className="mt-2 whitespace-pre-wrap text-sm text-muted-foreground">
                      {a.corps}
                    </p>
                  </div>
                ))}
              </div>
            </div>
          )}

          <div className="flex justify-between">
            <button
              onClick={() => setEtape(0)}
              className="rounded-lg border border-input bg-card px-4 py-2 text-sm font-medium hover:bg-muted"
            >
              Retour
            </button>
            <button
              onClick={() => setEtape(2)}
              className="rounded-lg bg-primary px-4 py-2 text-sm font-semibold text-primary-foreground hover:opacity-90"
            >
              Continuer
            </button>
          </div>
        </section>
      )}

      {etape === 2 && (
        <section className="panel space-y-5 p-6">
          <div className="grid gap-3 sm:grid-cols-2">
            <Recap label="Nom" valeur={nom || "—"} />
            <Recap label="Leads ciblés" valeur={String(cibles.length)} />
            <Recap label="Mode" valeur={mode === "ia" ? "Personnalisation IA" : "Template"} />
            <Recap label="Limite quotidienne" valeur="300 emails/jour (surplus programmé)" />
          </div>
          <p className="text-sm text-muted-foreground">
            Les leads sans adresse email sont placés en file d'attente en attendant leur
            enrichissement.
          </p>
          <div className="flex flex-wrap justify-between gap-2">
            <button
              onClick={() => setEtape(1)}
              className="rounded-lg border border-input bg-card px-4 py-2 text-sm font-medium hover:bg-muted"
            >
              Retour
            </button>
            <div className="flex gap-2">
              <button
                onClick={() => void creer(false)}
                disabled={chargement}
                className="rounded-lg border border-input bg-card px-4 py-2 text-sm font-medium hover:bg-muted disabled:opacity-60"
              >
                Enregistrer en brouillon
              </button>
              <button
                onClick={() => void creer(true)}
                disabled={chargement}
                className="rounded-lg bg-primary px-4 py-2 text-sm font-semibold text-primary-foreground hover:opacity-90 disabled:opacity-60"
              >
                Créer la campagne
              </button>
            </div>
          </div>
        </section>
      )}
    </div>
  );
}

function Recap({ label, valeur }: { label: string; valeur: string }) {
  return (
    <div className="rounded-xl border border-border px-4 py-3">
      <p className="th-label">{label}</p>
      <p className="text-sm font-medium">{valeur}</p>
    </div>
  );
}
