// Banc @formateurs — le PUITS SMTP (Mailpit), où finit tout e-mail du banc.
//
// Le job `banc-formateurs` pose `SMTP_HOST=localhost` / `SMTP_PORT=1025` : le
// worker remet au conteneur Mailpit, qui GARDE les messages et ne les relaie
// nulle part. Aucune clé d'un relais réel n'existe dans le job — rien ne peut
// sortir, même par erreur.
//
// L'API de lecture (`BANC_PUITS_SMTP_URL`, port 8025) sert à constater qu'un
// message est ARRIVÉ — la preuve que le journal des envois (`email_logs`) ne
// donne pas à lui seul : « sent » dit que le relais a accepté, le puits dit ce
// qu'il a reçu.

export const URL_PUITS = process.env["BANC_PUITS_SMTP_URL"] ?? "";

export interface MessageCapte {
  readonly id: string;
  readonly sujet: string;
  readonly destinataires: readonly string[];
}

interface ReponseRecherche {
  readonly messages: ReadonlyArray<{
    readonly ID: string;
    readonly Subject: string;
    readonly To: ReadonlyArray<{ readonly Address: string }>;
  }>;
}

function requete(adresse: string): string {
  return `${URL_PUITS}/api/v1/search?query=${encodeURIComponent(`to:"${adresse}"`)}`;
}

/** Les messages captés pour un destinataire. */
export async function messagesCaptes(adresse: string): Promise<MessageCapte[]> {
  if (!URL_PUITS) throw new Error("banc @formateurs : BANC_PUITS_SMTP_URL absente");
  const reponse = await fetch(requete(adresse));
  if (!reponse.ok) throw new Error(`puits SMTP : HTTP ${reponse.status}`);
  const corps = (await reponse.json()) as ReponseRecherche;
  return corps.messages.map((m) => ({
    id: m.ID,
    sujet: m.Subject,
    destinataires: m.To.map((t) => t.Address.toLowerCase()),
  }));
}

/** Efface du puits les messages d'un destinataire (ménage de fin de test). */
export async function viderPuitsPour(adresse: string): Promise<void> {
  if (!URL_PUITS) return;
  await fetch(requete(adresse), { method: "DELETE" });
}
