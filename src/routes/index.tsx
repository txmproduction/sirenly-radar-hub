import { useQuery } from "@tanstack/react-query";
import { createFileRoute, Link } from "@tanstack/react-router";
import { Send, Users, UserCheck, Mail } from "lucide-react";

import { EmptyState, PageHeader, Pill, StatCard } from "@/components/sirenly-ui";
import { supabase } from "@/integrations/supabase/client";
import {
  classificationEmailMeta,
  extrait,
  formatDate,
  statutMeta,
  useRealtime,
} from "@/lib/sirenly";

export const Route = createFileRoute("/")({
  head: () => ({
    meta: [
      { title: "Tableau de bord — Sirenly" },
      {
        name: "description",
        content:
          "Vue d'ensemble de votre prospection B2B : campagnes, leads, emails envoyés et réponses.",
      },
      { property: "og:title", content: "Tableau de bord — Sirenly" },
      {
        property: "og:description",
        content: "Pilotez vos campagnes de prospection B2B et suivez vos prospects.",
      },
    ],
  }),
  component: Dashboard,
});

const FUNNEL = [
  { id: "prospects", label: "Prospects" },
  { id: "contactes", label: "Contactés" },
  { id: "repondus", label: "Répondus" },
  { id: "interesses", label: "Intéressés" },
  { id: "rdv", label: "RDV pris" },
];

function Dashboard() {
  useRealtime("leads", ["dash"]);
  useRealtime("emails_envoyes", ["dash"]);
  useRealtime("reponses_emails", ["dash"]);

  const { data } = useQuery({
    queryKey: ["dash"],
    queryFn: async () => {
      const debutMois = new Date();
      debutMois.setDate(1);
      debutMois.setHours(0, 0, 0, 0);

      const [leads, campagnes, emails, reponses] = await Promise.all([
        supabase.from("leads").select("id, statut, nom, commune, activite, campagne_id"),
        supabase.from("campagnes").select("id, nom, statut"),
        supabase.from("emails_envoyes").select("id, campagne_id, date_envoi"),
        supabase
          .from("reponses_emails")
          .select("id, campagne_id, contenu, email_expediteur, classification, date_reception, lead_id")
          .order("date_reception", { ascending: false }),
      ]);

      const l = leads.data ?? [];
      const e = emails.data ?? [];
      const r = reponses.data ?? [];
      const c = campagnes.data ?? [];

      const parCampagne = c.map((camp) => {
        const envoyes = e.filter((x) => x.campagne_id === camp.id).length;
        const rep = r.filter((x) => x.campagne_id === camp.id).length;
        return {
          ...camp,
          envoyes,
          taux: envoyes ? Math.round((rep / envoyes) * 100) : 0,
        };
      });

      const qualifies = l.filter((x) =>
        ["contacte", "a_repondu", "info_request", "meeting", "rdv_pris", "client"].includes(
          x.statut ?? "",
        ),
      ).length;

      const funnel = {
        prospects: l.length,
        contactes: new Set(e.map((x) => x.id)).size,
        repondus: r.length,
        interesses: r.filter((x) => x.classification === "interesse").length,
        rdv: l.filter((x) => ["meeting", "rdv_pris"].includes(x.statut ?? "")).length,
      } as Record<string, number>;

      return {
        totalCampagnes: c.length,
        totalLeads: l.length,
        qualifies,
        emailsMois: e.filter((x) => new Date(x.date_envoi) >= debutMois).length,
        totalEmails: e.length,
        parCampagne,
        funnel,
        dernieresReponses: r.slice(0, 5),
      };
    },
  });

  const d = data;
  const maxFunnel = Math.max(1, d?.funnel["prospects"] ?? 1);
  const totalEmails = d?.totalEmails ?? 0;
  const maxCampagne = Math.max(1, ...(d?.parCampagne.map((c) => c.envoyes) ?? [1]));

  return (
    <div className="space-y-8">
      <PageHeader
        titre="Tableau de bord"
        sousTitre="Vue d'ensemble de votre activité de prospection"
        actions={
          <Link
            to="/campagnes/nouvelle"
            className="rounded-lg bg-primary px-4 py-2 text-sm font-semibold text-primary-foreground hover:opacity-90"
          >
            Nouvelle campagne
          </Link>
        }
      />

      <div className="grid gap-4 sm:grid-cols-2 xl:grid-cols-4">
        <StatCard icon={Send} valeur={d?.totalCampagnes ?? 0} libelle="Total campagnes" />
        <StatCard icon={Users} valeur={d?.totalLeads ?? 0} libelle="Total leads" />
        <StatCard icon={UserCheck} valeur={d?.qualifies ?? 0} libelle="Leads qualifiés" />
        <StatCard icon={Mail} valeur={d?.emailsMois ?? 0} libelle="Emails envoyés ce mois" />
      </div>

      <section className="panel p-6">
        <h2 className="font-display text-lg font-bold">Email Analytics</h2>
        <p className="text-sm text-muted-foreground">Volume envoyé et performance par campagne</p>

        <div className="mt-6 grid gap-8 lg:grid-cols-[220px_minmax(0,1fr)]">
          <Donut total={totalEmails} parts={d?.parCampagne ?? []} />

          <div className="space-y-3">
            {(d?.parCampagne ?? []).length === 0 && (
              <EmptyState
                titre="Aucune campagne"
                texte="Créez votre première campagne pour voir les taux de réponse."
              />
            )}
            {(d?.parCampagne ?? []).map((c) => (
              <div key={c.id} className="flex items-center gap-4">
                <div className="min-w-0 flex-1">
                  <div className="flex items-center justify-between gap-3">
                    <Link
                      to="/campagnes/$id"
                      params={{ id: c.id }}
                      className="truncate text-sm font-medium hover:text-primary"
                    >
                      {c.nom}
                    </Link>
                    <Pill
                      label={`${c.taux}% de réponse`}
                      classes="bg-success text-success-foreground border-success-foreground/15"
                    />
                  </div>
                  <div className="mt-2 h-1.5 w-full overflow-hidden rounded-full bg-muted">
                    <div
                      className="h-full rounded-full bg-brand"
                      style={{ width: `${(c.envoyes / maxCampagne) * 100}%` }}
                    />
                  </div>
                </div>
              </div>
            ))}
          </div>
        </div>
      </section>

      <div className="grid gap-6 lg:grid-cols-2">
        <section className="panel p-6">
          <h2 className="font-display text-lg font-bold">Suivi des prospects</h2>
          <p className="text-sm text-muted-foreground">Du prospect au rendez-vous</p>
          <div className="mt-6 space-y-4">
            {FUNNEL.map((f, i) => {
              const v = d?.funnel[f.id] ?? 0;
              return (
                <div key={f.id}>
                  <div className="flex items-center justify-between text-sm">
                    <span className="text-muted-foreground">{f.label}</span>
                    <span className="font-semibold">{v}</span>
                  </div>
                  <div className="mt-1.5 h-2.5 w-full overflow-hidden rounded-full bg-muted">
                    <div
                      className="h-full rounded-full bg-brand"
                      style={{
                        width: `${Math.max(2, (v / maxFunnel) * 100)}%`,
                        opacity: 1 - i * 0.12,
                      }}
                    />
                  </div>
                </div>
              );
            })}
          </div>
        </section>

        <section className="panel p-6">
          <h2 className="font-display text-lg font-bold">Dernières réponses</h2>
          <p className="text-sm text-muted-foreground">Les 5 messages les plus récents</p>
          <div className="mt-5 space-y-3">
            {(d?.dernieresReponses ?? []).length === 0 && (
              <EmptyState
                titre="Aucune réponse pour l'instant"
                texte="Les réponses reçues à vos campagnes apparaîtront ici."
              />
            )}
            {(d?.dernieresReponses ?? []).map((r) => {
              const meta = classificationEmailMeta(r.classification);
              return (
                <Link
                  key={r.id}
                  to="/inbox"
                  className="block rounded-xl border border-border p-3 transition-colors hover:bg-muted/60"
                >
                  <div className="flex items-center justify-between gap-3">
                    <span className="truncate text-sm font-medium">{r.email_expediteur}</span>
                    <Pill label={meta.label} classes={meta.classes} />
                  </div>
                  <p className="mt-1 text-xs text-muted-foreground">{extrait(r.contenu, 90)}</p>
                  <p className="mt-1 text-[11px] text-muted-foreground">
                    {formatDate(r.date_reception)}
                  </p>
                </Link>
              );
            })}
          </div>
        </section>
      </div>

      <section className="panel p-6">
        <h2 className="font-display text-lg font-bold">Statuts des leads</h2>
        <div className="mt-4 flex flex-wrap gap-2">
          {["nouveau", "contacte", "a_repondu", "info_request", "meeting", "client", "perdu"].map(
            (s) => {
              const meta = statutMeta(s);
              return <Pill key={s} label={meta.label} classes={meta.classes} />;
            },
          )}
        </div>
      </section>
    </div>
  );
}

function Donut({
  total,
  parts,
}: {
  total: number;
  parts: Array<{ id: string; nom: string; envoyes: number }>;
}) {
  const radius = 70;
  const stroke = 22;
  const circ = 2 * Math.PI * radius;
  const somme = parts.reduce((acc, p) => acc + p.envoyes, 0) || 1;
  let offset = 0;
  const colors = ["#e08a2b", "#f0b26b", "#f7d5ab", "#a75f12", "#fbe4c7"];

  return (
    <div className="relative mx-auto size-[200px]">
      <svg viewBox="0 0 200 200" className="size-full -rotate-90">
        <circle cx="100" cy="100" r={radius} fill="none" stroke="var(--muted)" strokeWidth={stroke} />
        {parts.map((p, i) => {
          const len = (p.envoyes / somme) * circ;
          const el = (
            <circle
              key={p.id}
              cx="100"
              cy="100"
              r={radius}
              fill="none"
              stroke={colors[i % colors.length]}
              strokeWidth={stroke}
              strokeDasharray={`${len} ${circ - len}`}
              strokeDashoffset={-offset}
            />
          );
          offset += len;
          return el;
        })}
      </svg>
      <div className="absolute inset-0 grid place-content-center text-center">
        <p className="font-display text-3xl font-bold">{total}</p>
        <p className="text-xs text-muted-foreground">emails envoyés</p>
      </div>
    </div>
  );
}
