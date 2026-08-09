const GATEWAY = "https://ai.gateway.lovable.dev/v1/chat/completions";
const MODEL = "openai/gpt-5.6-sol";

export type LeadContext = {
  nom: string | null;
  contact: string | null;
  activite: string | null;
  commune: string | null;
  note_google: string | null;
  nb_avis_google: string | null;
};

async function chat(messages: Array<{ role: string; content: string }>): Promise<string> {
  const key = process.env["LOVABLE_API_KEY"];
  if (!key) throw new Error("LOVABLE_API_KEY manquante");
  const res = await fetch(GATEWAY, {
    method: "POST",
    headers: { "Content-Type": "application/json", "Lovable-API-Key": key },
    body: JSON.stringify({ model: MODEL, messages }),
  });
  if (!res.ok) {
    const body = await res.text();
    if (res.status === 429) throw new Error("Limite de requêtes IA atteinte, réessayez plus tard.");
    if (res.status === 402) throw new Error("Crédits IA épuisés.");
    throw new Error(`Erreur IA [${res.status}]: ${body}`);
  }
  const json = (await res.json()) as {
    choices?: Array<{ message?: { content?: string } }>;
  };
  return json.choices?.[0]?.message?.content ?? "";
}

/** Agent 1 — génère un email de prospection unique pour un lead. */
export async function aiPersonalize(
  lead: LeadContext,
  brief: string,
  contexteAgence: string,
): Promise<{ sujet: string; corps: string }> {
  const system = `Tu es un commercial expert en prospection B2B pour une agence de communication digitale. Rédige un email de prospection court (max 120 mots), personnalisé, naturel, sans jargon marketing, qui s'appuie sur les infos concrètes du prospect. Si le prospect n'a pas de fiche Google ou peu d'avis, utilise-le comme angle d'accroche (visibilité). Termine par une question simple qui invite à répondre. Réponds UNIQUEMENT avec un JSON : {"sujet": "...", "corps": "..."}`;

  const ficheGoogle = lead.note_google
    ? `note ${lead.note_google}/5 avec ${lead.nb_avis_google || "0"} avis`
    : "aucune fiche Google trouvée";

  const user = [
    contexteAgence ? `CONTEXTE AGENCE:\n${contexteAgence}` : "",
    `BRIEF DE CAMPAGNE:\n${brief}`,
    `PROSPECT:\n- Entreprise: ${lead.nom ?? "—"}\n- Contact: ${lead.contact || "inconnu"}\n- Activité: ${lead.activite || "—"}\n- Commune: ${lead.commune || "—"}\n- Google: ${ficheGoogle}`,
  ]
    .filter(Boolean)
    .join("\n\n");

  const raw = await chat([
    { role: "system", content: system },
    { role: "user", content: user },
  ]);

  const match = raw.match(/\{[\s\S]*\}/);
  try {
    const parsed = JSON.parse(match ? match[0] : raw) as { sujet?: string; corps?: string };
    return { sujet: parsed.sujet ?? "", corps: parsed.corps ?? "" };
  } catch {
    return { sujet: `Une idée pour ${lead.nom ?? "votre activité"}`, corps: raw.trim() };
  }
}

const CATEGORIES = ["interesse", "demande_info", "pas_interesse", "absent_auto", "autre"];

/** Agent 2 — classifie une réponse email reçue. */
export async function aiClassifyReply(contenu: string): Promise<string> {
  const raw = await chat([
    {
      role: "system",
      content:
        "Classe cette réponse à un email de prospection dans une de ces catégories exactes : interesse, demande_info, pas_interesse, absent_auto, autre. Réponds uniquement avec le mot de la catégorie.",
    },
    { role: "user", content: contenu.slice(0, 4000) },
  ]);
  const clean = raw.toLowerCase().replace(/[^a-z_]/g, "");
  return CATEGORIES.find((c) => clean.includes(c)) ?? "autre";
}
