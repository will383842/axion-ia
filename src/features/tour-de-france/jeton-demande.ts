// Tour France IA : le jeton qui relie la mini-demande à la page du rendez-vous (PR-2a).
//
// Après l'envoi de la demande, le visiteur est envoyé vers le calendrier ; la page du rendez-vous
// pourra y retrouver ses quatre champs. Entre les deux, le navigateur ne porte que ce jeton : il
// prouve « cette demande est bien celle de cette visite ».
//
// 🔑 Le jeton est LISIBLE (base64) par qui le reçoit : il ne porte QUE l'identifiant de la demande
// (jamais un nom, une adresse, un téléphone ni une ville), signé, valable 2 heures. Il circule dans
// une adresse web et dans des journaux.
//
// Format : `<base64url(JSON)>.<HMAC-SHA256 en hexa>`, comme le jeton du tunnel apporteurs
// (`commercial-application/jeton-lead.ts`), mais avec SON PROPRE domaine de clé : un jeton de ce
// tunnel-là ne se lit pas ici, et réciproquement. Clé dérivée d'`AUTH_SECRET` (aucun secret de plus
// à poser) ; en production on REFUSE de signer plutôt que de signer avec une clé connue.
//
// Module sans `server-only` ni `next/*` : lu aussi par les tests.

import crypto from "node:crypto";

const DOMAINE = "tour-demande-v1";
const REPLI_DEV = "axionia-tour-demande-dev-only-not-for-production";

/** Durée de vie du jeton : 2 heures. */
export const DUREE_JETON_DEMANDE_MS = 2 * 60 * 60 * 1000;

const FORME_UUID = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;

interface ContenuJetonDemande {
  readonly id: string;
  readonly iat: number;
  readonly exp: number;
}

function cle(): string {
  const secret = process.env["AUTH_SECRET"]?.trim();
  if (secret && secret.length >= 16) {
    return crypto.createHmac("sha256", secret).update(DOMAINE).digest("hex");
  }
  if (process.env["NODE_ENV"] === "production") {
    throw new Error("AUTH_SECRET (≥ 16 caractères) requis pour signer le jeton de la demande.");
  }
  return REPLI_DEV;
}

function signer(corps: string): string {
  return crypto.createHmac("sha256", cle()).update(corps).digest("hex");
}

/** Fabrique le jeton d'une demande. Lève si la clé de signature est absente en production. */
export function creerJetonDemande(id: string, maintenant: number = Date.now()): string {
  const contenu: ContenuJetonDemande = {
    id,
    iat: maintenant,
    exp: maintenant + DUREE_JETON_DEMANDE_MS,
  };
  const corps = Buffer.from(JSON.stringify(contenu)).toString("base64url");
  return `${corps}.${signer(corps)}`;
}

/**
 * Vérifie un jeton : signature, expiration, forme. Rend `{ id }`, ou `null` pour tout ce qui n'est
 * pas un jeton valide et non expiré — jamais d'exception.
 */
export function lireJetonDemande(
  jeton: unknown,
  maintenant: number = Date.now(),
): { readonly id: string } | null {
  if (typeof jeton !== "string" || jeton.length > 1000) return null;
  const parts = jeton.split(".");
  if (parts.length !== 2) return null;
  const [corps, sig] = parts;
  if (!corps || !sig) return null;
  try {
    const attendu = signer(corps);
    if (sig.length !== attendu.length) return null;
    if (!crypto.timingSafeEqual(Buffer.from(sig, "hex"), Buffer.from(attendu, "hex"))) return null;
    const c = JSON.parse(Buffer.from(corps, "base64url").toString("utf8")) as Partial<
      Record<keyof ContenuJetonDemande, unknown>
    >;
    if (typeof c.id !== "string" || !FORME_UUID.test(c.id)) return null;
    if (typeof c.exp !== "number" || c.exp < maintenant) return null;
    return { id: c.id };
  } catch {
    return null;
  }
}
