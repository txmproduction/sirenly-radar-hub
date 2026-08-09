import { useQuery } from "@tanstack/react-query";
import { createFileRoute, Link } from "@tanstack/react-router";
import { Mail, Percent, Target } from "lucide-react";
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
  icon: Icon,
  tone,
}: {
  label: string;
  value: string;
  hint: string;
  icon: typeof Target;
  tone: "primary" | "accent" | "success";
}) {
  const tones = {
    primary: "bg-primary/15 text-primary",
    accent: "bg-accent/15 text-accent",
    success: "bg-success/15 text-success",
  } as const;
  return (
    <div className="panel p-5">
      <div className="flex items-start justify-between gap-3">
        <div>
          <p className="text-xs font-semibold uppercase tracking-wide text-muted-foreground">
            {label}
          </p>
          <p className="mt-2 text-3xl font-extrabold tracking-tight">{value}</p>
          <p className="mt-1 text-xs text-muted-foreground">{hint}</p>
        </div>
        <span className={`grid size-10 place-items-center rounded-xl ${tones[tone]}`}>
          <Icon className="size-5" />
        </span>
      </div>
    </div>
  );
}

function Dashboard() {
  useRealtime("leads", ["dashboard"]);
  useRealtime("emails_envoyes", ["dashboard"]);
  useRealtime("reponses_formulaire", ["dashboard"]);
  const { data, isLoading } = useDashboardData();

  return (
    <div className="space-y-6">
      <header>
        <h1 className="text-2xl font-extrabold tracking-tight sm:text-3xl">Tableau de bord</h1>
        <p className="mt-1 text-sm text-muted-foreground">
          Vue d'ensemble de votre prospection en temps réel.
        </p>
      </header>

      <div className="grid gap-4 sm:grid-cols-2 xl:grid-cols-3">
        <StatCard
          label="Leads qualifiés ce mois"
          value={isLoading ? "—" : String(data?.qualifiesMois ?? 0)}
          hint="Statut différent de « non qualifié »"
          icon={Target}
          tone="primary"
        />
        <StatCard
          label="Emails envoyés"
          value={isLoading ? "—" : String(data?.emails ?? 0)}
          hint="Total des envois enregistrés"
          icon={Mail}
          tone="accent"
        />
        <StatCard
          label="Taux de réponse"
          value={isLoading ? "—" : `${data?.taux ?? 0} %`}
          hint={`${data?.reponses ?? 0} réponse(s) au formulaire`}
          icon={Percent}
          tone="success"
        />
      </div>

      <section className="panel p-5">
        <h2 className="text-sm font-semibold uppercase tracking-wide text-muted-foreground">
          Leads générés — 7 derniers jours
        </h2>
        <div className="mt-4 h-64">
          <ResponsiveContainer width="100%" height="100%">
            <AreaChart data={data?.chart ?? []}>
              <defs>
                <linearGradient id="leadsFill" x1="0" y1="0" x2="0" y2="1">
                  <stop offset="0%" stopColor="var(--color-primary)" stopOpacity={0.6} />
                  <stop offset="100%" stopColor="var(--color-primary)" stopOpacity={0} />
                </linearGradient>
              </defs>
              <CartesianGrid strokeDasharray="3 3" stroke="var(--color-border)" vertical={false} />
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
        </div>
      </section>

      <section className="panel p-5">
        <h2 className="text-sm font-semibold uppercase tracking-wide text-muted-foreground">
          Derniers leads qualifiés
        </h2>
        <div className="mt-4 space-y-2">
          {(data?.derniers ?? []).length === 0 && (
            <p className="text-sm text-muted-foreground">
              Aucun lead qualifié pour le moment. Lancez le radar pour commencer.
            </p>
          )}
          {(data?.derniers ?? []).map((lead) => (
            <Link
              key={lead.id}
              to="/leads/$id"
              params={{ id: lead.id }}
              className="flex flex-wrap items-center justify-between gap-3 rounded-xl border border-border bg-secondary/40 px-4 py-3 transition-colors hover:border-primary/40 hover:bg-secondary"
            >
              <div className="min-w-0">
                <p className="truncate text-sm font-semibold">{lead.nom}</p>
                <p className="truncate text-xs text-muted-foreground">
                  {[lead.commune, lead.activite].filter(Boolean).join(" · ") || "—"}
                </p>
              </div>
              <div className="flex items-center gap-3">
                <span className="text-xs text-muted-foreground">{formatDate(lead.date_maj)}</span>
                <span
                  className={`rounded-full border px-2.5 py-1 text-xs font-semibold ${statutClasses(lead.statut)}`}
                >
                  {statutLabel(lead.statut)}
                </span>
              </div>
            </Link>
          ))}
        </div>
      </section>
    </div>
  );
}
