export type Secteur = {
  id: string;
  label: string;
  /** Mots-clés utilisés pour filtrer les annonces BODACC. */
  motsCles: string[];
  /** Codes NAF utilisés pour l'API Recherche d'Entreprises. */
  naf: string[];
};

export const SECTEURS: Secteur[] = [
  {
    id: "restaurant",
    label: "Restaurant",
    motsCles: ["restaurant", "restauration", "brasserie", "pizzeria"],
    naf: ["56.10A", "56.10C", "56.30Z"],
  },
  {
    id: "beaute",
    label: "Coiffeur / Beauté",
    motsCles: ["coiffure", "coiffeur", "esthétique", "beauté", "onglerie", "barbier"],
    naf: ["96.02A", "96.02B"],
  },
  {
    id: "plomberie",
    label: "Plombier / Chauffagiste",
    motsCles: ["plomberie", "plombier", "chauffage", "sanitaire"],
    naf: ["43.22A", "43.22B"],
  },
  {
    id: "electricien",
    label: "Électricien",
    motsCles: ["électricité", "electricite", "électricien"],
    naf: ["43.21A"],
  },
  {
    id: "btp",
    label: "BTP / Construction",
    motsCles: ["maçonnerie", "construction", "bâtiment", "travaux", "rénovation", "charpente"],
    naf: ["41.20A", "41.20B", "43.99C", "43.91B"],
  },
  {
    id: "concession",
    label: "Concession automobile",
    motsCles: ["concession", "vente de véhicules", "automobile", "voitures"],
    naf: ["45.11Z"],
  },
  {
    id: "garage",
    label: "Garage / Réparation auto",
    motsCles: ["garage", "réparation automobile", "carrosserie", "mécanique auto"],
    naf: ["45.20A", "45.20B"],
  },
  {
    id: "immobilier",
    label: "Immobilier",
    motsCles: ["immobilier", "agence immobilière", "transaction"],
    naf: ["68.31Z", "68.20A"],
  },
  {
    id: "conciergerie",
    label: "Conciergerie",
    motsCles: ["conciergerie", "gestion locative", "location saisonnière"],
    naf: ["81.10Z", "68.32A"],
  },
  {
    id: "nettoyage",
    label: "Nettoyage",
    motsCles: ["nettoyage", "propreté", "entretien de locaux"],
    naf: ["81.21Z", "81.22Z"],
  },
  {
    id: "boulangerie",
    label: "Boulangerie / Pâtisserie",
    motsCles: ["boulangerie", "pâtisserie", "patisserie"],
    naf: ["10.71C", "10.71D"],
  },
  {
    id: "commerce",
    label: "Commerce de détail",
    motsCles: ["commerce de détail", "vente au détail", "boutique", "magasin"],
    naf: ["47.11D", "47.71Z", "47.78C"],
  },
  {
    id: "liberale",
    label: "Profession libérale",
    motsCles: ["conseil", "avocat", "expert-comptable", "architecte", "kinésithérapeute"],
    naf: ["69.10Z", "69.20Z", "71.11Z", "86.90E"],
  },
  {
    id: "hotellerie",
    label: "Hôtellerie",
    motsCles: ["hôtel", "hotel", "hébergement", "gîte"],
    naf: ["55.10Z", "55.20Z"],
  },
  {
    id: "sport",
    label: "Sport / Bien-être",
    motsCles: ["salle de sport", "fitness", "coach sportif", "spa", "bien-être"],
    naf: ["93.13Z", "96.04Z"],
  },
];

export const TRANCHES_EFFECTIF = [
  { value: "00", label: "0 salarié" },
  { value: "01", label: "1 ou 2 salariés" },
  { value: "02", label: "3 à 5 salariés" },
  { value: "03", label: "6 à 9 salariés" },
  { value: "11", label: "10 à 19 salariés" },
  { value: "12", label: "20 à 49 salariés" },
  { value: "21", label: "50 à 99 salariés" },
  { value: "22", label: "100 à 199 salariés" },
  { value: "31", label: "200 à 249 salariés" },
  { value: "32", label: "250 à 499 salariés" },
] as const;

export function secteurLabel(id: string): string {
  return SECTEURS.find((s) => s.id === id)?.label ?? id;
}
