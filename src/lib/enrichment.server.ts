/**
 * Cascade d'enrichissement email (8 étapes, arrêt au premier email valide).
 * Toutes les étapes sont "best effort" : une erreur réseau n'interrompt jamais la cascade.
 *
 * RÈGLE D'OR (anti faux positifs) : aucune donnée (email, téléphone, fiche, réseau
 * social) n'est acceptée sans avoir vérifié que la page source correspond bien à
 * l'entreprise du lead (nom + commune). En cas de doute : on ne remonte RIEN.
 * Un champ vide est récupérable ; un champ faux détruit la crédibilité du fichier.
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

/** Domaines techniques / moteurs de recherche / plateformes : jamais un email d'entreprise. */
export const DOMAINES_BLOQUES = [
  "duckduckgo.com",
  "google.com",
  "googlemail.com",
  "gstatic.com",
  "bing.com",
  "microsoft.com",
  "yahoo.com",
  "yandex.com",
  "ecosia.org",
  "qwant.com",
  "brave.com",
  "startpage.com",
  "lilo.org",
  "search.marcia.com",
  "sentry.io",
  "wixpress.com",
  "wix.com",
  "squarespace.com",
  "shopify.com",
  "wordpress.com",
  "cloudflare.com",
  "godaddy.com",
  "ovh.net",
  "ovh.com",
  "gandi.net",
  "amen.fr",
  "ionos.fr",
  "ionos.com",
  "1and1.fr",
  "1and1.com",
  "online.net",
  "scaleway.com",
  "namecheap.com",
  "key-systems.net",
  "netim.com",
  "netim.fr",
  "sitew.com",
  "jimdo.com",
  "weebly.com",
  "facebook.com",
  "instagram.com",
  "linkedin.com",
  "tiktok.com",
  "twitter.com",
  "x.com",
  "domain.com",
  "email.com",
  "test.com",
  "localhost",
];

/** Parties locales génériques de plateforme (jamais un contact commercial réel). */
const LOCALES_BLOQUEES = [
  "error",
  "error-lite",
  "noreply",
  "no-reply",
  "donotreply",
  "postmaster",
  "abuse",
  "webmaster",
  "hostmaster",
  "mailer-daemon",
  "privacy",
  "dpo",
  "sentry",
  "wordpress",
  "root",
  "admin@localhost",
];

const EXT_IMAGE = /\.(png|jpe?g|gif|webp|svg|css|js)$/i;

export function emailValide(email: string): boolean {
  const e = email.toLowerCase().trim();
  if (!e || e.length > 120) return false;
  if (EXT_IMAGE.test(e)) return false;
  if (BLOQUES.some((b) => e.includes(b))) return false;

  const [locale = "", domaine = ""] = e.split("@");
  if (!locale || !domaine || !domaine.includes(".")) return false;
  if (LOCALES_BLOQUEES.includes(locale)) return false;
  if (/^support@(le)?moteur/.test(e)) return false;
  return !DOMAINES_BLOQUES.some((d) => domaine === d || domaine.endsWith(`.${d}`));
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

/* ----------------------- Vérification d'identité du lead ----------------------- */

function normaliser(s: string): string {
  return s
    .toLowerCase()
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "")
    .replace(/[^a-z0-9\s@.-]/g, " ")
    .replace(/\s+/g, " ")
    .trim();
}

/** Mots sans valeur d'identification (formes juridiques, civilités, mots génériques). */
const MOTS_VIDES = new Set([
  "sarl",
  "sas",
  "sasu",
  "eurl",
  "sci",
  "snc",
  "selarl",
  "societe",
  "entreprise",
  "ets",
  "etablissements",
  "monsieur",
  "madame",
  "mademoiselle",
  "les",
  "des",
  "the",
  "and",
  "chez",
  "france",
]);

/**
 * Tokens significatifs du nom de l'entreprise : mots de 3+ caractères, hors
 * formes juridiques et mots génériques. C'est la "signature" du lead qu'on
 * exige de retrouver dans toute page/URL avant d'en accepter la moindre donnée.
 */
function tokensNom(nom: string): string[] {
  return normaliser(nom)
    .split(" ")
    .filter((t) => t.length >= 3 && !MOTS_VIDES.has(t));
}

/** Vrai si le texte (normalisé) contient au moins un token du nom. */
function contientNom(texte: string, tokens: string[]): boolean {
  if (tokens.length === 0) return false;
  const t = normaliser(texte);
  return tokens.some((tok) => t.includes(tok));
}

/** Vrai si le texte (normalisé) contient la commune du lead. */
function contientCommune(texte: string, commune: string): boolean {
  const c = normaliser(commune);
  if (!c) return false;
  return normaliser(texte).includes(c);
}

/**
 * Une page tierce (annuaire, plateforme, réseau social, résultat de recherche)
 * n'est considérée comme étant LA fiche du lead que si elle contient le nom
 * ET la commune. Les deux : un homonyme dans une autre ville a le nom, un
 * concurrent local a la commune — seul le bon établissement a les deux.
 */
function pageCorrespond(html: string, tokens: string[], commune: string): boolean {
  if (!html) return false;
  return contientNom(html, tokens) && contientCommune(html, commune);
}

/**
 * Le site officiel du lead peut légitimement ne pas mentionner la commune
 * (site vitrine minimaliste). Mais dans tous les cas, on vérifie la RACINE
 * du domaine (jamais l'URL profonde éventuellement fournie par Google, qui
 * peut très bien être une page disparue depuis) : si la racine ne répond
 * pas, le site est rejeté — impossible de garantir qu'il est en ligne.
 */
async function siteAppartientAuLead(
  site: string,
  tokens: string[],
  commune: string,
): Promise<{ ok: boolean; racine: string }> {
  const dom = domaineDe(site);
  if (!dom) return { ok: false, racine: "" };
  const racine = `https://${dom}/`;
  const html = await getText(racine);
  if (!html) return { ok: false, racine }; // racine injoignable : on ne peut rien garantir
  if (contientNom(dom.replace(/[.-]/g, " "), tokens)) return { ok: true, racine };
  return { ok: pageCorrespond(html, tokens, commune), racine };
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

/**
 * Cherche LA fiche du lead sur un annuaire/plateforme donné.
 * Contrairement à l'ancienne version (première URL du bon domaine = acceptée),
 * on teste jusqu'à 3 candidats et on ne retient une fiche que si :
 *   - son URL contient un token du nom (slug), ET
 *   - le CONTENU de la page contient nom + commune.
 * On renvoie aussi le HTML déjà téléchargé pour éviter un second fetch.
 */
async function chercherFiche(
  tokens: string[],
  commune: string,
  a: Annuaire,
  nom: string,
): Promise<{ url: string; html: string }> {
  const { urls } = await rechercheWeb(`site:${a.domaine} ${nom} ${commune}`);
  const candidats = urls.filter((u) => domaineDe(u).endsWith(a.domaine)).slice(0, 3);
  for (const url of candidats) {
    const html = await getText(url);
    // La vérification décisive est le CONTENU de la page : nom + commune.
    // (Le slug d'URL n'est pas fiable, certaines plateformes utilisent des IDs opaques.)
    if (pageCorrespond(html, tokens, commune)) {
      return { url, html };
    }
  }
  return { url: "", html: "" };
}

/** Extrait un téléphone français d'une page DÉJÀ vérifiée comme étant celle du lead. */
function extraireTelephone(html: string): string {
  const tel = html.match(/0[1-9](?:[ .-]?\d{2}){4}/)?.[0] ?? "";
  return tel ? tel.replace(/[.-]/g, " ") : "";
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

  const tokens = tokensNom(lead.nom);

  // Sans token identifiable, impossible de vérifier quoi que ce soit :
  // on ne tente AUCUN enrichissement tiers plutôt que de matcher au hasard.
  if (tokens.length === 0) {
    p.tags.push("nom_non_identifiable");
    if (!p.email) p.tags.push("telephone_uniquement");
    return p;
  }

  const poser = (email: string, source: string) => {
    if (!p.email && email && emailValide(email)) {
      p.email = email.toLowerCase();
      p.email_source = source;
    }
  };

  // Étape 0 — VALIDATION du site web fourni en entrée.
  // Le site peut venir d'un ancien enrichissement pollué (mauvais match Google
  // Places) : s'il n'appartient manifestement pas au lead, on le VIDE, ce qui
  // neutralise aussi les étapes 1, 2 et 7 qui en dépendent.
  if (p.site_web) {
    const { ok, racine } = await siteAppartientAuLead(p.site_web, tokens, lead.commune);
    if (!ok) {
      p.site_web = "";
      p.tags.push("site_web_rejete");
    } else {
      // On stocke la racine vérifiée (joignable), pas l'URL profonde d'origine
      // qui peut très bien avoir disparu (cas vécu : lien Google -> 404).
      p.site_web = racine;
    }
  }

  // Étape 1 — site web officiel (désormais garanti comme étant celui du lead)
  if (p.site_web) poser(await etapeSiteWeb(p.site_web), "site_web");

  // Étape 2 — WHOIS / RDAP (uniquement sur un domaine validé)
  const domaine = domaineDe(p.site_web);
  if (!p.email && domaine) poser(await etapeWhois(domaine), "whois_rdap");

  // Étape 3 — annuaires généralistes (fiche acceptée seulement si nom + commune vérifiés)
  for (const a of ANNUAIRES_GENERALISTES) {
    const fiche = await chercherFiche(tokens, lead.commune, a, lead.nom);
    if (!fiche.url) continue;
    p.fiches_annuaires.push({ source: a.source, url: fiche.url });
    if (!p.telephone) p.telephone = extraireTelephone(fiche.html);
    if (p.email) continue;
    const emails = extraireEmails(fiche.html);
    if (emails[0]) poser(emails[0], `annuaire:${a.source}`);
  }

  // Étape 4 — plateformes sectorielles (même règle de vérification)
  const hay = normaliser(`${lead.activite} ${lead.nom}`);
  const verticales = VERTICALES.filter((v) => v.mots.some((m) => hay.includes(m))).flatMap(
    (v) => v.annuaires,
  );
  for (const a of verticales) {
    const fiche = await chercherFiche(tokens, lead.commune, a, lead.nom);
    if (!fiche.url) continue;
    p.fiches_annuaires.push({ source: a.source, url: fiche.url });
    if (!p.telephone) p.telephone = extraireTelephone(fiche.html);
    if (p.email) continue;
    const emails = extraireEmails(fiche.html);
    if (emails[0]) poser(emails[0], `plateforme:${a.source}`);
  }

  // Étape 5 — réseaux sociaux : une URL n'est enregistrée que si la page du
  // profil contient nom + commune (fini les profils homonymes d'autres villes).
  for (const r of RESEAUX) {
    const fiche = await chercherFiche(
      tokens,
      lead.commune,
      { source: r.domaine, domaine: r.domaine },
      lead.nom,
    );
    if (!fiche.url) continue;
    (p[r.cle] as string) = fiche.url;
    if (p.email || r.domaine !== "facebook.com") continue;
    const about = await getText(fiche.url.replace(/\/?$/, "/about"));
    if (pageCorrespond(about, tokens, lead.commune) || contientNom(about, tokens)) {
      const emails = extraireEmails(about);
      if (emails[0]) poser(emails[0], "facebook");
    }
  }

  // Étape 6 — recherche web directe. L'ancienne version prenait le premier
  // email de la page de résultats (mélange de tous les résultats : n'importe
  // quel email pouvait remonter). Désormais :
  //   - on n'extrait JAMAIS d'email du HTML brut de la page de résultats ;
  //   - on visite jusqu'à 3 pages candidates, et on n'accepte un email que si
  //     la page contient nom + commune, OU si le domaine de l'email contient
  //     lui-même un token du nom (ex : contact@mejdicoiffure.fr).
  if (!p.email) {
    for (const variante of [
      `"${lead.nom}" "${lead.commune}" "@"`,
      `"${lead.nom}" ${lead.commune} email contact`,
    ]) {
      const { html, urls } = await rechercheWeb(variante);
      const utilisables = urls
        .filter(
          (u) => /^https?:\/\//.test(u) && !DOMAINES_BLOQUES.some((d) => domaineDe(u).endsWith(d)),
        )
        .slice(0, 3);
      if (!html || utilisables.length === 0) continue;

      for (const u of utilisables) {
        const page = await getText(u);
        if (!page) continue;
        const emails = extraireEmails(page);
        if (emails.length === 0) continue;
        const pageOk = pageCorrespond(page, tokens, lead.commune);
        const candidat = pageOk
          ? emails[0]
          : emails.find((e) => contientNom((e.split("@")[1] ?? "").replace(/[.-]/g, " "), tokens));
        if (candidat) {
          poser(candidat, "recherche_web");
          break;
        }
      }
      if (p.email) break;
    }
  }

  // Étape 7 — déduction contact@domaine + vérification MX.
  // Uniquement sur un domaine validé à l'étape 0 (donc appartenant au lead).
  if (!p.email && domaine && (await aDesMX(domaine))) {
    poser(`contact@${domaine}`, "deduction_mx");
  }

  // Étape 8 — bilan
  const reseaux = [p.facebook_url, p.instagram_url, p.linkedin_url, p.tiktok_url].filter(Boolean);
  if (!p.email) {
    p.tags.push("telephone_uniquement");
    if (reseaux.length) p.tags.push("contactable_via_reseaux");
  }

  return p;
}
