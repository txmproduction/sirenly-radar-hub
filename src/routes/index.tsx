import { useQuery } from "@tanstack/react-query";
import { createFileRoute, Link } from "@tanstack/react-router";
import { BarChart3 } from "lucide-react";
import {
  Area,
  AreaChart,
  CartesianGrid,
  ResponsiveContainer,
  Tooltip,
  XAxis,
  YAxis,
} from "recharts";

import { supabase } from "@/integrations/supabase/client";
import { formatDate, statutClasses, statutLabel, useRealtime } from "@/lib/sirenly";

export const Route = createFileRoute("/")({
  head: () => ({
    meta: [
      { title: "Tableau de bord — Sirenly" },
      {
        name: "description",
        content: "Suivi des leads qualifiés, emails envoyés et taux de réponse de la prospection.",
      },
      { property: "og:title", content: "Tableau de bord — Sirenly" },
      {
        property: "og:description",
        content: "Suivi des leads qualifiés, emails envoyés et taux de réponse.",
      },
    ],
  }),
  component: Dashboard,
});

function useDashboardData() {
  return useQuery({
    queryKey: ["dashboard"],
    queryFn: async () => {
      const debutMois = new Date();
      debutMois.setDate(1);
      debutMois.setHours(0, 0, 0, 0);

      const [leadsRes, emailsRes, reponsesRes] = await Promise.all([
        supabase
          .from("leads")
          .select("id, nom, commune, activite, statut, date_maj")
          .order("date_maj", { ascending: false })
          .limit(500),
        supabase.from("emails_envoyes").select("id", { count: "exact", head: true }),
        supabase.from("reponses_formulaire").select("id", { count: "exact", head: true }),
      ]);

      if (leadsRes.error) throw leadsRes.error;

      const leads = leadsRes.data ?? [];
      const qualifiesMois = leads.filter(
        (l) =>
          l.statut !== "non_qualifie" && l.date_maj && new Date(l.date_maj) >= debutMois,
      ).length;

      const emails = emailsRes.count ?? 0;
      const reponses = reponsesRes.count ?? 0;

      const jours = Array.from({ length: 7 }, (_, i) => {
        const d = new Date();
        d.setHours(0, 0, 0, 0);
        d.setDate(d.getDate() - (6 - i));
        return d;
      });

      const chart = jours.map((jour) => {
        const suivant = new Date(jour);
        suivant.setDate(suivant.getDate() + 1);
        return {
          jour: jour.toLocaleDateString("fr-FR", { weekday: "short", day: "2-digit" }),
          leads: leads.filter((l) => {
            if (!l.date_maj) return false;
            const d = new Date(l.date_maj);
            return d >= jour && d < suivant;
          }).length,
        };
      });

      return {
        qualifiesMois,
        emails,
        reponses,
        taux: emails > 0 ? Math.round((reponses / emails) * 100) : 0,
        chart,
        derniers: leads.filter((l) => l.statut !== "non_qualifie").slice(0, 8),
      };
    },
  });
}

function StatCard({
  label,
  value,
  hint,
  tone,
}: {
  label: string;
  value: string;
  hint: string;
  tone: "primary" | "accent" | "success";
}) {
  const bars = {
    primary: "bg-primary",
    accent: "bg-accent",
    success: "bg-success",
  } as const;
  return (
    <div className="group rounded-3xl border border-border bg-card p-6 transition-colors hover:border-primary/40">
      <p className="mb-2 text-sm font-medium text-muted-foreground">{label}</p>
      <div className="flex items-end justify-between gap-3">
        <p className="font-display text-4xl font-bold">{value}</p>
        <span className="shrink-0 rounded-lg bg-secondary px-2 py-1 text-xs text-muted-foreground">
          {hint}
        </span>
      </div>
      <div className="mt-4 h-1 w-full overflow-hidden rounded-full bg-secondary">
        <div className={`h-full w-0 transition-all duration-1000 group-hover:w-full ${bars[tone]}`} />
      </div>
    </div>
  );
}

function Dashboard() {
  useRealtime("leads", ["dashboard"]);
  useRealtime("emails_envoyes", ["dashboard"]);
  useRealtime("reponses_formulaire", ["dashboard"]);
  const { data, isLoading } = useDashboardData();

  const chart = data?.chart ?? [];
  const chartVide = chart.every((c) => c.leads === 0);
  const derniers = data?.derniers ?? [];

  return (
    <div className="space-y-8">
      <div className="grid gap-6 md:grid-cols-3">
        <StatCard
          label="Leads qualifiés ce mois"
          value={isLoading ? "—" : String(data?.qualifiesMois ?? 0)}
          hint="Ce mois-ci"
          tone="primary"
        />
        <StatCard
          label="Emails envoyés"
          value={isLoading ? "—" : String(data?.emails ?? 0)}
          hint="Total"
          tone="accent"
        />
        <StatCard
          label="Taux de réponse"
          value={isLoading ? "—" : `${data?.taux ?? 0} %`}
          hint={`${data?.reponses ?? 0} réponse(s)`}
          tone="success"
        />
      </div>

      <div className="grid gap-8 lg:grid-cols-3">
        <section className="flex min-h-[400px] flex-col rounded-3xl border border-border bg-card p-8 lg:col-span-2">
          <div className="mb-8 flex items-center justify-between gap-4">
            <h2 className="font-display text-lg font-semibold">Activité de la semaine</h2>
            <span className="flex items-center gap-2 rounded-lg bg-secondary px-3 py-1 text-xs text-muted-foreground">
              <span className="size-2 rounded-full bg-primary" />7 derniers jours
            </span>
          </div>

          <div className="relative flex-1">
            {chartVide ? (
              <div className="absolute inset-0 overflow-hidden rounded-2xl border-b border-l border-border">
                <div className="dot-grid absolute inset-0 opacity-10" />
                <div className="absolute inset-0 flex flex-col items-center justify-center px-6 text-center">
                  <div className="mb-4 grid size-16 place-items-center rounded-2xl bg-secondary">
                    <BarChart3 className="size-8 text-muted-foreground" />
                  </div>
                  <p className="font-medium">Aucune donnée à afficher</p>
                  <p className="mt-1 max-w-xs text-sm text-muted-foreground">
                    Lancez votre première recherche BODACC pour voir vos statistiques apparaître
                    ici.
                  </p>
                </div>
              </div>
            ) : (
              <ResponsiveContainer width="100%" height="100%">
                <AreaChart data={chart}>
                  <defs>
                    <linearGradient id="leadsFill" x1="0" y1="0" x2="0" y2="1">
                      <stop offset="0%" stopColor="var(--color-primary)" stopOpacity={0.6} />
                      <stop offset="100%" stopColor="var(--color-primary)" stopOpacity={0} />
                    </linearGradient>
                  </defs>
                  <CartesianGrid
                    strokeDasharray="3 3"
                    stroke="var(--color-border)"
                    vertical={false}
                  />
                  <XAxis
                    dataKey="jour"
                    stroke="var(--color-muted-foreground)"
                    fontSize={12}
                    tickLine={false}
                    axisLine={false}
                  />
                  <YAxis
                    allowDecimals={false}
                    stroke="var(--color-muted-foreground)"
                    fontSize={12}
                    tickLine={false}
                    axisLine={false}
                    width={30}
                  />
                  <Tooltip
                    contentStyle={{
                      background: "var(--color-popover)",
                      border: "1px solid var(--color-border)",
                      borderRadius: 12,
                      color: "var(--color-foreground)",
                    }}
                  />
                  <Area
                    type="monotone"
                    dataKey="leads"
                    stroke="var(--color-primary)"
                    strokeWidth={2}
                    fill="url(#leadsFill)"
                  />
                </AreaChart>
              </ResponsiveContainer>
            )}
          </div>

          {chartVide && (
            <div className="flex justify-between pt-4">
              {chart.map((c) => (
                <span key={c.jour} className="text-[10px] text-muted-foreground">
                  {c.jour}
                </span>
              ))}
            </div>
          )}
        </section>

        <section className="flex flex-col rounded-3xl border border-border bg-card p-8">
          <h2 className="mb-6 font-display text-lg font-semibold">Dernières opportunités</h2>

          {derniers.length === 0 ? (
            <div className="flex flex-1 flex-col gap-4">
              <div className="flex items-center gap-4 rounded-2xl border border-dashed border-border p-4 opacity-40">
                <div className="size-10 shrink-0 rounded-full bg-secondary" />
                <div className="min-w-0 flex-1 space-y-2">
                  <div className="h-3 w-2/3 rounded bg-secondary" />
                  <div className="h-2 w-1/2 rounded bg-secondary" />
                </div>
              </div>
              <div className="flex items-center gap-4 rounded-2xl border border-dashed border-border p-4 opacity-20">
                <div className="size-10 shrink-0 rounded-full bg-secondary" />
                <div className="min-w-0 flex-1 space-y-2">
                  <div className="h-3 w-1/3 rounded bg-secondary" />
                  <div className="h-2 w-2/3 rounded bg-secondary" />
                </div>
              </div>
              <div className="mt-auto text-center">
                <p className="mb-6 text-sm text-muted-foreground">
                  Votre pipeline est actuellement vide.
                </p>
                <Link
                  to="/leads"
                  className="block w-full rounded-xl border border-primary py-3 text-center font-medium text-primary transition-all hover:bg-primary hover:text-primary-foreground"
                >
                  Qualifier des leads
                </Link>
              </div>
            </div>
          ) : (
            <div className="space-y-3">
              {derniers.map((lead) => (
                <Link
                  key={lead.id}
                  to="/leads/$id"
                  params={{ id: lead.id }}
                  className="block rounded-2xl border border-border bg-background/40 p-4 transition-colors hover:border-primary/40"
                >
                  <div className="flex items-start justify-between gap-3">
                    <div className="min-w-0">
                      <p className="truncate text-sm font-semibold">{lead.nom}</p>
                      <p className="truncate text-xs text-muted-foreground">
                        {[lead.commune, lead.activite].filter(Boolean).join(" · ") || "—"}
                      </p>
                    </div>
                    <span
                      className={`shrink-0 rounded-full border px-2.5 py-1 text-[11px] font-semibold ${statutClasses(lead.statut)}`}
                    >
                      {statutLabel(lead.statut)}
                    </span>
                  </div>
                  <p className="mt-2 text-[11px] text-muted-foreground">
                    {formatDate(lead.date_maj)}
                  </p>
                </Link>
              ))}
            </div>
          )}
        </section>
      </div>
    </div>
  );
}

