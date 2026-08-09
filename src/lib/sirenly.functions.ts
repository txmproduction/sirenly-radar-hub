import { createServerFn } from "@tanstack/react-start";
import { z } from "zod";

import { fetchBodacc, enrichWithGoogle } from "./sirenly.server";

export const generateLeads = createServerFn({ method: "POST" })
  .inputValidator((data: unknown) =>
    z
      .object({
        departement: z.string().min(1).max(3),
        jours: z.number().int().min(1).max(90).default(7),
      })
      .parse(data),
  )
  .handler(async ({ data }) => {
    const { createClient } = await import("@supabase/supabase-js");
    const supabase = createClient(
      process.env["SUPABASE_URL"]!,
      process.env["SUPABASE_SERVICE_ROLE_KEY"]!,
      { auth: { persistSession: false, autoRefreshToken: false } },
    );

    const leads = await fetchBodacc(data.departement, data.jours);
    const googleKey = process.env["GOOGLE_PLACES_API_KEY"] ?? "";

    let ajoutes = 0;
    let misAJour = 0;

    for (const lead of leads) {
      const enrichment = googleKey
        ? await enrichWithGoogle(lead, googleKey)
        : { note_google: "", nb_avis_google: "", telephone: "" };

      const { data: existing } = await supabase
        .from("leads")
        .select("id")
        .eq("id", lead.id)
        .maybeSingle();

      const base = {
        nom: lead.nom,
        contact: lead.contact,
        activite: lead.activite,
        commune: lead.commune,
        code_postal: lead.code_postal,
        adresse: lead.adresse,
        forme_juridique: lead.forme_juridique,
        note_google: enrichment.note_google,
        nb_avis_google: enrichment.nb_avis_google,
        telephone: enrichment.telephone,
        date_maj: new Date().toISOString(),
      };

      if (existing) {
        // Ne pas écraser statut / notes / qualifie_par
        const { error } = await supabase.from("leads").update(base).eq("id", lead.id);
        if (!error) misAJour += 1;
      } else {
        const { error } = await supabase.from("leads").insert({ id: lead.id, ...base });
        if (!error) ajoutes += 1;
      }
    }

    return {
      total: leads.length,
      ajoutes,
      misAJour,
      googleActif: Boolean(googleKey),
    };
  });
