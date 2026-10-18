/**
 * Signature HMAC v1 du contrat studio → site (plan PLAN-W1-W4 §3.2). PURE : ni
 * Prisma, ni `process.env`, ni horloge — tout entre en paramètre.
 *
 * Chaîne signée (HMAC-SHA256) :
 *   v1\n<horodatage>\n<nonce>\n<MÉTHODE>\n<chemin>\n<sha256 hex du corps BRUT>
 *
 * - le corps est celui reçu, octet pour octet, jamais re-sérialisé ;
 * - méthode et chemin sont signés : une requête interceptée ne se rejoue pas
 *   sur une autre adresse ;
 * - les champs à forme contrainte (chiffres, hex) rendent la chaîne injective
 *   (piège documenté dans `partners/enveloppe.ts`) ;
 * - comparaison à temps constant, sur des empreintes de longueur fixe.
 */
import crypto from "node:crypto";

/** Tolérance d'horloge, en secondes (doctrine `partners/enveloppe.ts`). */
export const FENETRE_SECONDES = 300;

export const RE_HORODATAGE = /^[0-9]{10}$/;
export const RE_NONCE = /^[0-9a-f]{32}$/;
export const RE_SIGNATURE = /^v1=[0-9a-f]{64}$/;

export function sha256Hex(corps: string | Buffer): string {
  return crypto.createHash("sha256").update(corps).digest("hex");
}

export interface ElementsChaine {
  readonly horodatage: string;
  readonly nonce: string;
  readonly methode: string;
  readonly chemin: string;
  readonly corpsSha256: string;
}

export function chaineASigner(e: ElementsChaine): string {
  return ["v1", e.horodatage, e.nonce, e.methode.toUpperCase(), e.chemin, e.corpsSha256].join("\n");
}

export interface DemandeASigner {
  readonly secret: string;
  readonly horodatage: string;
  readonly nonce: string;
  readonly methode: string;
  readonly chemin: string;
  readonly corps: string | Buffer;
}

/** Valeur de l'en-tête `X-Axion-Signature` (`v1=<hex>`). Sert au studio factice et aux tests. */
export function signerRequete(d: DemandeASigner): string {
  const chaine = chaineASigner({
    horodatage: d.horodatage,
    nonce: d.nonce,
    methode: d.methode,
    chemin: d.chemin,
    corpsSha256: sha256Hex(d.corps),
  });
  return `v1=${crypto.createHmac("sha256", d.secret).update(chaine).digest("hex")}`;
}

function egalesATempsConstant(a: string, b: string): boolean {
  const ha = crypto.createHash("sha256").update(a, "utf8").digest();
  const hb = crypto.createHash("sha256").update(b, "utf8").digest();
  return crypto.timingSafeEqual(ha, hb);
}

export interface EntetesSignature {
  readonly horodatage: string | null | undefined;
  readonly nonce: string | null | undefined;
  readonly signature: string | null | undefined;
}

export type VerdictSignature =
  | { readonly ok: true; readonly secret: "courant" | "precedent" }
  | {
      readonly ok: false;
      readonly raison: "entetes_invalides" | "horodatage_hors_fenetre" | "signature_invalide";
    };

export interface DemandeAVerifier {
  readonly secrets: { readonly courant: string; readonly precedent: string | null };
  readonly entetes: EntetesSignature;
  readonly methode: string;
  readonly chemin: string;
  readonly corps: string | Buffer;
  /** Secondes Unix « maintenant » (injecté : la fonction reste pure). */
  readonly maintenantSec: number;
}

export function verifierRequete(d: DemandeAVerifier): VerdictSignature {
  const { horodatage, nonce, signature } = d.entetes;
  if (
    typeof horodatage !== "string" ||
    typeof nonce !== "string" ||
    typeof signature !== "string" ||
    !RE_HORODATAGE.test(horodatage) ||
    !RE_NONCE.test(nonce) ||
    !RE_SIGNATURE.test(signature)
  ) {
    return { ok: false, raison: "entetes_invalides" };
  }
  if (Math.abs(d.maintenantSec - Number(horodatage)) > FENETRE_SECONDES) {
    return { ok: false, raison: "horodatage_hors_fenetre" };
  }
  const attendue = (secret: string) =>
    signerRequete({
      secret,
      horodatage,
      nonce,
      methode: d.methode,
      chemin: d.chemin,
      corps: d.corps,
    });
  // Les deux comparaisons sont toujours évaluées : le temps ne dit pas lequel a réussi.
  const courantOk = egalesATempsConstant(signature, attendue(d.secrets.courant));
  const precedentOk =
    d.secrets.precedent !== null && egalesATempsConstant(signature, attendue(d.secrets.precedent));
  if (courantOk) return { ok: true, secret: "courant" };
  if (precedentOk) return { ok: true, secret: "precedent" };
  return { ok: false, raison: "signature_invalide" };
}
