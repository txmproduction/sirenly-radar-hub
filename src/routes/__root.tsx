import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import {
  Outlet,
  Link,
  createRootRouteWithContext,
  useRouter,
  useRouterState,
  useNavigate,
  HeadContent,
  Scripts,
} from "@tanstack/react-router";
import {
  LayoutDashboard,
  Inbox,
  Users,
  Send,
  KanbanSquare,
  Settings,
  Radar as RadarIcon,
  Search,
  Menu,
  X,
} from "lucide-react";
import { useEffect, useState, type ReactNode } from "react";

import { Toaster } from "@/components/ui/sonner";
import logo from "../assets/sirenly-logo.jpg";
import appCss from "../styles.css?url";
import { reportLovableError } from "../lib/lovable-error-reporting";

function NotFoundComponent() {
  return (
    <div className="flex min-h-screen items-center justify-center bg-background px-4">
      <div className="max-w-md text-center">
        <h1 className="font-display text-7xl font-bold text-foreground">404</h1>
        <h2 className="mt-4 text-xl font-semibold">Page introuvable</h2>
        <p className="mt-2 text-sm text-muted-foreground">
          Cette page n'existe pas ou a été déplacée.
        </p>
        <div className="mt-6">
          <Link
            to="/"
            className="inline-flex items-center justify-center rounded-lg bg-primary px-4 py-2 text-sm font-medium text-primary-foreground hover:opacity-90"
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
        <h1 className="text-xl font-semibold tracking-tight">Cette page n'a pas pu se charger</h1>
        <p className="mt-2 text-sm text-muted-foreground">
          Une erreur est survenue. Réessayez ou revenez à l'accueil.
        </p>
        <div className="mt-6 flex flex-wrap justify-center gap-2">
          <button
            onClick={() => {
              router.invalidate();
              reset();
            }}
            className="inline-flex items-center justify-center rounded-lg bg-primary px-4 py-2 text-sm font-medium text-primary-foreground hover:opacity-90"
          >
            Réessayer
          </button>
          <a
            href="/"
            className="inline-flex items-center justify-center rounded-lg border border-input bg-card px-4 py-2 text-sm font-medium hover:bg-muted"
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
        content: "Sirenly : radar de leads, campagnes email IA, pipeline et suivi de prospection.",
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
    <html lang="fr">
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

type NavTo =
  | "/"
  | "/inbox"
  | "/leads"
  | "/campagnes"
  | "/pipeline"
  | "/parametres"
  | "/radar"
  | "/reponses";

type NavItem = { to: NavTo; label: string; icon: typeof LayoutDashboard };

const NAV: NavItem[] = [
  { to: "/", label: "Tableau de bord", icon: LayoutDashboard },
  { to: "/inbox", label: "Boîte principale", icon: Inbox },
  { to: "/leads", label: "Tous les leads", icon: Users },
  { to: "/campagnes", label: "Campagnes", icon: Send },
  { to: "/pipeline", label: "Pipeline", icon: KanbanSquare },
  { to: "/radar", label: "Génération", icon: RadarIcon },
  { to: "/reponses", label: "Réponses formulaire", icon: Search },
  { to: "/parametres", label: "Paramètres", icon: Settings },
];

function SidebarContent({ onNavigate }: { onNavigate?: () => void }) {
  const navigate = useNavigate();
  const [q, setQ] = useState("");

  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      if ((e.metaKey || e.ctrlKey) && e.key.toLowerCase() === "k") {
        e.preventDefault();
        document.getElementById("sirenly-search")?.focus();
      }
    };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, []);

  return (
    <div className="flex h-full flex-col">
      <div className="flex items-center gap-2.5 px-5 py-5">
        <img src={logo} alt="Logo Sirenly" className="size-8 rounded-lg object-cover" />
        <span className="font-display text-lg font-bold tracking-tight">Sirenly</span>
      </div>

      <div className="px-4 pb-4">
        <form
          onSubmit={(e) => {
            e.preventDefault();
            onNavigate?.();
            void navigate({ to: "/leads", search: { q } });
          }}
          className="relative"
        >
          <Search className="pointer-events-none absolute left-3 top-1/2 size-4 -translate-y-1/2 text-muted-foreground" />
          <input
            id="sirenly-search"
            value={q}
            onChange={(e) => setQ(e.target.value)}
            placeholder="Rechercher…"
            className="h-9 w-full rounded-lg border border-border bg-background pl-9 pr-12 text-sm outline-none placeholder:text-muted-foreground focus:border-primary"
          />
          <kbd className="pointer-events-none absolute right-2 top-1/2 -translate-y-1/2 rounded border border-border bg-muted px-1.5 py-0.5 text-[10px] text-muted-foreground">
            ⌘K
          </kbd>
        </form>
      </div>

      <nav className="flex-1 overflow-y-auto px-3">
        <p className="mb-2 px-3 text-[10px] font-semibold uppercase tracking-[0.14em] text-muted-foreground">
          Workspace
        </p>
        <div className="space-y-0.5">
          {NAV.map(({ to, label, icon: Icon }) => (
            <Link
              key={to}
              to={to}
              onClick={onNavigate}
              activeOptions={{ exact: to === "/" }}
              activeProps={{ className: "bg-primary-soft text-primary-strong" }}
              inactiveProps={{ className: "text-sidebar-foreground hover:bg-muted" }}
              className="group flex items-center gap-3 rounded-lg px-3 py-2.5 text-sm font-medium transition-colors"
            >
              {({ isActive }: { isActive: boolean }) => (
                <>
                  <Icon className={isActive ? "size-4 text-primary" : "size-4 text-muted-foreground"} />
                  <span className="truncate">{label}</span>
                </>
              )}
            </Link>
          ))}
        </div>
      </nav>

      <div className="p-4">
        <p className="text-[11px] text-muted-foreground">
          BODACC · Recherche d'Entreprises · Google Places
        </p>
      </div>
    </div>
  );
}

function Shell({ children }: { children: ReactNode }) {
  const [open, setOpen] = useState(false);
  const pathname = useRouterState({ select: (s) => s.location.pathname });

  useEffect(() => {
    setOpen(false);
  }, [pathname]);

  return (
    <div className="flex min-h-screen w-full bg-background text-foreground">
      <aside className="sticky top-0 hidden h-screen w-60 shrink-0 border-r border-sidebar-border bg-sidebar lg:block">
        <SidebarContent />
      </aside>

      {open && (
        <div className="fixed inset-0 z-40 lg:hidden">
          <button
            aria-label="Fermer le menu"
            className="absolute inset-0 bg-foreground/20"
            onClick={() => setOpen(false)}
          />
          <div className="absolute left-0 top-0 h-full w-64 border-r border-sidebar-border bg-sidebar">
            <SidebarContent onNavigate={() => setOpen(false)} />
          </div>
        </div>
      )}

      <div className="flex min-w-0 flex-1 flex-col">
        <div className="sticky top-0 z-30 flex items-center gap-3 border-b border-border bg-background/90 px-4 py-3 backdrop-blur lg:hidden">
          <button
            onClick={() => setOpen((v) => !v)}
            aria-label="Menu"
            className="grid size-9 place-items-center rounded-lg border border-border"
          >
            {open ? <X className="size-4" /> : <Menu className="size-4" />}
          </button>
          <img src={logo} alt="Logo Sirenly" className="size-7 rounded-md object-cover" />
          <span className="font-display font-bold">Sirenly</span>
        </div>
        <main className="min-w-0 flex-1 px-4 py-6 sm:px-8 sm:py-8">{children}</main>
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
