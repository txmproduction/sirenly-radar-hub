import { useQuery } from "@tanstack/react-query";
import { createFileRoute, Link } from "@tanstack/react-router";

import { EmptyState, PageHeader, Pill } from "@/components/sirenly-ui";
import { supabase } from "@/integrations/supabase/client";
import { statutCampagneMeta, useRealtime } from "@/lib/sirenly";

export const Route = createFileRoute("/campagnes/")({
  head: () => ({
    meta: [
      { title: "Campagnes — Sirenly" },
      {
        name: "description",
        content: "Vos campagnes de prospection email : envois, réponses et taux de réponse.",
      },
      { property: "og:title", content: "Campagnes — Sirenly" },
      {
        property: "og:description",
        content: "Créez et pilotez vos campagnes d'emailing B2B personnalisées par IA.",
      },
    ],
  }),
  component: CampagnesPage,
});

function CampagnesPage() {
  useRealtime("campagnes", ["campagnes"]);
  useRealtime("emails_envoyes", ["campagnes"]);

  const { data } = useQuery({
    queryKey: ["campagnes"],
    queryFn: async () => {
      const [campagnes, emails, reponses] = await Promise.all([
        supabase.from("campagnes").select("*").order("date_creation", { ascending: false }),
        supabase.from("emails_envoyes").select("id, campagne_id"),
        supabase.from("reponses_emails").select("id, campagne_id"),
      ]);
      const e = emails.data ?? [];
      const r = reponses.data ?? [];
      return (campagnes.data ?? []).map((c) => {
        const envoyes = e.filter((x) => x.campagne_id === c.id).length;
        const rep = r.filter((x) => x.campagne_id === c.id).length;
        return {
          ...c,
          envoyes,
          reponses: rep,
          taux: envoyes ? Math.round((rep / envoyes) * 100) : 0,
          cibles: ((c.lead_ids as string[]) ?? []).length,
        };
      });
    },
  });

  const campagnes = data ?? [];

  return (
    <div className="space-y-6">
      <PageHeader
        titre="Campagnes"
        sousTitre={`${campagnes.length} campagne(s)`}
        actions={
          <Link
            to="/campagnes/nouvelle"
            className="rounded-lg bg-primary px-4 py-2 text-sm font-semibold text-primary-foreground hover:opacity-90"
          >
            Nouvelle campagne
          </Link>
        }
      />

      {campagnes.length === 0 ? (
        <EmptyState
          titre="Aucune campagne"
          texte="Lancez votre première campagne en 3 étapes : cible, message, lancement."
        />
      ) : (
        <div className="panel overflow-x-auto">
          <table className="w-full min-w-[760px] text-sm">
            <thead>
              <tr className="border-b border-border">
                {["Nom", "Statut", "Envoyés", "Leads ciblés", "Réponses", "Taux"].map((h) => (
                  <th key={h} className="th-label px-4 py-3 text-left">
                    {h}
                  </th>
                ))}
              </tr>
            </thead>
            <tbody>
              {campagnes.map((c) => {
                const meta = statutCampagneMeta(c.statut);
                return (
                  <tr key={c.id} className="border-b border-border last:border-0 hover:bg-muted/50">
                    <td className="px-4 py-3">
                      <Link
                        to="/campagnes/$id"
                        params={{ id: c.id }}
                        className="font-medium hover:text-primary"
                      >
                        {c.nom}
                      </Link>
                    </td>
                    <td className="px-4 py-3">
                      <Pill label={meta.label} classes={meta.classes} />
                    </td>
                    <td className="px-4 py-3 text-muted-foreground">{c.envoyes}</td>
                    <td className="px-4 py-3 text-muted-foreground">{c.cibles}</td>
                    <td className="px-4 py-3 text-muted-foreground">{c.reponses}</td>
                    <td className="px-4 py-3 font-semibold text-primary-strong">{c.taux}%</td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        </div>
      )}
    </div>
  );
}
