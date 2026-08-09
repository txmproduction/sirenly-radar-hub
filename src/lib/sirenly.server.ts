export type BodaccLead = {
  id: string;
  nom: string;
  contact: string;
  activite: string;
  commune: string;
  code_postal: string;
  adresse: string;
  forme_juridique: string;
};

const EXCLUSIONS = [
  "holding",
  "portage",
  "gestion de participations",
  "societe civile immobiliere",
  "société civile immobilière",
  "coursier",
  "livreur",
  "livraison de repas",
  "uber eats",
  "à vélo",
  "a velo",
];

export function normalize(value: string): string {
  return (value ?? "")
    .toLowerCase()
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "");
}

export function isExcluded(...values: string[]): boolean {
  const haystack = normalize(values.filter(Boolean).join(" "));
  return EXCLUSIONS.some((term) => haystack.includes(normalize(term)));
}

export function slugify(nom: string, commune: string): string {
  return normalize(`${nom}-${commune}`)
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/^-+|-+$/g, "")
    .slice(0, 120);
}

export function dateDepuis(jours: number): string {
  const d = new Date();
  d.setDate(d.getDate() - Math.max(1, jours));
  return d.toISOString().slice(0, 10);
}

type BodaccRecord = Record<string, unknown>;

function asObject(value: unknown): Record<string, unknown> {
  if (typeof value === "string") {
    try {
      return JSON.parse(value) as Record<string, unknown>;
    } catch {
      return {};
    }
  }
  if (value && typeof value === "object") return value as Record<string, unknown>;
  return {};
}

function str(value: unknown): string {
  return typeof value === "string" ? value.trim() : value == null ? "" : String(value);
}

export function mapRecord(record: BodaccRecord): BodaccLead | null {
  const personne = asObject(record["listepersonnes"]);
  const p = asObject(
    (asObject(personne["personne"]) as Record<string, unknown>) ?? personne["personne"],
  );
  const identite = asObject(p["identite"] ?? p);
  const morale = asObject(identite["identitePM"] ?? identite["personneMorale"]);
  const physique = asObject(identite["identitePP"] ?? identite["personnePhysique"]);
  const adresseObj = asObject(p["adresse"] ?? personne["adresse"]);

  const nom =
    str(morale["denomination"]) ||
    str(record["commercant"]) ||
    [str(physique["prenom"]), str(physique["nom"])].filter(Boolean).join(" ");
  if (!nom) return null;

  const contact = [str(physique["prenom"]), str(physique["nom"])].filter(Boolean).join(" ");
  const activite =
    str(p["activite"]) || str(morale["activite"]) || str(record["cat"]) || str(record["depot"]);
  const commune = str(adresseObj["ville"]) || str(record["ville"]);
  const code_postal = str(adresseObj["codePostal"]) || str(record["cp"]);
  const adresse = [
    str(adresseObj["numeroVoie"]),
    str(adresseObj["typeVoie"]),
    str(adresseObj["nomVoie"]),
  ]
    .filter(Boolean)
    .join(" ");
  const forme_juridique = str(morale["formeJuridique"]) || str(p["formeJuridique"]);

  if (isExcluded(activite, forme_juridique, nom)) return null;

  return {
    id: slugify(nom, commune),
    nom,
    contact,
    activite,
    commune,
    code_postal,
    adresse,
    forme_juridique,
  };
}

export async function fetchBodacc(departement: string, jours: number): Promise<BodaccLead[]> {
  const since = dateDepuis(jours);
  const where = `numerodepartement="${departement.replace(/"/g, "")}" AND familleavis_lib="Créations" AND dateparution>=date'${since}'`;
  const url = new URL(
    "https://bodacc-datadila.opendatasoft.com/api/explore/v2.1/catalog/datasets/annonces-commerciales/records",
  );
  url.searchParams.set("where", where);
  url.searchParams.set("limit", "100");
  url.searchParams.set("order_by", "dateparution DESC");

  const res = await fetch(url.toString());
  if (!res.ok) {
    throw new Error(`BODACC ${res.status}: ${await res.text()}`);
  }
  const json = (await res.json()) as { results?: BodaccRecord[] };
  const out: BodaccLead[] = [];
  const seen = new Set<string>();
  for (const record of json.results ?? []) {
    const lead = mapRecord(record);
    if (!lead || !lead.id || seen.has(lead.id)) continue;
    seen.add(lead.id);
    out.push(lead);
  }
  return out;
}

/** Normalise pour comparaison : minuscule, sans accents, espaces multiples réduits. */
function normaliser(s: string): string {
  return s
    .toLowerCase()
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "")
    .replace(/\s+/g, " ")
    .trim();
}

/** Mots de voirie/résidence : trop génériques pour identifier une adresse précise. */
const MOTS_VOIE = new Set([
  "rue",
  "avenue",
  "chemin",
  "route",
  "impasse",
  "allee",
  "boulevard",
  "place",
  "quai",
  "cours",
  "res",
  "residence",
  "lot",
  "lotissement",
  "zi",
  "za",
  "zac",
  "imp",
  "bd",
  "av",
  "chem",
  "voie",
  "square",
  "villa",
  "passage",
  "cite",
  "hameau",
  "les",
  "le",
  "la",
  "du",
  "de",
  "des",
  "aux",
]);

/** Tokens significatifs d'une adresse (nom de rue), hors mots de voirie génériques. */
function tokensAdresse(adresse: string): string[] {
  return normaliser(adresse)
    .split(" ")
    .filter((t) => t.length >= 3 && !MOTS_VOIE.has(t) && !/^\d+$/.test(t));
}

/**
 * Vrai si l'adresse Google correspond bien à celle du lead.
 * La commune/CP seuls ne suffisent PAS : deux établissements différents
 * peuvent être dans la même ville (cas vécu : un entrepreneur individuel
 * confondu avec la marque SIMOND, toutes deux à Chamonix-Mont-Blanc).
 * On exige donc EN PLUS un recoupement sur le nom de rue quand le lead a
 * une adresse exploitable.
 */
function adresseCorrespond(formattedAddress: string, lead: BodaccLead): boolean {
  const addr = normaliser(formattedAddress);
  const commune = normaliser(lead.commune);
  const cp = (lead.code_postal ?? "").trim();
  const communeOk = Boolean(commune && addr.includes(commune)) || Boolean(cp && addr.includes(cp));
  if (!communeOk) return false;

  const tokensRue = tokensAdresse(lead.adresse ?? "");
  if (tokensRue.length === 0) return true; // pas d'adresse précise en base : commune seule fait foi
  return tokensRue.some((t) => addr.includes(t));
}

export async function enrichWithGoogle(
  lead: BodaccLead,
  apiKey: string,
): Promise<{
  note_google: string;
  nb_avis_google: string;
  telephone: string;
  site_web: string;
}> {
  const empty = { note_google: "", nb_avis_google: "", telephone: "", site_web: "" };
  try {
    const search = new URL("https://maps.googleapis.com/maps/api/place/textsearch/json");
    search.searchParams.set("query", `${lead.nom} ${lead.commune}`);
    search.searchParams.set("key", apiKey);
    const res = await fetch(search.toString());
    if (!res.ok) return empty;
    const data = (await res.json()) as {
      results?: Array<{
        place_id?: string;
        rating?: number;
        user_ratings_total?: number;
        formatted_address?: string;
      }>;
    };

    // On ne prend plus le premier résultat au hasard : on cherche le premier
    // résultat (parmi les 5 premiers) dont l'adresse correspond bien à la
    // commune/code postal du lead. Sans correspondance, on ne remonte rien
    // plutôt que de coller les infos d'un établissement sans rapport.
    const candidats = (data.results ?? []).slice(0, 5);
    const match = candidats.find((c) => adresseCorrespond(c.formatted_address ?? "", lead));
    if (!match) return empty;

    let telephone = "";
    let site_web = "";
    if (match.place_id) {
      const details = new URL("https://maps.googleapis.com/maps/api/place/details/json");
      details.searchParams.set("place_id", match.place_id);
      details.searchParams.set("fields", "formatted_phone_number,website,formatted_address");
      details.searchParams.set("key", apiKey);
      const dRes = await fetch(details.toString());
      if (dRes.ok) {
        const dJson = (await dRes.json()) as {
          result?: {
            formatted_phone_number?: string;
            website?: string;
            formatted_address?: string;
          };
        };
        // Double vérification sur la fiche détaillée : l'adresse peut différer
        // de celle du résultat de recherche (établissements multi-adresses).
        const detailAddr = dJson.result?.formatted_address ?? "";
        if (detailAddr && !adresseCorrespond(detailAddr, lead)) return empty;
        telephone = dJson.result?.formatted_phone_number ?? "";
        // On garde la racine du domaine, pas l'URL profonde que Google peut
        // renvoyer (ex : une page "histoire de l'entreprise" qui a disparu
        // depuis) — la racine a beaucoup plus de chances d'être toujours en ligne.
        const websiteBrut = dJson.result?.website ?? "";
        try {
          site_web = websiteBrut ? new URL(websiteBrut).origin + "/" : "";
        } catch {
          site_web = websiteBrut;
        }
      }
    }

    return {
      note_google: match.rating != null ? String(match.rating) : "",
      nb_avis_google: match.user_ratings_total != null ? String(match.user_ratings_total) : "",
      telephone,
      site_web,
    };
  } catch {
    return empty;
  }
}
