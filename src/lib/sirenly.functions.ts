import { createServerFn } from "@tanstack/react-start";
import { z } from "zod";

import { SECTEURS } from "./secteurs";
import { fetchBodacc, enrichWithGoogle, isExcluded, normalize } from "./sirenly.server";
import { fetchEntreprisesEtablies } from "./entreprises.server";
import { enrichirPresence, emailValide } from "./enrichment.server";
import { aiPersonalize, aiClassifyReply } from "./ai.server";
import { envoyerEmailBrevo } from "./brevo.server";

const LIMITE_QUOTIDIENNE = 300;

async function admin() {
  const { createClient } = await import("@supabase/supabase-js");
  return createClient(
    process.env["SUPABASE_URL"]!,
    process.env["SUPABASE_SERVICE_ROLE_KEY"]!,
    { auth: { persistSession: false, autoRefreshToken: false } },
  );
}

function motsClesDe(secteurs: string[], autre: string): string[] {
  const list = secteurs.flatMap((id) => SECTEURS.find((s) => s.id === id)?.motsCles ?? []);
  if (autre.trim()) list.push(autre.trim());
  return list;
}

function nafDe(secteurs: string[]): string[] {
  return secteurs.flatMap((id) => SECTEURS.find((s) => s.id === id)?.naf ?? []);
}

/* ------------------------------ Radar / ciblage ------------------------------ */

export const generateLeads = createServerFn({ method: "POST" })
  .inputValidator((data: unknown) =>
    z
      .object({
        source: z.enum(["bodacc", "etablies"]).default("bodacc"),
        departement: z.string().min(1).max(3),
        jours: z.number().int().min(1).max(90).default(7),
        secteurs: z.array(z.string()).default([]),
        autreSecteur: z.string().default(""),
        effectifs: z.array(z.string()).default([]),
      })
      .parse(data),
  )
  .handler(async ({ data }) => {
    const supabase = await admin();
    const googleKey = process.env["GOOGLE_PLACES_API_KEY"] ?? "";
    const motsCles = motsClesDe(data.secteurs, data.autreSecteur);

    type Base = {
      id: string;
      nom: string;
      contact: string;
      activite: string;
      commune: string;
      code_postal: string;
      adresse: string;
      forme_juridique: string;
      siren?: string;
      effectif?: string;
    };

    let leads: Base[] = [];

    if (data.source === "bodacc") {
      const bruts = await fetchBodacc(data.departement, data.jours);
      leads = motsCles.length
        ? bruts.filter((l) => {
            const hay = normalize(`${l.activite} ${l.nom}`);
            return motsCles.some((m) => hay.includes(normalize(m)));
          })
        : bruts;
    } else {
      const bruts = await fetchEntreprisesEtablies({
        departement: data.departement,
        naf: nafDe(data.secteurs),
        termes: data.autreSecteur.trim() ? [data.autreSecteur.trim()] : [],
        effectifs: data.effectifs,
      });
      leads = bruts.filter((l) => !isExcluded(l.activite, l.forme_juridique, l.nom));
    }

    // ── Étape 1 (immédiate) : insertion des infos de base, enrichissement différé ──
    let ajoutes = 0;
    let misAJour = 0;
    const ids: string[] = [];

    for (const lead of leads) {
      const base = {
        nom: lead.nom,
        contact: lead.contact,
        activite: lead.activite,
        commune: lead.commune,
        code_postal: lead.code_postal,
        adresse: lead.adresse,
        forme_juridique: lead.forme_juridique,
        siren: lead.siren ?? null,
        effectif: lead.effectif ?? null,
        source: data.source,
        enrichissement_en_cours: true,
        date_maj: new Date().toISOString(),
      };

      const { data: existing } = await supabase
        .from("leads")
        .select("id")
        .eq("id", lead.id)
        .maybeSingle();

      if (existing) {
        const patch = Object.fromEntries(
          Object.entries(base).filter(([, v]) => v !== null && v !== ""),
        );
        const { error } = await supabase.from("leads").update(patch).eq("id", lead.id);
        if (!error) misAJour += 1;
      } else {
        const { error } = await supabase.from("leads").insert({ id: lead.id, ...base });
        if (!error) ajoutes += 1;
      }
      ids.push(lead.id);
    }

    return {
      total: leads.length,
      ajoutes,
      misAJour,
      aEnrichir: ids.length,
      googleActif: Boolean(googleKey),
      source: data.source,
    };
  });

/* --------------------- Enrichissement par lots (arrière-plan) --------------------- */

/**
 * Traite un lot de leads en attente d'enrichissement, en parallèle.
 * Appelée en boucle par l'interface jusqu'à ce que `restants` soit à 0 :
 * évite tout risque de timeout sur de gros volumes.
 */
export const enrichirLot = createServerFn({ method: "POST" })
  .inputValidator((data: unknown) =>
    z.object({ taille: z.number().int().min(1).max(10).default(8) }).parse(data ?? {}),
  )
  .handler(async ({ data }) => {
    const supabase = await admin();
    const googleKey = process.env["GOOGLE_PLACES_API_KEY"] ?? "";

    const { data: lot } = await supabase
      .from("leads")
      .select("id, nom, commune, activite")
      .eq("enrichissement_en_cours", true)
      .order("date_maj", { ascending: true })
      .limit(data.taille);

    const cibles = lot ?? [];

    await Promise.all(
      cibles.map(async (lead) => {
        try {
          const g = googleKey
            ? await enrichWithGoogle(
                {
                  id: lead.id,
                  nom: lead.nom ?? "",
                  commune: lead.commune ?? "",
                  contact: "",
                  activite: lead.activite ?? "",
                  code_postal: "",
                  adresse: "",
                  forme_juridique: "",
                },
                googleKey,
              )
            : { note_google: "", nb_avis_google: "", telephone: "", site_web: "" };

          const presence = await enrichirPresence({
            nom: lead.nom ?? "",
            commune: lead.commune ?? "",
            activite: lead.activite ?? "",
            site_web: g.site_web,
            telephone: g.telephone,
          });

          await supabase
            .from("leads")
            .update({
              note_google: g.note_google || null,
              nb_avis_google: g.nb_avis_google || null,
              telephone: presence.telephone || g.telephone || null,
              email: presence.email || null,
              email_source: presence.email_source || null,
              site_web: presence.site_web || g.site_web || null,
              facebook_url: presence.facebook_url || null,
              instagram_url: presence.instagram_url || null,
              linkedin_url: presence.linkedin_url || null,
              tiktok_url: presence.tiktok_url || null,
              fiches_annuaires: presence.fiches_annuaires,
              tags: presence.tags,
              enrichissement_en_cours: false,
              date_maj: new Date().toISOString(),
            })
            .eq("id", lead.id);
        } catch {
          // Ne jamais bloquer la file : on libère le lead même en cas d'échec.
          await supabase
            .from("leads")
            .update({ enrichissement_en_cours: false, date_maj: new Date().toISOString() })
            .eq("id", lead.id);
        }
      }),
    );

    const { count } = await supabase
      .from("leads")
      .select("id", { count: "exact", head: true })
      .eq("enrichissement_en_cours", true);

    return { traites: cibles.length, restants: count ?? 0 };
  });


/* ------------------------------- Aperçu IA ---------------------------------- */

export const apercuIA = createServerFn({ method: "POST" })
  .inputValidator((data: unknown) =>
    z.object({ brief: z.string().min(1), leadIds: z.array(z.string()).min(1).max(3) }).parse(data),
  )
  .handler(async ({ data }) => {
    const supabase = await admin();
    const { data: params } = await supabase.from("parametres").select("contexte_ia").limit(1).maybeSingle();
    const { data: leads } = await supabase
      .from("leads")
      .select("id, nom, contact, activite, commune, note_google, nb_avis_google")
      .in("id", data.leadIds);

    const out: Array<{ leadId: string; nom: string; sujet: string; corps: string }> = [];
    for (const lead of leads ?? []) {
      const mail = await aiPersonalize(lead, data.brief, params?.contexte_ia ?? "");
      out.push({ leadId: lead.id, nom: lead.nom ?? lead.id, ...mail });
    }
    return out;
  });

/* ----------------------------- Envoi de campagne ----------------------------- */

function remplirTemplate(txt: string, lead: Record<string, unknown>): string {
  return txt.replace(/\{\{(\w+)\}\}/g, (_, k: string) => String(lead[k] ?? "").trim());
}

export const lancerCampagne = createServerFn({ method: "POST" })
  .inputValidator((data: unknown) => z.object({ campagneId: z.string().uuid() }).parse(data))
  .handler(async ({ data }) => {
    const supabase = await admin();

    const { data: campagne, error: cErr } = await supabase
      .from("campagnes")
      .select("*")
      .eq("id", data.campagneId)
      .maybeSingle();
    if (cErr || !campagne) throw new Error("Campagne introuvable");

    const { data: params } = await supabase.from("parametres").select("*").limit(1).maybeSingle();
    const expediteurEmail = params?.expediteur_email ?? "";
    const expediteurNom = params?.expediteur_nom ?? params?.nom_agence ?? "Sirenly";
    if (!expediteurEmail) throw new Error("Configurez l'email d'expédition dans Paramètres");

    const leadIds = (campagne.lead_ids as string[]) ?? [];
    const { data: leads } = await supabase
      .from("leads")
      .select("*")
      .in("id", leadIds.length ? leadIds : ["__aucun__"]);

    // Quota du jour
    const debutJour = new Date();
    debutJour.setHours(0, 0, 0, 0);
    const { count } = await supabase
      .from("emails_envoyes")
      .select("id", { count: "exact", head: true })
      .gte("date_envoi", debutJour.toISOString());
    let restant = Math.max(0, LIMITE_QUOTIDIENNE - (count ?? 0));

    let envoyes = 0;
    let programmes = 0;
    let echecs = 0;
    let exclus = 0;
    let jourDecalage = 1;
    let compteurJour = 0;

    for (const lead of leads ?? []) {
      const destinataire = (lead.email as string | null)?.trim() ?? "";

      // Garde-fou : aucun envoi ni mise en file sans adresse email valide.
      if (!destinataire || !emailValide(destinataire)) {
        exclus += 1;
        continue;
      }

      let sujet = campagne.sujet ?? "";
      let corps = campagne.corps ?? "";
      if (campagne.mode === "ia") {
        try {
          const mail = await aiPersonalize(lead, campagne.brief_ia ?? "", params?.contexte_ia ?? "");
          sujet = mail.sujet;
          corps = mail.corps;
        } catch {
          echecs += 1;
          continue;
        }
      } else {
        sujet = remplirTemplate(sujet, lead);
        corps = remplirTemplate(corps, lead);
      }

      if (restant <= 0) {
        // Quota quotidien atteint : file d'attente pour les jours suivants
        const datePrevue = new Date();
        datePrevue.setDate(datePrevue.getDate() + jourDecalage);
        await supabase.from("file_envoi").insert({
          campagne_id: campagne.id,
          lead_id: lead.id,
          sujet_genere: sujet,
          contenu_genere: corps,
          statut: "programme",
          date_prevue: datePrevue.toISOString().slice(0, 10),
        });
        programmes += 1;
        compteurJour += 1;
        if (compteurJour >= LIMITE_QUOTIDIENNE) {
          compteurJour = 0;
          jourDecalage += 1;
        }
        continue;
      }

      try {
        await envoyerEmailBrevo({
          destinataire,
          nomDestinataire: (lead.contact as string) || (lead.nom as string) || destinataire,
          sujet,
          corps,
          expediteurNom,
          expediteurEmail,
          replyTo: params?.email_reception ?? expediteurEmail,
        });
        await supabase.from("emails_envoyes").insert({
          lead_id: lead.id,
          campagne_id: campagne.id,
          destinataire,
          sujet,
          contenu: corps,
          statut_envoi: "envoyé",
        });
        await supabase
          .from("leads")
          .update({
            campagne_id: campagne.id,
            statut: ["nouveau", "non_qualifie", null].includes(lead.statut as string)
              ? "contacte"
              : (lead.statut as string),
            derniere_activite: new Date().toISOString(),
          })
          .eq("id", lead.id);
        envoyes += 1;
        restant -= 1;
      } catch {
        echecs += 1;
      }
    }

    await supabase
      .from("campagnes")
      .update({ statut: programmes > 0 ? "en_cours" : "terminee", date_maj: new Date().toISOString() })
      .eq("id", campagne.id);

    return { envoyes, programmes, echecs, exclus };
  });

/* --------------------------- Classification manuelle ------------------------- */

export const classifierReponse = createServerFn({ method: "POST" })
  .inputValidator((data: unknown) => z.object({ reponseId: z.string().uuid() }).parse(data))
  .handler(async ({ data }) => {
    const supabase = await admin();
    const { data: rep } = await supabase
      .from("reponses_emails")
      .select("id, contenu")
      .eq("id", data.reponseId)
      .maybeSingle();
    if (!rep) throw new Error("Réponse introuvable");
    const classification = await aiClassifyReply(rep.contenu ?? "");
    await supabase.from("reponses_emails").update({ classification }).eq("id", rep.id);
    return { classification };
  });

/* ------------------- Réparation des emails invalides en base ------------------- */

export const reparerEmailsInvalides = createServerFn({ method: "POST" }).handler(async () => {
  const supabase = await admin();

  const { data: leads } = await supabase
    .from("leads")
    .select("id, nom, commune, activite, site_web, telephone, email, tags")
    .not("email", "is", null);

  const suspects = (leads ?? []).filter((l) => !emailValide(String(l.email ?? "")));
  let corriges = 0;
  let reenrichis = 0;

  for (const l of suspects) {
    const presence = await enrichirPresence({
      nom: l.nom ?? "",
      commune: l.commune ?? "",
      activite: l.activite ?? "",
      site_web: l.site_web ?? "",
      telephone: l.telephone ?? "",
    });

    const patch: Record<string, unknown> = {
      email: presence.email || null,
      email_source: presence.email_source || null,
      tags: presence.tags,
      date_maj: new Date().toISOString(),
    };
    if (presence.site_web) patch["site_web"] = presence.site_web;
    if (presence.telephone) patch["telephone"] = presence.telephone;
    if (presence.facebook_url) patch["facebook_url"] = presence.facebook_url;
    if (presence.instagram_url) patch["instagram_url"] = presence.instagram_url;
    if (presence.linkedin_url) patch["linkedin_url"] = presence.linkedin_url;
    if (presence.tiktok_url) patch["tiktok_url"] = presence.tiktok_url;
    if (presence.fiches_annuaires.length) patch["fiches_annuaires"] = presence.fiches_annuaires;

    const { error } = await supabase.from("leads").update(patch).eq("id", l.id);
    if (!error) {
      corriges += 1;
      if (presence.email) reenrichis += 1;
    }
  }

  return { analyses: (leads ?? []).length, suspects: suspects.length, corriges, reenrichis };
});
