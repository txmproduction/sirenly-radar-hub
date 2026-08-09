import { useEffect } from "react";
import { useQueryClient } from "@tanstack/react-query";

import { supabase } from "@/integrations/supabase/client";

/* ---------------------------------- Statuts ---------------------------------- */

export type StatutMeta = { value: string; label: string; classes: string };

const PILL_POS = "bg-success text-success-foreground border-success-foreground/15";
const PILL_WAIT = "bg-warm text-warm-foreground border-warm-foreground/15";
const PILL_MEET = "bg-violet text-violet-foreground border-violet-foreground/15";
const PILL_NEG = "bg-red-50 text-red-700 border-red-200";
const PILL_NEUTRAL = "bg-muted text-muted-foreground border-border";
const PILL_INFO = "bg-cold text-cold-foreground border-cold-foreground/15";

export const STATUTS: StatutMeta[] = [
  { value: "nouveau", label: "Nouveau", classes: PILL_NEUTRAL },
  { value: "non_qualifie", label: "Non qualifié", classes: PILL_NEUTRAL },
  { value: "contacte", label: "Contacté", classes: PILL_WAIT },
  { value: "a_repondu", label: "A répondu", classes: PILL_INFO },
  { value: "info_request", label: "Demande d'info", classes: PILL_INFO },
  { value: "meeting", label: "Meeting", classes: PILL_MEET },
  { value: "rdv_pris", label: "RDV pris", classes: PILL_MEET },
  { value: "client", label: "Client", classes: PILL_POS },
  { value: "pas_de_reponse", label: "Pas de réponse", classes: PILL_NEUTRAL },
  { value: "pas_decisionnaire", label: "Pas décisionnaire", classes: PILL_WAIT },
  { value: "pas_interesse", label: "Pas intéressé", classes: PILL_NEG },
  { value: "perdu", label: "Perdu", classes: PILL_NEG },
];

export function statutMeta(value: string | null | undefined): StatutMeta {
  return (
    STATUTS.find((s) => s.value === value) ?? {
      value: value ?? "",
      label: value ?? "Nouveau",
      classes: PILL_NEUTRAL,
    }
  );
}

export function statutLabel(value: string | null): string {
  return statutMeta(value).label;
}

export function statutClasses(value: string | null): string {
  return statutMeta(value).classes;
}

/** Colonnes du pipeline (CRM) et statuts regroupés dans chacune. */
export const PIPELINE = [
  { id: "nouveau", label: "Nouveau", statuts: ["nouveau", "non_qualifie", ""] },
  { id: "contacte", label: "Contacté", statuts: ["contacte", "pas_de_reponse"] },
  { id: "a_repondu", label: "A répondu", statuts: ["a_repondu"] },
  { id: "info_request", label: "Demande d'info", statuts: ["info_request"] },
  { id: "meeting", label: "Meeting", statuts: ["meeting", "rdv_pris"] },
  { id: "client", label: "Client", statuts: ["client"] },
  { id: "perdu", label: "Perdu", statuts: ["perdu", "pas_interesse", "pas_decisionnaire"] },
] as const;

export function colonnePipeline(statut: string | null | undefined): string {
  const v = statut ?? "";
  return PIPELINE.find((c) => (c.statuts as readonly string[]).includes(v))?.id ?? "nouveau";
}

/* ------------------------- Classifications formulaire ------------------------ */

export const CLASSIFICATIONS = [
  { value: "chaud", label: "🔥 Chaud", classes: PILL_NEG },
  { value: "tiede", label: "🌤️ Tiède", classes: PILL_WAIT },
  { value: "froid", label: "❄️ Froid", classes: PILL_INFO },
] as const;

export function classificationMeta(value: string | null) {
  return (
    CLASSIFICATIONS.find((c) => c.value === value) ?? {
      value: value ?? "",
      label: value ?? "—",
      classes: PILL_NEUTRAL,
    }
  );
}

/* --------------------------- Classifications emails -------------------------- */

export const CLASSIFICATIONS_EMAIL = [
  { value: "interesse", label: "Intéressé", classes: PILL_POS },
  { value: "demande_info", label: "Demande d'info", classes: PILL_INFO },
  { value: "pas_interesse", label: "Pas intéressé", classes: PILL_NEG },
  { value: "absent_auto", label: "Absence auto", classes: PILL_NEUTRAL },
  { value: "autre", label: "Autre", classes: PILL_NEUTRAL },
] as const;

export function classificationEmailMeta(value: string | null) {
  return (
    CLASSIFICATIONS_EMAIL.find((c) => c.value === value) ?? {
      value: value ?? "autre",
      label: "Autre",
      classes: PILL_NEUTRAL,
    }
  );
}

/* --------------------------------- Campagnes --------------------------------- */

export const STATUTS_CAMPAGNE = [
  { value: "brouillon", label: "Brouillon", classes: PILL_NEUTRAL },
  { value: "en_cours", label: "En cours", classes: PILL_WAIT },
  { value: "en_pause", label: "En pause", classes: PILL_INFO },
  { value: "terminee", label: "Terminée", classes: PILL_POS },
] as const;

export function statutCampagneMeta(value: string | null) {
  return (
    STATUTS_CAMPAGNE.find((s) => s.value === value) ?? {
      value: value ?? "",
      label: value ?? "—",
      classes: PILL_NEUTRAL,
    }
  );
}

export const LIMITE_QUOTIDIENNE = 300;

/* ---------------------------------- Utils ------------------------------------ */

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

export function formatJour(value: string | null | undefined): string {
  if (!value) return "—";
  const d = new Date(value);
  if (Number.isNaN(d.getTime())) return value;
  return d.toLocaleDateString("fr-FR", { day: "2-digit", month: "short" });
}

export function extrait(text: string | null | undefined, max = 120): string {
  const t = (text ?? "").replace(/\s+/g, " ").trim();
  return t.length > max ? `${t.slice(0, max)}…` : t || "—";
}

// ——— Présence Google ———
export type PresenceGoogle = "avec" | "vide" | "sans";

export function presenceGoogle(
  note: string | null | undefined,
  avis: string | null | undefined,
): PresenceGoogle {
  if (!note) return "sans";
  return Number(avis ?? 0) > 0 ? "avec" : "vide";
}

export function googleMeta(note: string | null | undefined, avis: string | null | undefined) {
  const etat = presenceGoogle(note, avis);
  if (etat === "avec") {
    return {
      etat,
      label: `${note} ⭐ · ${Number(avis ?? 0)} avis`,
      classes: "border-emerald-200 bg-emerald-50 text-emerald-700",
    };
  }
  if (etat === "vide") {
    return {
      etat,
      label: "Fiche vide, 0 avis",
      classes: "border-orange-200 bg-orange-50 text-orange-700",
    };
  }
  return {
    etat,
    label: "Pas de fiche Google",
    classes: "border-orange-200 bg-orange-50 text-orange-700",
  };
}

export const FILTRES_GOOGLE = [
  { value: "tous", label: "Présence Google : tous" },
  { value: "avec", label: "Avec fiche Google" },
  { value: "sans", label: "Sans fiche Google" },
  { value: "vide", label: "Fiche vide (0 avis)" },
];

export function contactableViaReseaux(lead: {
  email?: string | null;
  instagram_url?: string | null;
  linkedin_url?: string | null;
  tiktok_url?: string | null;
  facebook_url?: string | null;
}): boolean {
  return (
    !lead.email &&
    Boolean(lead.instagram_url || lead.linkedin_url || lead.tiktok_url || lead.facebook_url)
  );
}
