export type EnvoiBrevo = {
  destinataire: string;
  nomDestinataire?: string;
  sujet: string;
  corps: string;
  expediteurNom: string;
  expediteurEmail: string;
  replyTo?: string;
};

/** Envoi transactionnel via l'API Brevo. */
export async function envoyerEmailBrevo(envoi: EnvoiBrevo): Promise<void> {
  const key = process.env["BREVO_API_KEY"];
  if (!key) throw new Error("BREVO_API_KEY manquante");

  const html = `<div style="font-family:Arial,Helvetica,sans-serif;font-size:15px;line-height:1.6;color:#18181b">${envoi.corps
    .split("\n")
    .map((l) => `<p style="margin:0 0 12px">${l}</p>`)
    .join("")}</div>`;

  const res = await fetch("https://api.brevo.com/v3/smtp/email", {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      accept: "application/json",
      "api-key": key,
    },
    body: JSON.stringify({
      sender: { name: envoi.expediteurNom, email: envoi.expediteurEmail },
      to: [{ email: envoi.destinataire, name: envoi.nomDestinataire || envoi.destinataire }],
      ...(envoi.replyTo ? { replyTo: { email: envoi.replyTo } } : {}),
      subject: envoi.sujet,
      htmlContent: html,
    }),
  });

  if (!res.ok) {
    throw new Error(`Brevo [${res.status}]: ${await res.text()}`);
  }
}
