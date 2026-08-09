import { useEffect } from "react";
import { useQueryClient } from "@tanstack/react-query";

import { supabase } from "@/integrations/supabase/client";

export const STATUTS = [
  { value: "non_qualifie", label: "Non qualifié" },
  { value: "pas_de_reponse", label: "Pas de réponse" },
  { value: "pas_interesse", label: "Pas intéressé" },
  { value: "pas_decisionnaire", label: "Pas décisionnaire" },
  { value: "rdv_pris", label: "RDV pris" },
] as const;

export function statutLabel(value: string | null): string {
  return STATUTS.find((s) => s.value === value)?.label ?? "Non qualifié";
}

export function statutClasses(value: string | null): string {
  switch (value) {
    case "rdv_pris":
      return "bg-success/15 text-success border-success/30";
    case "pas_interesse":
      return "bg-destructive/15 text-destructive border-destructive/30";
    case "pas_de_reponse":
      return "bg-muted text-muted-foreground border-border";
    case "pas_decisionnaire":
      return "bg-accent/15 text-accent border-accent/30";
    default:
      return "bg-primary/15 text-primary border-primary/30";
  }
}

export const CLASSIFICATIONS = [
  { value: "chaud", label: "🔥 Chaud", classes: "bg-accent/15 text-accent border-accent/30" },
  { value: "tiede", label: "🌤️ Tiède", classes: "bg-warm/15 text-warm border-warm/30" },
  { value: "froid", label: "❄️ Froid", classes: "bg-cold/15 text-cold border-cold/30" },
] as const;

export function classificationMeta(value: string | null) {
  return (
    CLASSIFICATIONS.find((c) => c.value === value) ?? {
      value: value ?? "",
      label: value ?? "—",
      classes: "bg-muted text-muted-foreground border-border",
    }
  );
}

export function useRealtime(table: string, queryKeys: string[]) {
  const queryClient = useQueryClient();
  useEffect(() => {
    const channel = supabase
      .channel(`realtime-${table}`)
      .on("postgres_changes", { event: "*", schema: "public", table }, () => {
        for (const key of queryKeys) {
          void queryClient.invalidateQueries({ queryKey: [key] });
        }
      })
      .subscribe();
    return () => {
      void supabase.removeChannel(channel);
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [table, queryClient, queryKeys.join("|")]);
}

export function formatDate(value: string | null | undefined): string {
  if (!value) return "—";
  const d = new Date(value);
  if (Number.isNaN(d.getTime())) return value;
  return d.toLocaleDateString("fr-FR", {
    day: "2-digit",
    month: "short",
    year: "numeric",
    hour: "2-digit",
    minute: "2-digit",
  });
}
