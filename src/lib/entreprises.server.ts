import type { BodaccLead } from "./sirenly.server";

export type EtablieLead = BodaccLead & { siren: string; effectif: string };

const TRANCHE_LABEL: Record<string, string> = {
  NN: "Non renseigné",
  "00": "0 salarié",
  "01": "1 ou 2 salariés",
  "02": "3 à 5 salariés",
  "03": "6 à 9 salariés",
  "11": "10 à 19 salariés",
  "12": "20 à 49 salariés",
  "21": "50 à 99 salariés",
  "22": "100 à 199 salariés",
  "31": "200 à 249 salariés",
  "32": "250 à 499 salariés",
  "41": "500 à 999 salariés",
  "42": "1000 à 1999 salariés",
};

/** Libellés INSEE des catégories juridiques les plus fréquentes (niveau III). */
const FORME_JURIDIQUE_LABEL: Record<string, string> = {
  "1000": "Entrepreneur individuel",
  "5202": "SNC",
  "5306": "Société en commandite simple",
  "5498": "SARL",
  "5499": "SARL",
  "5410": "SARL",
  "5415": "SARL",
  "5426": "SARL",
  "5458": "SARL",
  "5485": "SARL (SELARL)",
  "5505": "SA à conseil d'administration",
  "5510": "SA à conseil d'administration",
  "5599": "SA à conseil d'administration",
  "5699": "SA à directoire",
  "5710": "SAS",
  "5720": "SASU",
  "5785": "SAS (SELAS)",
  "5800": "Société européenne",
  "6220": "GIE",
  "6540": "SCI",
  "6521": "Société civile de placement immobilier",
  "6599": "Société civile",
  "9220": "Association déclarée",
  "5460": "SARL",
  "5470": "SARL",
};

function formeJuridique(libelle: string, code: string): string {
  if (libelle) return libelle;
  if (!code) return "";
  return FORME_JURIDIQUE_LABEL[code] ?? FORME_JURIDIQUE_LABEL[code.slice(0, 2) + "00"] ?? code;
}

type ApiEtab = {
  siege?: Record<string, unknown>;
  nom_complet?: string;
  nom_raison_sociale?: string;
  siren?: string;
  activite_principale?: string;
  tranche_effectif_salarie?: string;
  dirigeants?: Array<{ prenoms?: string; nom?: string }>;
  nature_juridique?: string;
  categorie_juridique_libelle?: string;
  libelle_nature_juridique?: string;
};

function s(v: unknown): string {
  return typeof v === "string" ? v.trim() : v == null ? "" : String(v);
}

function slug(nom: string, commune: string): string {
  return `${nom}-${commune}`
    .toLowerCase()
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "")
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/^-+|-+$/g, "")
    .slice(0, 120);
}

/** Codes de tranche d'effectif correspondant à 250 salariés et plus. */
const TRANCHES_GRANDES = ["32", "41", "42", "51", "52", "53"];

/** Mentions typiques de têtes de groupe / sièges nationaux. */
function estGrandGroupe(nom: string, trancheCode: string, seuilTranches: string[]): boolean {
  if (trancheCode && seuilTranches.includes(trancheCode)) return true;
  const n = nom.toUpperCase();
  if (/\b(OPCO|HOLDING|GROUPE)\b/.test(n)) return true;
  if (/\bFRANCE\s*$/.test(n)) return true;
  return false;
}

function departementDe(codePostal: string, dept: string): string {
  if (!codePostal) return "";
  if (dept.length === 3) return codePostal.slice(0, 3);
  return codePostal.slice(0, 2);
}

/**
 * API Recherche d'Entreprises (data.gouv) — entreprises établies.
 */
export async function fetchEntreprisesEtablies(params: {
  departement: string;
  naf: string[];
  termes: string[];
  effectifs: string[];
  limite?: number;
  /** Seuil d'exclusion des grands groupes (par défaut 250 salariés). */
  seuilEffectif?: number;
}): Promise<EtablieLead[]> {
  const out: EtablieLead[] = [];
  const seen = new Set<string>();
  const requetes: Array<{ q?: string; naf?: string }> = [];
  const seuil = params.seuilEffectif ?? 250;
  const seuilTranches =
    seuil <= 200
      ? ["31", ...TRANCHES_GRANDES]
      : seuil <= 250
        ? TRANCHES_GRANDES
        : TRANCHES_GRANDES.slice(1);
  const dept = params.departement.trim().toUpperCase();

  if (params.naf.length) {
    // L'API accepte une liste de codes NAF séparés par des virgules.
    requetes.push({ naf: params.naf.join(",") });
  }
  for (const terme of params.termes) requetes.push({ q: terme });
  if (!requetes.length) requetes.push({ q: "entreprise" });

  for (const req of requetes) {
    const url = new URL("https://recherche-entreprises.api.gouv.fr/search");
    if (req.q) url.searchParams.set("q", req.q);
    if (req.naf) url.searchParams.set("activite_principale", req.naf);
    if (dept) {
      url.searchParams.set("departement", dept);
      // Le filtre doit porter sur l'établissement retourné, pas seulement sur l'entreprise.
      url.searchParams.set("etat_administratif", "A");
    }
    if (params.effectifs.length)
      url.searchParams.set("tranche_effectif_salarie", params.effectifs.join(","));
    url.searchParams.set("etat_administratif", "A");
    url.searchParams.set("per_page", String(Math.min(params.limite ?? 25, 25)));
    url.searchParams.set("page", "1");

    const res = await fetch(url.toString());
    if (!res.ok) continue;
    const json = (await res.json()) as { results?: ApiEtab[] };
    for (const e of json.results ?? []) {
      const siege = e.siege ?? {};
      const nom = s(e.nom_complet) || s(e.nom_raison_sociale);
      const commune = s(siege["libelle_commune"]);
      const code_postal = s(siege["code_postal"]);
      if (!nom) continue;

      // 1) Filtre département strict (siège / établissement retourné).
      if (dept) {
        const deptEtab = s(siege["departement"]) || departementDe(code_postal, dept);
        if (deptEtab.toUpperCase() !== dept) continue;
      }

      // 2) Exclusion des grands groupes / sièges nationaux.
      const trancheCode = s(e.tranche_effectif_salarie) || s(siege["tranche_effectif_salarie"]);
      if (estGrandGroupe(nom, trancheCode, seuilTranches)) continue;

      const id = slug(nom, commune);
      if (seen.has(id)) continue;
      seen.add(id);
      const d = e.dirigeants?.[0];
      out.push({
        id,
        nom,
        contact: [s(d?.prenoms), s(d?.nom)].filter(Boolean).join(" "),
        activite: s(siege["libelle_activite_principale"]) || s(e.activite_principale),
        commune,
        code_postal,
        adresse: s(siege["adresse"]).replace(/\s+/g, " "),
        forme_juridique: formeJuridique(
          s(e.categorie_juridique_libelle) || s(e.libelle_nature_juridique),
          s(e.nature_juridique),
        ),
        siren: s(e.siren),
        effectif: TRANCHE_LABEL[trancheCode] ?? "Non renseigné",
      });
    }
  }

  return out;
}

