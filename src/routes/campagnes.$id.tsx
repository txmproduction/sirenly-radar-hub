import { useQuery } from "@tanstack/react-query";
import { createFileRoute, Link } from "@tanstack/react-router";

import { EmptyState, PageHeader, Pill, StatCard } from "@/components/sirenly-ui";
import { supabase } from "@/integrations/supabase/client";
import { Mail, MessageSquare, Percent, Users } from "lucide-react";
import {
  classificationEmailMeta,
  formatDate,
  statutCampagneMeta,
  useRealtime,
} from "@/lib/sirenly";

export const Route = createFileRoute("/campagnes/$id")({
  head: () => ({
    meta: [
      { title: "Détail campagne — Sirenly" },
      {
        name: "description",
        content: "Statistiques, emails envoyés et réponses reçues pour cette campagne.",
      },
      { property: "og:title", content: "Détail campagne — Sirenly" },
      {
        property: "og:description",
        content: "Analysez la performance de votre campagne de prospection.",
      },
    ],
  }),
  component: CampagneDetail,
});

function CampagneDetail() {
  const { id } = Route.useParams();
  useRealtime("emails_envoyes", ["campagne-detail"]);

  const { data } = useQuery({
    queryKey: ["campagne-detail", id],
    queryFn: async () => {
      const [campagne, emails, reponses, file] = await Promise.all([
        supabase.from("campagnes").select("*").eq("id", id).maybeSingle(),
        supabase
          .from("emails_envoyes")
          .select("*")
          .eq("campagne_id", id)
          .order("date_envoi", { ascending: false }),
        supabase
          .from("reponses_emails")
          .select("*")
          .eq("campagne_id", id)
          .order("date_reception", { ascending: false }),
        supabase.from("file_envoi").select("*").eq("campagne_id", id),
      ]);
      return {
        campagne: campagne.data,
        emails: emails.data ?? [],
        reponses: reponses.data ?? [],
        file: file.data ?? [],
      };
    },
  });

  const c = data?.campagne;
  if (!c) {
    return (
      <div className="space-y-6">
        <PageHeader titre="Campagne" />
        <EmptyState titre="Campagne introuvable" />
      </div>
    );
  }

  const envoyes = data?.emails.length ?? 0;
  const reponses = data?.reponses.length ?? 0;
  const taux = envoyes ? Math.round((reponses / envoyes) * 100) : 0;
  const meta = statutCampagneMeta(c.statut);

  return (
    <div className="space-y-6">
      <PageHeader
        titre={c.nom}
        sousTitre={`Créée le ${formatDate(c.date_creation)} · mode ${c.mode === "ia" ? "Personnalisation IA" : "Template"}`}
        actions={
          <>
            <Pill label={meta.label} classes={meta.classes} />
            <Link
              to="/campagnes"
              className="rounded-lg border border-input bg-card px-3 py-2 text-sm font-medium hover:bg-muted"
            >
              Retour
            </Link>
          </>
        }
      />

      <div className="grid gap-4 sm:grid-cols-2 xl:grid-cols-4">
        <StatCard icon={Users} valeur={((c.lead_ids as string[]) ?? []).length} libelle="Leads ciblés" />
        <StatCard icon={Mail} valeur={envoyes} libelle="Emails envoyés" />
        <StatCard icon={MessageSquare} valeur={reponses} libelle="Réponses reçues" />
        <StatCard icon={Percent} valeur={`${taux}%`} libelle="Taux de réponse" />
      </div>

      {(data?.file.length ?? 0) > 0 && (
        <div className="panel p-4 text-sm">
          <span className="font-medium">{data?.file.length} envoi(s) en file d'attente</span>{" "}
          <span className="text-muted-foreground">
            (limite de 300 emails/jour — les envois restants sont programmés)
          </span>
        </div>
      )}

      <div className="grid gap-6 lg:grid-cols-2">
        <section className="panel p-6">
          <h2 className="font-display text-lg font-bold">Emails envoyés</h2>
          <div className="mt-4 space-y-3">
            {envoyes === 0 && <EmptyState titre="Aucun email envoyé" />}
            {data?.emails.map((e) => (
              <div key={e.id} className="rounded-xl border border-border p-4">
                <div className="flex flex-wrap items-center justify-between gap-2">
                  <p className="text-sm font-medium">{e.sujet}</p>
                  <span className="text-xs text-muted-foreground">{formatDate(e.date_envoi)}</span>
                </div>
                {e.lead_id && (
                  <Link
                    to="/leads/$id"
                    params={{ id: e.lead_id }}
                    className="text-xs text-primary hover:underline"
                  >
                    {e.lead_id}
                  </Link>
                )}
                <p className="mt-2 whitespace-pre-wrap text-sm text-muted-foreground">{e.contenu}</p>
              </div>
            ))}
          </div>
        </section>

        <section className="panel p-6">
          <h2 className="font-display text-lg font-bold">Réponses liées</h2>
          <div className="mt-4 space-y-3">
            {reponses === 0 && <EmptyState titre="Aucune réponse" />}
            {data?.reponses.map((r) => {
              const m = classificationEmailMeta(r.classification);
              return (
                <div key={r.id} className="rounded-xl border border-primary/25 bg-primary-soft p-4">
                  <div className="flex flex-wrap items-center justify-between gap-2">
                    <p className="text-sm font-medium">{r.email_expediteur}</p>
                    <Pill label={m.label} classes={m.classes} />
                  </div>
                  <p className="mt-2 whitespace-pre-wrap text-sm">{r.contenu}</p>
                </div>
              );
            })}
          </div>
        </section>
      </div>
    </div>
  );
}
