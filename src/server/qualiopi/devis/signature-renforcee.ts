/**
 * Signature électronique « simple renforcée » du devis à formules — règles PURES (lot 4 bis).
 *
 * Palier GRATUIT, sur le canal maison, sans prestataire payant ni SMS. Ce qui le « renforce »
 * par rapport à la signature par lien seul :
 *   · un code à usage unique envoyé À L'ADRESSE FIGÉE sur le lien (preuve de détention de la
 *     boîte au moment de signer) ;
 *   · une déclaration expresse : nom et fonction SAISIS, et « je déclare avoir le pouvoir
 *     d'engager la société » ;
 *   · le tout scellé dans le sceau V4 avec le texte exact accepté, puis horodaté (RFC 3161).
 *
 * Le contrat n'est PAS formé par cette signature : il l'est à la contresignature d'Axion-IA.
 *
 * Aucun import Prisma, aucune horloge (les instants sont des paramètres).
 */

/** Le code vit 10 minutes. */
export const CODE_DEVIS_VALIDITE_MS = 10 * 60 * 1000;
/** Cinq essais, puis blocage de la pièce pour 15 minutes. */
export const CODE_DEVIS_ESSAIS_MAX = 5;
export const CODE_DEVIS_BLOCAGE_MS = 15 * 60 * 1000;
/**
 * Plafond CUMULÉ, par pièce et partie, tous codes confondus : au 10e échec sur 24 h, la pièce est
 * bloquée 15 minutes. Redemander un code ne remet PAS ce compteur à zéro (audit sécurité) ; seules
 * une signature réussie ou l'écoulement des 24 h le font.
 */
export const CODE_DEVIS_ECHECS_CUMULES_MAX = 10;
export const CODE_DEVIS_ECHECS_CUMULES_FENETRE_MS = 24 * 60 * 60 * 1000;
/** « Recevoir mon code » : pas deux envois à moins d'une minute d'écart… */
export const CODE_DEVIS_DELAI_RENVOI_MS = 60 * 1000;
/** … et au plus cinq envois par heure pour un même lien. */
export const CODE_DEVIS_ENVOIS_PAR_HEURE_PAR_LIEN = 5;
/** Garde large sur la pièce entière (plusieurs liens successifs). */
export const CODE_DEVIS_ENVOIS_PAR_HEURE_PAR_PIECE = 8;
/** Le code consommé doit être récent au moment où la signature s'écrit. */
export const CODE_DEVIS_FRAICHEUR_MS = CODE_DEVIS_VALIDITE_MS;

export const DECLARATION_LONGUEUR_MIN = 2;
export const DECLARATION_LONGUEUR_MAX = 200;

/** Ce que le signataire a SAISI (jamais l'instant : il vient du serveur). */
export interface DeclarationSaisie {
  readonly nom: unknown;
  readonly fonction: unknown;
  readonly pouvoirEngager?: unknown;
}

export interface DeclarationValidee {
  readonly nom: string;
  readonly fonction: string;
}

export type RaisonRefusDeclaration = "nom_invalide" | "fonction_invalide" | "pouvoir_non_declare";

export type ResultatDeclaration =
  | { readonly ok: true; readonly declaration: DeclarationValidee }
  | { readonly ok: false; readonly raison: RaisonRefusDeclaration; readonly message: string };

const MESSAGES: Record<RaisonRefusDeclaration, string> = {
  nom_invalide: "Saisissez votre nom et prénom (2 à 200 caractères, sans caractère de commande).",
  fonction_invalide: "Saisissez votre fonction dans la société (2 à 200 caractères).",
  pouvoir_non_declare:
    "Pour signer ce devis, cochez la case « Je déclare avoir le pouvoir d'engager la société ».",
};

/** Caractères de commande (dont retours à la ligne), séparateurs de ligne/paragraphe et marques bidi. */
const INTERDITS = new RegExp(
  "[\\u0000-\\u001f\\u007f-\\u009f\\u2028\\u2029\\u200b-\\u200f\\u202a-\\u202e\\u2066-\\u2069]",
  "u",
);

/** Espaces normalisés : « Jean   Dupont » et « Jean Dupont » scellent la même valeur. */
export function normaliserSaisie(v: unknown): string | null {
  if (typeof v !== "string") return null;
  if (INTERDITS.test(v)) return null;
  const propre = v.normalize("NFC").replace(/\s+/g, " ").trim();
  if (propre.length < DECLARATION_LONGUEUR_MIN || propre.length > DECLARATION_LONGUEUR_MAX) {
    return null;
  }
  return propre;
}

/**
 * Valide la déclaration. `pouvoirEngager` doit être EXACTEMENT `true` : « true » en chaîne, 1 ou
 * l'absence valent refus. Un nom ou une fonction illisibles ne sont jamais « corrigés ».
 */
export function validerDeclaration(saisie: DeclarationSaisie): ResultatDeclaration {
  const nom = normaliserSaisie(saisie.nom);
  if (nom === null) return refus("nom_invalide");
  const fonction = normaliserSaisie(saisie.fonction);
  if (fonction === null) return refus("fonction_invalide");
  if (saisie.pouvoirEngager !== true) return refus("pouvoir_non_declare");
  return { ok: true, declaration: { nom, fonction } };
}

function refus(raison: RaisonRefusDeclaration): ResultatDeclaration {
  return { ok: false, raison, message: MESSAGES[raison] };
}

/** Le code est-il assez récent pour signer ? Borne incluse. */
export function codeAssezRecent(utiliseAt: Date, maintenant: Date): boolean {
  const ecart = maintenant.getTime() - utiliseAt.getTime();
  return ecart >= 0 && ecart <= CODE_DEVIS_FRAICHEUR_MS;
}

/** Libellé de la durée du code, tiré de la constante (jamais écrit à la main). */
export function libelleValiditeCode(ms: number = CODE_DEVIS_VALIDITE_MS): string {
  const minutes = Math.round(ms / 60_000);
  return `${minutes} minute${minutes > 1 ? "s" : ""}`;
}

/** Décision d'envoi du code : pure, alimentée par les envois déjà faits. */
export type RefusEnvoiCode = "bloque" | "trop_tot" | "trop_de_codes";

export function decisionEnvoiCode(input: {
  readonly maintenant: Date;
  /** Instants de création des codes émis pour CE lien dans l'heure écoulée. */
  readonly envoisDuLien: readonly Date[];
  /** Nombre de codes émis pour la pièce dans l'heure écoulée (tous liens). */
  readonly envoisDeLaPiece: number;
  /** Blocage posé par un cinquième échec ; `null` sinon. */
  readonly bloqueJusquA: Date | null;
}): { readonly ok: true } | { readonly ok: false; readonly raison: RefusEnvoiCode } {
  const t = input.maintenant.getTime();
  if (input.bloqueJusquA !== null && input.bloqueJusquA.getTime() > t) {
    return { ok: false, raison: "bloque" };
  }
  const dernier = input.envoisDuLien.reduce<number | null>(
    (max, d) => (max === null || d.getTime() > max ? d.getTime() : max),
    null,
  );
  if (dernier !== null && t - dernier < CODE_DEVIS_DELAI_RENVOI_MS) {
    return { ok: false, raison: "trop_tot" };
  }
  if (
    input.envoisDuLien.length >= CODE_DEVIS_ENVOIS_PAR_HEURE_PAR_LIEN ||
    input.envoisDeLaPiece >= CODE_DEVIS_ENVOIS_PAR_HEURE_PAR_PIECE
  ) {
    return { ok: false, raison: "trop_de_codes" };
  }
  return { ok: true };
}
