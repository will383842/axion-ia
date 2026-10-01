// Les TEXTES de la page du questionnaire en ligne (2026-10-01), repris mot pour
// mot de l'UX (`_PLAN-SUITE-D-APPEL-2026-09-30/12-questionnaire-en-ligne/2-ux.md`),
// en un seul endroit : la version pas à pas (JavaScript), la version d'un seul
// tenant (sans JavaScript) et les écrans de fin disent la même chose.
//
// Vouvoiement, aucun numéro de téléphone, aucune date butoir, aucune promesse de
// délai. Jamais « facultatif » ni « obligatoire » côté client : le questionnaire
// est PEU CONTRAIGNANT (consigne de Will), la page le montre en tête — nombre de
// questions, durée, « Je ne sais pas » accepté.

/** Durée de l'accueil : 30 secondes par question, arrondie, 1 minute au moins (UX §1.2). */
export function dureeTotale(nombreDeQuestions: number): number {
  return Math.max(1, Math.round(nombreDeQuestions * 0.5));
}

/** Durée restante d'un écran de question : arrondi SUPÉRIEUR de (restantes × 30 s) (UX §1.3). */
export function dureeRestante(questionsRestantes: number): number {
  return Math.max(1, Math.ceil((questionsRestantes * 30) / 60));
}

/**
 * Typographie française : l'espace AVANT « ? ! : ; » devient insécable — sans
 * elle, le « ? » d'une question tombe seul à la ligne à 390 px.
 */
export const insecable = (texte: string): string => texte.replace(/ ([?!:;])/g, " $1");

export const nQuestions = (n: number): string => `${n} question${n > 1 ? "s" : ""}`;
export const mMinutes = (m: number): string => `${m} minute${m > 1 ? "s" : ""}`;

export const TEXTES = {
  marque: "Axion-IA",
  enregistre: "Enregistré",
  // Accueil (§1.2)
  accueilLigne: "Pour préparer notre échange. Vos mots suffisent.",
  environ: "environ",
  tuileSansCompte: "Sans compte",
  tuileJeNeSaisPas: "« Je ne sais pas » accepté",
  tuileRienDeConfidentiel: "Rien de confidentiel",
  commencer: "Commencer",
  reprendre: "Reprendre où j'en étais",
  vousEnEtiez: (n: number) => `Vous en étiez à la question ${n}`,
  accueilGarde: "Arrêtez-vous quand vous voulez, tout est gardé.",
  // Une question (§1.3)
  questionNsurM: (n: number, m: number) => `Question ${n} sur ${m}`,
  environMin: (m: number) => `environ ${m} min`,
  aideParDefaut: "Quelques mots suffisent.",
  placeholderPuces: "Touchez ci-dessus, ou écrivez",
  placeholder: "Quelques mots suffisent",
  puces: "Touchez pour ajouter",
  jeNeSaisPas: "Je ne sais pas",
  accueil: "Accueil",
  precedent: "Précédent",
  suivant: "Suivant",
  relire: "Relire",
  retourRelecture: "Retour à la relecture",
  // Relecture (§1.4)
  derniereEtape: "Dernière étape",
  relectureTitre: "Vos réponses",
  relectureLigne: "Un coup d'œil, puis envoyez.",
  sansReponse: "Sans réponse",
  modifier: "Modifier",
  modifierLaReponse: (n: number) => `Modifier la réponse ${n}`,
  nomFonction: "Votre nom et votre fonction",
  nomFonctionAide: "· si vous le souhaitez",
  definitif:
    "Une fois envoyées, les réponses ne se modifient plus. Une question sans réponse ne bloque rien.",
  envoyer: "Envoyer mes réponses",
  envoiEnCours: "Envoi en cours…",
  // Erreurs (§1.5)
  revenirAuxQuestions: "Revenir aux questions",
  horsLigneTitre: "Pas de connexion",
  horsLigneTexte: "Vos réponses restent sur cet appareil. Réessayez dès que le réseau revient.",
  reessayer: "Réessayer",
  // Merci (§1.6) — « e‑mail » porte un trait d'union INSÉCABLE (U+2011).
  merciTitre: "Merci, c'est reçu",
  merciLigne: "Nous revenons vers vous par e‑mail pour notre échange.",
  merciVosReponses: "Vos réponses",
  merciRecues: "Reçues",
  merciNotreEmail: "Notre e‑mail",
  merciEnsuite: "Ensuite",
  merciFermer: "Vous pouvez fermer cette page.",
  // Déjà envoyé (§1.7)
  dejaPastille: "Déjà envoyé",
  dejaTitre: "Vos réponses sont bien arrivées",
  dejaLigne: "Un ajout ? Écrivez-nous.",
  nousEcrire: "Nous écrire",
  // Lien invalide (§1.8)
  invalidePastille: "Lien invalide",
  invalideTitre: "Ce lien ne fonctionne plus",
  invalideLigne: "Écrivez-nous : nous vous renvoyons le bon.",
  // Sans JavaScript (§1.9)
  sansJsAide: "Si vous ne savez pas, écrivez « Je ne sais pas » ou laissez vide.",
} as const;

export const MESSAGES_ERREUR: Readonly<Record<"vide" | "trop", string>> = {
  vide: "Écrivez au moins une réponse, même « Je ne sais pas ».",
  trop: "Trop d'envois depuis cette connexion. Réessayez dans quelques minutes.",
};

export const ADRESSE_CONTACT = "contact@axion-ia.com";

/** La page d'erreur du segment (`error.tsx`, avis de l'architecte C5). */
export const TEXTES_ERREUR = {
  titre: "L'envoi n'a pas abouti",
  ligne:
    "Vos réponses sont gardées sur cet appareil : réessayez dans quelques minutes, ou écrivez à",
  reessayer: "Réessayer",
} as const;
