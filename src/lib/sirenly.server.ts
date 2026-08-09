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

export async function enrichWithGoogle(
  lead: BodaccLead,
  apiKey: string,
): Promise<{ note_google: string; nb_avis_google: string; telephone: string }> {
  const empty = { note_google: "", nb_avis_google: "", telephone: "" };
  try {
    const search = new URL("https://maps.googleapis.com/maps/api/place/textsearch/json");
    search.searchParams.set("query", `${lead.nom} ${lead.commune}`);
    search.searchParams.set("key", apiKey);
    const res = await fetch(search.toString());
    if (!res.ok) return empty;
    const data = (await res.json()) as {
      results?: Array<{ place_id?: string; rating?: number; user_ratings_total?: number }>;
    };
    const first = data.results?.[0];
    if (!first) return empty;

    let telephone = "";
    if (first.place_id) {
      const details = new URL("https://maps.googleapis.com/maps/api/place/details/json");
      details.searchParams.set("place_id", first.place_id);
      details.searchParams.set("fields", "formatted_phone_number");
      details.searchParams.set("key", apiKey);
      const dRes = await fetch(details.toString());
      if (dRes.ok) {
        const dJson = (await dRes.json()) as {
          result?: { formatted_phone_number?: string };
        };
        telephone = dJson.result?.formatted_phone_number ?? "";
      }
    }

    return {
      note_google: first.rating != null ? String(first.rating) : "",
      nb_avis_google: first.user_ratings_total != null ? String(first.user_ratings_total) : "",
      telephone,
    };
  } catch {
    return empty;
  }
}
