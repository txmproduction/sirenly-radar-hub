import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import {
  Outlet,
  Link,
  createRootRouteWithContext,
  useRouter,
  HeadContent,
  Scripts,
} from "@tanstack/react-router";
import { LayoutDashboard, Radar, Users, MessageSquareText } from "lucide-react";
import { useEffect, type ReactNode } from "react";

import { Toaster } from "@/components/ui/sonner";
import logo from "../assets/sirenly-logo.jpg";
import appCss from "../styles.css?url";
import { reportLovableError } from "../lib/lovable-error-reporting";

function NotFoundComponent() {
  return (
    <div className="flex min-h-screen items-center justify-center bg-background px-4">
      <div className="max-w-md text-center">
        <h1 className="text-7xl font-bold text-foreground">404</h1>
        <h2 className="mt-4 text-xl font-semibold text-foreground">Page introuvable</h2>
        <p className="mt-2 text-sm text-muted-foreground">
          Cette page n'existe pas ou a été déplacée.
        </p>
        <div className="mt-6">
          <Link
            to="/"
            className="inline-flex items-center justify-center rounded-md bg-primary px-4 py-2 text-sm font-medium text-primary-foreground transition-colors hover:bg-primary/90"
          >
            Retour au tableau de bord
          </Link>
        </div>
      </div>
    </div>
  );
}

function ErrorComponent({ error, reset }: { error: Error; reset: () => void }) {
  console.error(error);
  const router = useRouter();
  useEffect(() => {
    reportLovableError(error, { boundary: "tanstack_root_error_component" });
  }, [error]);

  return (
    <div className="flex min-h-screen items-center justify-center bg-background px-4">
      <div className="max-w-md text-center">
        <h1 className="text-xl font-semibold tracking-tight text-foreground">
          Cette page n'a pas pu se charger
        </h1>
        <p className="mt-2 text-sm text-muted-foreground">
          Une erreur est survenue. Réessayez ou revenez à l'accueil.
        </p>
        <div className="mt-6 flex flex-wrap justify-center gap-2">
          <button
            onClick={() => {
              router.invalidate();
              reset();
            }}
            className="inline-flex items-center justify-center rounded-md bg-primary px-4 py-2 text-sm font-medium text-primary-foreground transition-colors hover:bg-primary/90"
          >
            Réessayer
          </button>
          <a
            href="/"
            className="inline-flex items-center justify-center rounded-md border border-input bg-background px-4 py-2 text-sm font-medium text-foreground transition-colors hover:bg-accent/10"
          >
            Accueil
          </a>
        </div>
      </div>
    </div>
  );
}

export const Route = createRootRouteWithContext<{ queryClient: QueryClient }>()({
  head: () => ({
    meta: [
      { charSet: "utf-8" },
      { name: "viewport", content: "width=device-width, initial-scale=1" },
      { title: "Sirenly — Prospection B2B" },
      {
        name: "description",
        content: "Sirenly : radar de leads BODACC, qualification et suivi de prospection B2B.",
      },
      { property: "og:type", content: "website" },
      { name: "twitter:card", content: "summary_large_image" },
    ],
    links: [
      { rel: "stylesheet", href: appCss },
      { rel: "icon", type: "image/png", href: "/favicon.png" },
      { rel: "preconnect", href: "https://fonts.googleapis.com" },
      { rel: "preconnect", href: "https://fonts.gstatic.com", crossOrigin: "anonymous" },
      {
        rel: "stylesheet",
        href: "https://fonts.googleapis.com/css2?family=Urbanist:wght@600;700;800&family=Epilogue:wght@300;400;500;600&display=swap",
      },
    ],

  }),
  shellComponent: RootShell,
  component: RootComponent,
  notFoundComponent: NotFoundComponent,
  errorComponent: ErrorComponent,
});

function RootShell({ children }: { children: ReactNode }) {
  return (
    <html lang="fr" className="dark">
      <head>
        <HeadContent />
      </head>
      <body>
        {children}
        <Scripts />
      </body>
    </html>
  );
}

const NAV = [
  {
    section: "Pilotage",
    items: [
      { to: "/", label: "Tableau de bord", icon: LayoutDashboard, title: "Vue d'ensemble" },
      { to: "/radar", label: "Génération", icon: Radar, title: "Génération de leads" },
    ],
  },
  {
    section: "Leads",
    items: [
      { to: "/leads", label: "Qualification", icon: Users, title: "Qualification des leads" },
      { to: "/reponses", label: "Réponses", icon: MessageSquareText, title: "Réponses formulaire" },
    ],
  },
] as const;

const ALL_NAV = NAV.flatMap((g) => g.items);

function Shell({ children }: { children: ReactNode }) {
  const pathname = useRouterState({ select: (s) => s.location.pathname });
  const current =
    ALL_NAV.filter((i) => (i.to === "/" ? pathname === "/" : pathname.startsWith(i.to))).sort(
      (a, b) => b.to.length - a.to.length,
    )[0] ?? ALL_NAV[0];

  return (
    <div className="flex min-h-screen w-full bg-background text-foreground">
      <aside className="sticky top-0 hidden h-screen w-[17rem] shrink-0 flex-col border-r border-sidebar-border bg-sidebar lg:flex">
        <div className="flex items-center gap-3 px-7 py-7">
          <img
            src={logo}
            alt="Logo Sirenly"
            className="size-9 rounded-xl object-cover ring-1 ring-border"
          />
          <span className="font-display text-xl font-bold tracking-tight">Sirenly</span>
        </div>

        <nav className="flex-1 space-y-7 px-4">
          {NAV.map((group) => (
            <div key={group.section}>
              <p className="mb-3 px-3 text-[10px] font-bold uppercase tracking-[0.2em] text-primary">
                {group.section}
              </p>
              <div className="space-y-1.5">
                {group.items.map(({ to, label, icon: Icon }) => (
                  <Link
                    key={to}
                    to={to}
                    activeOptions={{ exact: to === "/" }}
                    activeProps={{
                      className: "bg-secondary/50 text-foreground border-primary/30",
                    }}
                    inactiveProps={{
                      className:
                        "border-transparent text-muted-foreground hover:bg-card hover:text-foreground",
                    }}
                    className="flex items-center gap-3 rounded-xl border px-4 py-3 text-sm font-medium transition-colors"
                  >
                    <Icon className="size-5 shrink-0" />
                    <span className="truncate">{label}</span>
                  </Link>
                ))}
              </div>
            </div>
          ))}
        </nav>

        <div className="mt-auto p-4">
          <div className="rounded-2xl border border-border bg-card p-4">
            <p className="text-[10px] font-bold uppercase tracking-[0.2em] text-muted-foreground">
              Source de données
            </p>
            <p className="mt-2 text-sm font-semibold">BODACC · Google Places</p>
            <p className="mt-1 text-xs text-muted-foreground">Synchronisation temps réel active</p>
          </div>
        </div>
      </aside>

      <div className="flex min-w-0 flex-1 flex-col">
        <header className="sticky top-0 z-20 border-b border-border bg-background/80 backdrop-blur-md">
          <div className="grid grid-cols-[minmax(0,1fr)_auto] items-center gap-4 px-5 py-4 sm:px-10">
            <div className="flex min-w-0 items-center gap-3">
              <img
                src={logo}
                alt="Logo Sirenly"
                className="size-8 shrink-0 rounded-lg object-cover ring-1 ring-border lg:hidden"
              />
              <h1 className="truncate font-display text-xl font-bold sm:text-2xl">
                {current.title}
              </h1>
            </div>
            <Link
              to="/radar"
              className="shrink-0 rounded-xl bg-primary px-4 py-2.5 text-sm font-semibold text-primary-foreground shadow-[var(--shadow-glow)] transition-colors hover:bg-primary/90 sm:px-5"
            >
              Lancer le radar
            </Link>
          </div>
          <nav className="flex gap-1.5 overflow-x-auto px-4 pb-3 lg:hidden">
            {ALL_NAV.map(({ to, label, icon: Icon }) => (
              <Link
                key={to}
                to={to}
                activeOptions={{ exact: to === "/" }}
                activeProps={{ className: "bg-secondary/50 text-foreground border-primary/30" }}
                inactiveProps={{
                  className: "border-transparent text-muted-foreground hover:text-foreground",
                }}
                className="flex items-center gap-2 whitespace-nowrap rounded-lg border px-3 py-2 text-sm font-medium transition-colors"
              >
                <Icon className="size-4" />
                {label}
              </Link>
            ))}
          </nav>
        </header>
        <main className="min-w-0 flex-1 px-5 py-8 sm:px-10">{children}</main>
      </div>
      <Toaster position="top-right" richColors />
    </div>
  );
}


function RootComponent() {
  const { queryClient } = Route.useRouteContext();

  return (
    <QueryClientProvider client={queryClient}>
      <Shell>
        {/* Required: nested routes render here. Removing <Outlet /> breaks all child routes. */}
        <Outlet />
      </Shell>
    </QueryClientProvider>
  );
}
