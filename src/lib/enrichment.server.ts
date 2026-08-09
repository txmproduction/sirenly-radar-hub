/**
 * Cascade d'enrichissement email (8 étapes, arrêt au premier email valide).
 * Toutes les étapes sont "best effort" : une erreur réseau n'interrompt jamais la cascade.
 */

export type Presence = {
  email: string;
  email_source: string;
  site_web: string;
  telephone: string;
  facebook_url: string;
  instagram_url: string;
  linkedin_url: string;
  tiktok_url: string;
  fiches_annuaires: Array<{ source: string; url: string }>;
  tags: string[];
};

const EMAIL_RE = /[a-zA-Z0-9._%+-]+@[a-zA-Z0-9.-]+\.[a-zA-Z]{2,}/g;

const BLOQUES = [
  "noreply",
  "no-reply",
  "ne-pas-repondre",
  "nepasrepondre",
  "exemple",
  "example",
  "votre@",
  "@sentry",
  "@wixpress",
  "@2x",
];

const EXT_IMAGE = /\.(png|jpe?g|gif|webp|svg|css|js)$/i;

export function emailValide(email: string): boolean {
  const e = email.toLowerCase().trim();
  if (!e || e.length > 120) return false;
  if (EXT_IMAGE.test(e)) return false;
  return !BLOQUES.some((b) => e.includes(b));
}

export function extraireEmails(html: string): string[] {
  const out = new Set<string>();
  for (const m of html.matchAll(/mailto:([^"'?>\s]+)/gi)) {
    const v = decodeURIComponent(m[1] ?? "");
    if (emailValide(v)) out.add(v.toLowerCase());
  }
  for (const m of html.matchAll(EMAIL_RE)) {
    const v = m[0];
    if (emailValide(v)) out.add(v.toLowerCase());
  }
  return [...out];
}

async function getText(url: string, timeoutMs = 8000): Promise<string> {
  try {
    const ctrl = new AbortController();
    const t = setTimeout(() => ctrl.abort(), timeoutMs);
    const res = await fetch(url, {
      signal: ctrl.signal,
      redirect: "follow",
      headers: {
        "User-Agent":
          "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/124 Safari/537.36",
        "Accept-Language": "fr-FR,fr;q=0.9",
      },
    });
    clearTimeout(t);
    if (!res.ok) return "";
    const ct = res.headers.get("content-type") ?? "";
    if (ct && !/text|html|json|xml/i.test(ct)) return "";
    return (await res.text()).slice(0, 400_000);
  } catch {
    return "";
  }
}

function domaineDe(url: string): string {
  try {
    return new URL(url.startsWith("http") ? url : `https://${url}`).hostname.replace(/^www\./, "");
  } catch {
    return "";
  }
}

/* ---------------------------- Étape 1 : site web ---------------------------- */

const PAGES_CONTACT = [
  "",
  "/contact",
  "/contact-us",
  "/nous-contacter",
  "/mentions-legales",
  "/mentions-legales/",
];

async function etapeSiteWeb(site: string): Promise<string> {
  const base = site.replace(/\/+$/, "");
  for (const p of PAGES_CONTACT) {
    const html = await getText(`${base}${p}`);
    const found = extraireEmails(html);
    const dom = domaineDe(site);
    const prefere = found.find((e) => dom && e.endsWith(`@${dom}`)) ?? found[0];
    if (prefere) return prefere;
  }
  return "";
}

/* ------------------------------ Étape 2 : RDAP ------------------------------ */

async function etapeWhois(domaine: string): Promise<string> {
  if (!domaine) return "";
  const urls = domaine.endsWith(".fr")
    ? [`https://rdap.nic.fr/domain/${domaine}`, `https://rdap.org/domain/${domaine}`]
    : [`https://rdap.org/domain/${domaine}`];
  for (const u of urls) {
    const txt = await getText(u);
    if (!txt) continue;
    const found = extraireEmails(txt).filter((e) => !e.includes("abuse@") && !e.includes("nic.fr"));
    if (found[0]) return found[0];
  }
  return "";
}

/* ---------------------- Étapes 3/4 : annuaires & verticales ---------------------- */

type Annuaire = { source: string; domaine: string };

const ANNUAIRES_GENERALISTES: Annuaire[] = [
  { source: "Pages Jaunes", domaine: "pagesjaunes.fr" },
  { source: "118000", domaine: "118000.fr" },
  { source: "Hoodspot", domaine: "hoodspot.fr" },
  { source: "Justacote", domaine: "justacote.com" },
];

const VERTICALES: Array<{ mots: string[]; annuaires: Annuaire[] }> = [
  {
    mots: ["coiffure", "coiffeur", "beaute", "esthetique", "onglerie", "spa", "barbier", "bien-etre"],
    annuaires: [
      { source: "Planity", domaine: "planity.com" },
      { source: "Treatwell", domaine: "treatwell.fr" },
    ],
  },
  {
    mots: ["restaurant", "restauration", "pizzeria", "brasserie", "traiteur", "bar", "cafe"],
    annuaires: [
      { source: "TheFork", domaine: "thefork.fr" },
      { source: "TripAdvisor", domaine: "tripadvisor.fr" },
      { source: "Petit Futé", domaine: "petitfute.com" },
    ],
  },
  {
    mots: ["batiment", "btp", "macon", "plombier", "electricien", "menuisier", "peintre", "travaux", "artisan"],
    annuaires: [
      { source: "Travaux.com", domaine: "travaux.com" },
      { source: "Houzz", domaine: "houzz.fr" },
      { source: "PagesPro", domaine: "pagespro.com" },
    ],
  },
  {
    mots: ["sante", "infirmier", "kine", "medecin", "dentiste", "osteopathe", "paramedical", "pharmacie"],
    annuaires: [{ source: "Annuaire Santé", domaine: "annuairesante.ameli.fr" }],
  },
  {
    mots: ["auto", "garage", "carrosserie", "mecanique", "pneu", "vehicule"],
    annuaires: [{ source: "Vroomly", domaine: "vroomly.com" }],
  },
];

const RESEAUX: Array<{ cle: keyof Presence; domaine: string }> = [
  { cle: "facebook_url", domaine: "facebook.com" },
  { cle: "instagram_url", domaine: "instagram.com" },
  { cle: "linkedin_url", domaine: "linkedin.com" },
  { cle: "tiktok_url", domaine: "tiktok.com" },
];

/** Recherche web publique (DuckDuckGo HTML) — renvoie les URLs de résultats. */
async function rechercheWeb(query: string): Promise<{ html: string; urls: string[] }> {
  const html = await getText(`https://html.duckduckgo.com/html/?q=${encodeURIComponent(query)}`);
  const urls: string[] = [];
  for (const m of html.matchAll(/uddg=([^"&]+)/g)) {
    try {
      urls.push(decodeURIComponent(m[1] ?? ""));
    } catch {
      /* ignore */
    }
  }
  for (const m of html.matchAll(/href="(https?:\/\/[^"]+)"/g)) urls.push(m[1] ?? "");
  return { html, urls };
}

async function chercherFiche(nom: string, commune: string, a: Annuaire): Promise<string> {
  const { urls } = await rechercheWeb(`site:${a.domaine} ${nom} ${commune}`);
  return urls.find((u) => domaineDe(u).endsWith(a.domaine)) ?? "";
}

/* --------------------------- Étape 7 : MX + patterns --------------------------- */

async function aDesMX(domaine: string): Promise<boolean> {
  const txt = await getText(`https://dns.google/resolve?name=${domaine}&type=MX`);
  if (!txt) return false;
  try {
    const json = JSON.parse(txt) as { Answer?: Array<{ type: number }> };
    return Boolean(json.Answer?.some((a) => a.type === 15));
  } catch {
    return false;
  }
}

/* --------------------------------- Cascade --------------------------------- */

export async function enrichirPresence(lead: {
  nom: string;
  commune: string;
  activite: string;
  site_web?: string;
  telephone?: string;
}): Promise<Presence> {
  const p: Presence = {
    email: "",
    email_source: "",
    site_web: lead.site_web ?? "",
    telephone: lead.telephone ?? "",
    facebook_url: "",
    instagram_url: "",
    linkedin_url: "",
    tiktok_url: "",
    fiches_annuaires: [],
    tags: [],
  };

  const requete = `${lead.nom} ${lead.commune}`.trim();

  const poser = (email: string, source: string) => {
    if (!p.email && email && emailValide(email)) {
      p.email = email.toLowerCase();
      p.email_source = source;
    }
  };

  // Étape 1 — site web officiel
  if (p.site_web) poser(await etapeSiteWeb(p.site_web), "site_web");

  // Étape 2 — WHOIS / RDAP
  let domaine = domaineDe(p.site_web);
  if (!p.email && domaine) poser(await etapeWhois(domaine), "whois_rdap");

  // Étape 3 — annuaires généralistes
  for (const a of ANNUAIRES_GENERALISTES) {
    const url = await chercherFiche(lead.nom, lead.commune, a);
    if (!url) continue;
    p.fiches_annuaires.push({ source: a.source, url });
    if (p.email) continue;
    const emails = extraireEmails(await getText(url));
    if (emails[0]) poser(emails[0], `annuaire:${a.source}`);
  }

  // Étape 4 — plateformes sectorielles
  const hay = `${lead.activite} ${lead.nom}`
    .toLowerCase()
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "");
  const verticales = VERTICALES.filter((v) => v.mots.some((m) => hay.includes(m))).flatMap(
    (v) => v.annuaires,
  );
  for (const a of verticales) {
    const url = await chercherFiche(lead.nom, lead.commune, a);
    if (!url) continue;
    p.fiches_annuaires.push({ source: a.source, url });
    if (p.email) continue;
    const html = await getText(url);
    const emails = extraireEmails(html);
    if (emails[0]) poser(emails[0], `plateforme:${a.source}`);
    if (!p.telephone) {
      const tel = html.match(/0[1-9](?:[ .-]?\d{2}){4}/)?.[0] ?? "";
      if (tel) p.telephone = tel.replace(/[.-]/g, " ");
    }
  }

  // Étape 5 — réseaux sociaux (URLs toujours loggées, même sans email)
  for (const r of RESEAUX) {
    const url = await chercherFiche(lead.nom, lead.commune, {
      source: r.domaine,
      domaine: r.domaine,
    });
    if (!url) continue;
    (p[r.cle] as string) = url;
    if (p.email || r.domaine !== "facebook.com") continue;
    const about = await getText(url.replace(/\/?$/, "/about"));
    const emails = extraireEmails(about);
    if (emails[0]) poser(emails[0], "facebook");
  }

  // Étape 6 — recherche web directe
  if (!p.email) {
    for (const variante of [`"${lead.nom}" "${lead.commune}" "@"`, `"${lead.nom}" ${lead.commune} email contact`]) {
      const { html, urls } = await rechercheWeb(variante);
      const emails = extraireEmails(html);
      if (emails[0]) {
        poser(emails[0], "recherche_web");
        break;
      }
      const premier = urls.find((u) => /^https?:\/\//.test(u));
      if (premier) {
        const page = extraireEmails(await getText(premier));
        if (page[0]) {
          poser(page[0], "recherche_web");
          break;
        }
      }
    }
  }

  // Étape 7 — déduction + vérification MX (pas de SMTP sortant sur l'infra edge)
  if (!p.email && !domaine && p.fiches_annuaires.length === 0) domaine = "";
  if (!p.email && domaine && (await aDesMX(domaine))) {
    poser(`contact@${domaine}`, "deduction_mx");
  }

  // Étape 8 — échec
  const reseaux = [p.facebook_url, p.instagram_url, p.linkedin_url, p.tiktok_url].filter(Boolean);
  if (!p.email) {
    p.tags.push("telephone_uniquement");
    if (reseaux.length) p.tags.push("contactable_via_reseaux");
  }

  return p;
}
