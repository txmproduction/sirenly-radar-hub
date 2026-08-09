import { createFileRoute } from "@tanstack/react-router";

import { aiClassifyReply } from "@/lib/ai.server";

type Payload = Record<string, unknown>;

function pick(obj: Payload, ...keys: string[]): string {
  for (const k of keys) {
    const v = obj[k];
    if (typeof v === "string" && v.trim()) return v.trim();
    if (v && typeof v === "object") {
      const o = v as Payload;
      const nested = (o["address"] ?? o["email"] ?? o["Address"]) as unknown;
      if (typeof nested === "string" && nested.trim()) return nested.trim();
    }
    if (Array.isArray(v) && v.length) {
      const first = v[0] as Payload;
      const addr = (first?.["address"] ?? first?.["email"]) as unknown;
      if (typeof addr === "string") return addr.trim();
    }
  }
  return "";
}

export const Route = createFileRoute("/api/public/receive-email-webhook")({
  server: {
    handlers: {
      POST: async ({ request }) => {
        let payload: Payload = {};
        try {
          payload = (await request.json()) as Payload;
        } catch {
          return new Response("Invalid JSON", { status: 400 });
        }

        const items = Array.isArray(payload["items"])
          ? (payload["items"] as Payload[])
          : [payload];

        const { createClient } = await import("@supabase/supabase-js");
        const supabase = createClient(
          process.env["SUPABASE_URL"]!,
          process.env["SUPABASE_SERVICE_ROLE_KEY"]!,
          { auth: { persistSession: false, autoRefreshToken: false } },
        );

        const { data: params } = await supabase
          .from("parametres")
          .select("classification_auto")
          .limit(1)
          .maybeSingle();

        let traites = 0;

        for (const item of items) {
          const expediteur = pick(item, "from", "sender", "From", "email");
          const sujet = pick(item, "subject", "Subject") || "(sans objet)";
          const contenu =
            pick(item, "text", "TextBody", "RawTextBody", "html", "HtmlBody") || "";

          if (!expediteur) continue;

          // Retrouver le lead par email, puis la campagne la plus récente
          const { data: lead } = await supabase
            .from("leads")
            .select("id, campagne_id")
            .eq("email", expediteur)
            .maybeSingle();

          let classification = "autre";
          if (params?.classification_auto !== false && contenu) {
            try {
              classification = await aiClassifyReply(contenu);
            } catch {
              classification = "autre";
            }
          }

          await supabase.from("reponses_emails").insert({
            lead_id: lead?.id ?? null,
            campagne_id: lead?.campagne_id ?? null,
            email_expediteur: expediteur,
            sujet,
            contenu,
            classification,
          });

          if (lead?.id) {
            await supabase
              .from("leads")
              .update({ statut: "a_repondu", derniere_activite: new Date().toISOString() })
              .eq("id", lead.id);
          }
          traites += 1;
        }

        return Response.json({ ok: true, traites });
      },
    },
  },
});
