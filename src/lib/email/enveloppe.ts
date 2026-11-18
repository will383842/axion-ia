// Enveloppe d'expédition : SOURCE UNIQUE de « De » et de « Répondre à ».
//
// Module pur (aucune dépendance applicative, pas de `next-auth`) : le worker,
// l'envoi (`client.ts`) et, plus tard, l'aperçu exact de la console s'en servent
// tous, pour que ce que l'on affiche soit ce qui part.
//
// Les variables d'environnement (`SMTP_FROM_NAME`, `SMTP_FROM_ADDRESS`,
// `SMTP_FROM_MARKETING`, `ADMIN_REPLY_FROM`) sont lues ICI et nulle part
// ailleurs. Comportement repris à l'identique de `client.ts` : valeurs figées à
// l'import du module, mêmes défauts, même repli anti-`noreply@`.

/** Boîte réellement relevée : expédition transactionnelle ET « Répondre à ». */
export const ADRESSE_CONTACT = "contact@axion-ia.com";

/**
 * Protection contre l'injection CRLF dans l'en-tête From : retire CR, LF,
 * guillemet et chevrons, borne à 80 caractères, repli « Axion-IA ».
 */
export function sanitizeFromName(raw: string): string {
  return (
    raw
      .replace(/[\r\n"<>]/g, "")
      .trim()
      .slice(0, 80) || "Axion-IA"
  );
}

/**
 * Refuse une adresse d'expédition de type `noreply@` (référentiel §3.2), même
 * si l'environnement en pose une. Un REPLI, pas une exception : l'envoi part,
 * l'erreur est consignée dans les journaux du worker.
 */
export function refuserNoReply(adresse: string): string {
  if (/^(no[-_.]?reply|donotreply|do-not-reply)@/i.test(adresse.trim())) {
    console.error(
      `[email] adresse d'expédition « ${adresse} » refusée : le référentiel §3.2 interdit ` +
        `noreply@ (signal négatif de délivrabilité, et ferme la porte au destinataire au ` +
        `moment exact où il a besoin d'aide). Repli sur ${ADRESSE_CONTACT}. ` +
        `Corriger SMTP_FROM_ADDRESS dans Coolify, sur l'app axion-ia-worker.`,
    );
    return ADRESSE_CONTACT;
  }
  return adresse;
}

const FROM_ADDRESS = refuserNoReply(process.env.SMTP_FROM_ADDRESS ?? ADRESSE_CONTACT);
const FROM_NAME = sanitizeFromName(process.env.SMTP_FROM_NAME ?? "Axion-IA");
const FROM_MARKETING = refuserNoReply(process.env.SMTP_FROM_MARKETING ?? "news@axion-ia.com");
const REPLY_TO_DEFAUT = process.env.ADMIN_REPLY_FROM ?? ADRESSE_CONTACT;

export interface EnveloppeExpedition {
  /** Nom d'expéditeur, déjà assaini. */
  fromName: string;
  /** Adresse d'expédition (transactionnelle ou marketing). */
  fromAddress: string;
  /** En-tête `From` complet : `"Nom" <adresse>`. */
  from: string;
  /** En-tête `Reply-To`, toujours renseigné. */
  replyTo: string;
}

/**
 * « De » et « Répondre à » d'un envoi.
 *
 * - `marketing` : adresse `news@` au lieu de `contact@`.
 * - `replyTo` : surcharge la boîte de réponse par défaut.
 * - `fromName` : nom d'expéditeur propre à l'envoi (facultatif, prévu pour F3) ;
 *   assaini comme le nom par défaut.
 */
export function enveloppeExpedition(
  options: { marketing?: boolean; replyTo?: string; fromName?: string } = {},
): EnveloppeExpedition {
  const fromName = options.fromName !== undefined ? sanitizeFromName(options.fromName) : FROM_NAME;
  const fromAddress = options.marketing ? FROM_MARKETING : FROM_ADDRESS;
  return {
    fromName,
    fromAddress,
    from: `"${fromName}" <${fromAddress}>`,
    replyTo: options.replyTo ?? REPLY_TO_DEFAUT,
  };
}
