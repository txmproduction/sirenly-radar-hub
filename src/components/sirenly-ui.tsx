import type { LucideIcon } from "lucide-react";
import type { ReactNode } from "react";

import { cn } from "@/lib/utils";

export function PageHeader({
  titre,
  sousTitre,
  actions,
}: {
  titre: string;
  sousTitre?: string;
  actions?: ReactNode;
}) {
  return (
    <header className="grid grid-cols-[minmax(0,1fr)_auto] items-start gap-4 sm:flex sm:items-center sm:justify-between">
      <div className="min-w-0">
        <h1 className="truncate font-display text-2xl font-bold tracking-tight sm:text-3xl">
          {titre}
        </h1>
        {sousTitre && <p className="mt-1 text-sm text-muted-foreground">{sousTitre}</p>}
      </div>
      {actions && <div className="flex shrink-0 flex-wrap items-center gap-2">{actions}</div>}
    </header>
  );
}

export function StatCard({
  icon: Icon,
  valeur,
  libelle,
}: {
  icon: LucideIcon;
  valeur: ReactNode;
  libelle: string;
}) {
  return (
    <div className="panel p-5">
      <div className="grid size-10 place-items-center rounded-xl bg-primary-soft">
        <Icon className="size-5 text-primary" />
      </div>
      <p className="mt-4 font-display text-3xl font-bold leading-none">{valeur}</p>
      <p className="mt-2 text-sm text-muted-foreground">{libelle}</p>
    </div>
  );
}

export function Pill({ label, classes }: { label: string; classes: string }) {
  return (
    <span
      className={cn(
        "inline-flex items-center whitespace-nowrap rounded-full border px-2.5 py-0.5 text-xs font-medium",
        classes,
      )}
    >
      {label}
    </span>
  );
}

export function EmptyState({ titre, texte }: { titre: string; texte?: string }) {
  return (
    <div className="grid place-items-center rounded-xl border border-dashed border-border bg-muted/40 px-6 py-12 text-center">
      <p className="text-sm font-medium">{titre}</p>
      {texte && <p className="mt-1 max-w-sm text-xs text-muted-foreground">{texte}</p>}
    </div>
  );
}
