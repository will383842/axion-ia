// Tunnel apporteurs AVEC VIDÉO (« VSL ») — constantes partagées, module PUR
// (2026-10-05). Aucune dépendance serveur, aucun zod : la page et le formulaire
// du navigateur peuvent l'importer sans alourdir leur JavaScript.
//
// Référence : `_PLAN-VSL-TUNNEL-APPORTEURS-2026-10-05/03-MESSAGES-ET-DECISIONS.md`
// et `01-ARCHITECTURE.md` §2.4-2.8. Les schémas de validation (zod) vivent dans
// `vsl-schemas.ts`, RÉSERVÉ au serveur.

/** Page d'arrivée de la publicité, et page de remerciement (sans préfixe de langue). */
export const VSL_PAGE_PATH = "/apporteur-affaires/video";
export const VSL_MERCI_PATH = "/apporteur-affaires/video/merci";

/** Version de la page, posée dans `details.vsl.version` pour comparer les variantes. */
export const VSL_VERSION = "vsl-v1";

/**
 * Version du texte de consentement du NOUVEAU parcours.
 *
 * 🔴 `LEAD_APPORTEUR_CONSENT_VERSION` (formulaire court) est une AUTRE version :
 * l'ancien formulaire garde son texte et sa preuve, verrouillés par
 * `le-formulaire-apporteur-ne-promet-aucun-appel.spec.tsx`. La preuve de
 * consentement ne vaut que par le texte réellement coché : la v3 disait
 * explicitement qu'on peut écrire « même si je ne termine pas » (relance
 * d'abandon, base légale du lot 2) ; la v4 (2026-10-07) garde cette phrase et
 * retire la durée « 24 mois après la clôture » — plus aucune suppression
 * automatique (décision de Will) ; la v5 (2026-10-10) dit « ma demande » au lieu
 * de « mon inscription » (vocabulaire du tunnel vidéo, décision de Will) — même
 * portée, mots changés, donc nouvelle version.
 */
export const LEAD_APPORTEUR_VSL_CONSENT_VERSION = "lead-apporteur-vsl-v5-2026-10-10";

/**
 * Texte de la case de l'étape 1 (version `LEAD_APPORTEUR_VSL_CONSENT_VERSION`).
 * La page l'affiche telle quelle : toute modification change la version.
 * Vouvoiement. v4 (2026-10-07, décision Will) : plus de « 24 mois après la
 * clôture » — aucun dossier n'est plus supprimé automatiquement. v5 (2026-10-10) :
 * « ma demande » au lieu de « mon inscription ».
 */
export const VSL_CONSENT_TEXTE =
  "J'accepte qu'Axion-IA m'écrive au sujet du réseau d'apporteurs d'affaires, y compris si je ne termine pas ma demande. Données conservées pour garder la trace de nos échanges, jamais vendues ni cédées.";

/** Question fermée de l'étape 2 : une réponse, un geste, obligatoire. */
export const VSL_QUESTION = {
  id: "dirigeants-connus",
  libelle: "Combien de dirigeants connaissez-vous à peu près ?",
} as const;

export const VSL_REPONSES = [
  { id: "moins-5", libelle: "Moins de 5" },
  { id: "5-20", libelle: "De 5 à 20" },
  { id: "20-50", libelle: "De 20 à 50" },
  { id: "plus-50", libelle: "Plus de 50" },
] as const;

export type VslReponseId = (typeof VSL_REPONSES)[number]["id"];

/** Les identifiants de réponse, pour une validation sans zod côté navigateur. */
export const VSL_REPONSE_IDS: readonly string[] = VSL_REPONSES.map((r) => r.id);

/** Libellé d'une réponse (pour la notification à l'équipe). */
export function libelleReponseVsl(id: string | undefined): string {
  return VSL_REPONSES.find((r) => r.id === id)?.libelle ?? "—";
}

/**
 * Variantes du gabarit `lead-apporteur-recu` (pas de nouveau gabarit : un
 * gabarit de plus coûte six points d'enregistrement) et du gabarit
 * `lead-apporteur-relance`.
 *   · A1 `vsl-abandon` : « Votre demande n'est pas terminée » (T0 + 30 min) ;
 *   · B1 `vsl-etape2`  : « C'est noté » + bouton Calendly (étape 2, immédiat) ;
 *   · A2/A3 : relances J+2 / J+7 avec `variante: "vsl"` (« il vous manque une étape »).
 */
export const VARIANTE_VSL_ABANDON = "vsl-abandon";
export const VARIANTE_VSL_ETAPE2 = "vsl-etape2";
export const VARIANTE_VSL_RELANCE = "vsl";

/**
 * Délai minimal entre l'AFFICHAGE de la page et la validation de l'étape 1.
 * En dessous, la ligne est créée mais marquée « suspecte » : ni e-mail, ni
 * notification, ni événement Meta (un faux lead coûte de l'argent et entraîne
 * Meta vers de mauvais profils).
 */
export const DELAI_MIN_ETAPE1_MS = 3_000;

/** Même garde à l'étape 2, comptée depuis l'émission du jeton (téléphone + 1 tap). */
export const DELAI_MIN_ETAPE2_MS = 2_000;

/** Validité du jeton de la visite : 24 h. */
export const VALIDITE_JETON_MS = 24 * 3_600_000;

/**
 * Validité du jeton de REPRISE porté par les e-mails de relance (J+2, J+7).
 * Plus long que celui de la visite : il doit encore vivre au dernier rappel
 * (J+7). Il ne permet QUE de terminer l'inscription de la personne qui a reçu
 * le message à son adresse.
 */
export const VALIDITE_JETON_REPRISE_MS = 10 * 24 * 3_600_000;
