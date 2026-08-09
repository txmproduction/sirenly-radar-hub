import { useQuery, useQueryClient } from "@tanstack/react-query";
import { createFileRoute } from "@tanstack/react-router";
import { useEffect, useState } from "react";
import { toast } from "sonner";

import { PageHeader } from "@/components/sirenly-ui";
import { supabase } from "@/integrations/supabase/client";
import { LIMITE_QUOTIDIENNE, formatDate, useRealtime } from "@/lib/sirenly";

export const Route = createFileRoute("/parametres")({
  head: () => ({
    meta: [
      { title: "Paramètres — Sirenly" },
      {
        name: "description",
        content: "Configurez l'agence, l'équipe, l'envoi d'emails, l'IA, le radar et les alertes.",
      },
      { property: "og:title", content: "Paramètres — Sirenly" },
      {
        property: "og:description",
        content: "Réglages de votre plateforme de prospection Sirenly.",
      },
    ],
  }),
  component: Parametres,
});

const ONGLETS = [
  "Général",
  "Équipe",
  "Envoi d'emails",
  "Intelligence artificielle",
  "Radar",
  "Notifications",
] as const;

const EXCLUSIONS_DEFAUT = [
  "holding",
  "portage",
  "gestion de participations",
  "société civile immobilière",
  "coursier",
  "livreur",
  "livraison de repas",
  "uber eats",
  "à vélo",
];

function Parametres() {
  const qc = useQueryClient();
  useRealtime("equipe", ["parametres"]);
  const [onglet, setOnglet] = useState<(typeof ONGLETS)[number]>("Général");

  const { data } = useQuery({
    queryKey: ["parametres"],
    queryFn: async () => {
      const debutJour = new Date();
      debutJour.setHours(0, 0, 0, 0);
      const [params, equipe, envois] = await Promise.all([
        supabase.from("parametres").select("*").limit(1).maybeSingle(),
        supabase.from("equipe").select("*").order("date_ajout", { ascending: false }),
        supabase
          .from("emails_envoyes")
          .select("id", { count: "exact", head: true })
          .gte("date_envoi", debutJour.toISOString()),
      ]);
      return {
        params: params.data,
        equipe: equipe.data ?? [],
        envoisJour: envois.count ?? 0,
      };
    },
  });

  const [form, setForm] = useState<Record<string, unknown>>({});
  useEffect(() => {
    if (data?.params) setForm(data.params as Record<string, unknown>);
  }, [data?.params?.["id"]]);

  const v = (k: string) => String(form[k] ?? "");
  const set = (k: string, value: unknown) => setForm((f) => ({ ...f, [k]: value }));

  async function enregistrer() {
    const payload = { ...form, id: undefined };
    delete payload["id"];
    const existant = data?.params?.["id"];
    const { error } = existant
      ? await supabase.from("parametres").update(payload).eq("id", existant)
      : await supabase.from("parametres").insert(payload);
    if (error) toast.error(error.message);
    else {
      toast.success("Paramètres enregistrés");
      void qc.invalidateQueries({ queryKey: ["parametres"] });
    }
  }

  const exclusions: string[] = Array.isArray(form["exclusions"])
    ? (form["exclusions"] as string[])
    : EXCLUSIONS_DEFAUT;

  return (
    <div className="space-y-6">
      <PageHeader
        titre="Paramètres"
        sousTitre="Agence, équipe, emails, IA, radar et notifications"
        actions={
          <button
            onClick={() => void enregistrer()}
            className="rounded-lg bg-primary px-4 py-2 text-sm font-semibold text-primary-foreground hover:opacity-90"
          >
            Enregistrer
          </button>
        }
      />

      <div className="panel flex flex-wrap gap-1 p-2">
        {ONGLETS.map((o) => (
          <button
            key={o}
            onClick={() => setOnglet(o)}
            className={`rounded-lg px-3 py-2 text-sm font-medium transition-colors ${
              onglet === o ? "bg-primary-soft text-primary-strong" : "text-muted-foreground hover:bg-muted"
            }`}
          >
            {o}
          </button>
        ))}
      </div>

      {onglet === "Général" && (
        <section className="panel grid gap-4 p-6 sm:grid-cols-2">
          <Champ label="Nom de l'agence" value={v("nom_agence")} onChange={(x) => set("nom_agence", x)} />
          <Champ label="URL du logo" value={v("logo_url")} onChange={(x) => set("logo_url", x)} />
          <Champ label="Fuseau horaire" value={v("fuseau")} onChange={(x) => set("fuseau", x)} placeholder="Europe/Paris" />
        </section>
      )}

      {onglet === "Équipe" && <Equipe membres={data?.equipe ?? []} />}

      {onglet === "Envoi d'emails" && (
        <section className="panel grid gap-4 p-6 sm:grid-cols-2">
          <Champ label="Nom d'expéditeur" value={v("expediteur_nom")} onChange={(x) => set("expediteur_nom", x)} />
          <Champ label="Email d'expédition" value={v("expediteur_email")} onChange={(x) => set("expediteur_email", x)} />
          <Champ
            label="Adresse de réception des réponses (inbound Brevo)"
            value={v("email_reception")}
            onChange={(x) => set("email_reception", x)}
          />
          <div className="rounded-xl border border-border p-4">
            <p className="th-label">Quota du jour</p>
            <p className="mt-1 text-2xl font-bold">
              {data?.envoisJour ?? 0}
              <span className="text-base text-muted-foreground">/{LIMITE_QUOTIDIENNE}</span>
            </p>
            <div className="mt-2 h-2 w-full overflow-hidden rounded-full bg-muted">
              <div
                className="h-full rounded-full bg-brand"
                style={{
                  width: `${Math.min(100, ((data?.envoisJour ?? 0) / LIMITE_QUOTIDIENNE) * 100)}%`,
                }}
              />
            </div>
          </div>
          <div className="sm:col-span-2 rounded-xl border border-border p-4 text-sm">
            <p className="th-label">Webhook de réception</p>
            <code className="mt-1 block break-all text-xs text-muted-foreground">
              /api/public/receive-email-webhook
            </code>
            <p className="mt-2 text-xs text-muted-foreground">
              Renseignez cette URL (préfixée du domaine de l'application) dans l'inbound parsing
              Brevo.
            </p>
          </div>
        </section>
      )}

      {onglet === "Intelligence artificielle" && (
        <section className="panel space-y-4 p-6">
          <label className="block">
            <span className="th-label">Contexte de l'agence</span>
            <textarea
              value={v("contexte_ia")}
              onChange={(e) => set("contexte_ia", e.target.value)}
              rows={8}
              placeholder="Décrivez l'agence, l'offre, le ton souhaité…"
              className="mt-1 w-full rounded-lg border border-border bg-background p-3 text-sm outline-none focus:border-primary"
            />
          </label>
          <Bascule
            label="Classification automatique des réponses"
            actif={form["classification_auto"] !== false}
            onToggle={(x) => set("classification_auto", x)}
          />
        </section>
      )}

      {onglet === "Radar" && (
        <section className="panel space-y-4 p-6">
          <Champ
            label="Département par défaut"
            value={v("departement_defaut")}
            onChange={(x) => set("departement_defaut", x)}
            placeholder="74"
          />
          <div>
            <span className="th-label">Mots-clés d'exclusion</span>
            <div className="mt-2 flex flex-wrap gap-2">
              {exclusions.map((m) => (
                <span
                  key={m}
                  className="inline-flex items-center gap-2 rounded-full border border-border bg-card px-3 py-1 text-xs"
                >
                  {m}
                  <button
                    onClick={() => set("exclusions", exclusions.filter((x) => x !== m))}
                    className="text-muted-foreground hover:text-destructive"
                    aria-label={`Retirer ${m}`}
                  >
                    ×
                  </button>
                </span>
              ))}
            </div>
            <AjoutMot onAdd={(mot) => set("exclusions", [...exclusions, mot])} />
          </div>
        </section>
      )}

      {onglet === "Notifications" && (
        <section className="panel space-y-3 p-6">
          <Bascule
            label="Récapitulatif quotidien par email"
            actif={form["notif_recap"] === true}
            onToggle={(x) => set("notif_recap", x)}
          />
          <Bascule
            label="Alerte immédiate sur réponse intéressée"
            actif={form["notif_interesse"] === true}
            onToggle={(x) => set("notif_interesse", x)}
          />
        </section>
      )}
    </div>
  );
}

function Champ({
  label,
  value,
  onChange,
  placeholder,
}: {
  label: string;
  value: string;
  onChange: (v: string) => void;
  placeholder?: string;
}) {
  return (
    <label className="block">
      <span className="th-label">{label}</span>
      <input
        value={value}
        onChange={(e) => onChange(e.target.value)}
        placeholder={placeholder ?? ""}
        className="mt-1 h-10 w-full rounded-lg border border-border bg-background px-3 text-sm outline-none focus:border-primary"
      />
    </label>
  );
}

function Bascule({
  label,
  actif,
  onToggle,
}: {
  label: string;
  actif: boolean;
  onToggle: (v: boolean) => void;
}) {
  return (
    <button
      onClick={() => onToggle(!actif)}
      className="flex w-full items-center justify-between rounded-xl border border-border px-4 py-3 text-left text-sm hover:bg-muted/60"
    >
      <span>{label}</span>
      <span
        className={`relative h-6 w-11 rounded-full transition-colors ${actif ? "bg-primary" : "bg-muted"}`}
      >
        <span
          className={`absolute top-0.5 size-5 rounded-full bg-card shadow transition-all ${actif ? "left-[22px]" : "left-0.5"}`}
        />
      </span>
    </button>
  );
}

function AjoutMot({ onAdd }: { onAdd: (mot: string) => void }) {
  const [val, setVal] = useState("");
  return (
    <form
      onSubmit={(e) => {
        e.preventDefault();
        if (val.trim()) onAdd(val.trim());
        setVal("");
      }}
      className="mt-3 flex gap-2"
    >
      <input
        value={val}
        onChange={(e) => setVal(e.target.value)}
        placeholder="Ajouter un mot-clé…"
        className="h-9 flex-1 rounded-lg border border-border bg-background px-3 text-sm outline-none focus:border-primary"
      />
      <button className="rounded-lg border border-input bg-card px-3 text-sm font-medium hover:bg-muted">
        Ajouter
      </button>
    </form>
  );
}

function Equipe({ membres }: { membres: Array<Record<string, unknown>> }) {
  const qc = useQueryClient();
  const [nom, setNom] = useState("");
  const [email, setEmail] = useState("");
  const [role, setRole] = useState("agent");

  async function inviter(e: React.FormEvent) {
    e.preventDefault();
    if (!nom.trim() || !email.trim()) return;
    const { error } = await supabase.from("equipe").insert({ nom, email, role });
    if (error) toast.error(error.message);
    else {
      toast.success("Membre ajouté");
      setNom("");
      setEmail("");
      void qc.invalidateQueries({ queryKey: ["parametres"] });
    }
  }

  async function retirer(id: string) {
    const { error } = await supabase.from("equipe").delete().eq("id", id);
    if (error) toast.error(error.message);
    else void qc.invalidateQueries({ queryKey: ["parametres"] });
  }

  return (
    <section className="panel space-y-5 p-6">
      <form onSubmit={(e) => void inviter(e)} className="grid gap-2 sm:grid-cols-[1fr_1fr_auto_auto]">
        <input
          value={nom}
          onChange={(e) => setNom(e.target.value)}
          placeholder="Nom"
          className="h-10 rounded-lg border border-border bg-background px-3 text-sm outline-none focus:border-primary"
        />
        <input
          value={email}
          onChange={(e) => setEmail(e.target.value)}
          placeholder="email@agence.fr"
          className="h-10 rounded-lg border border-border bg-background px-3 text-sm outline-none focus:border-primary"
        />
        <select
          value={role}
          onChange={(e) => setRole(e.target.value)}
          className="h-10 rounded-lg border border-border bg-card px-3 text-sm"
        >
          <option value="agent">Agent</option>
          <option value="admin">Admin</option>
        </select>
        <button className="h-10 rounded-lg bg-primary px-4 text-sm font-semibold text-primary-foreground hover:opacity-90">
          Inviter
        </button>
      </form>

      <div className="divide-y divide-border">
        {membres.length === 0 && (
          <p className="py-6 text-center text-sm text-muted-foreground">Aucun membre</p>
        )}
        {membres.map((m) => (
          <div key={String(m["id"])} className="flex items-center justify-between gap-3 py-3">
            <div className="min-w-0">
              <p className="truncate text-sm font-medium">{String(m["nom"] ?? "")}</p>
              <p className="truncate text-xs text-muted-foreground">
                {String(m["email"] ?? "")} · {String(m["role"] ?? "agent")} ·{" "}
                {formatDate(m["date_ajout"] as string)}
              </p>
            </div>
            <button
              onClick={() => void retirer(String(m["id"]))}
              className="shrink-0 rounded-lg border border-input bg-card px-3 py-1.5 text-xs font-medium hover:bg-muted"
            >
              Retirer
            </button>
          </div>
        ))}
      </div>
    </section>
  );
}
