// Tunnel Facebook apporteurs d'affaires — CONTENU du formulaire court de `/apporteur-affaires`
// et de la page `/apporteur-affaires/merci`.
//
// Refonte du 09/11/2026 : la landing est générée depuis la maquette validée par Williams
// (`src/components/recrutement/landings/`). Les titres, les sections et les montants y vivent ;
// ce fichier ne garde que les textes que le formulaire court et la page merci lisent encore.
//
// ── Les contraintes qui ont écrit chaque phrase ─────────────────────────────
//  1. VOCABULAIRE (décision Will 2026-09-03) : « apporteur d'affaires », jamais
//     « commercial », « poste », « recrute », « salaire », « objectif ».
//  2. RÈGLES META : la pub ET la page d'arrivée sont vérifiées. Aucune promesse
//     de revenus, aucun parrainage, aucun frais, rien à acheter.
//  3. FORMULATION INDICATIVE : la commission est « à titre indicatif ». Aucun
//     montant n'est écrit ici : il vient de `pricing.ts` (SSOT).
//
// 🔴 AUCUN DÉLAI DE RÉPONSE PROMIS (règle Will 2026-08-23) : « nous vous répondons »,
// jamais « sous 48 h ».
//
// 🔴 AUCUN APPEL PROMIS (décision Will 2026-09-19, B4). L'échange de 15 minutes part sur
// invitation, depuis la console, aux seuls profils retenus.
//
// VOUVOIEMENT, comme tout le tunnel de candidature (décision Will du 29/09/2026).
//
// 🔴 AUCUNE INVITATION PROMISE ICI : ce formulaire court n'envoie PAS l'invitation automatique
// (réservée au dossier complet, `invitation-auto.ts`). Il envoie le kit, puis des rappels pour
// compléter le dossier.

export const TUNNEL_FACEBOOK_META = {
  title: "Présentez la Journée IA aux dirigeants que vous connaissez",
  description:
    "Vous connaissez des dirigeants ? Présentez-leur la Journée IA, nous faisons le reste. Sans CV, sans frais d'entrée, sans exclusivité.",
} as const;

export const HERO = {
  cta: "Recevoir le kit",
  micro: "30 secondes · 4 champs · zéro CV",
} as const;

export const FORMULAIRE = {
  titre: "Recevez la Journée IA en une page",
  sousTitre: "La fiche à transmettre et la phrase à dire. Aucun engagement : vous décidez après.",
  points: [
    "Nous vous répondons par e-mail et répondons à vos questions.",
    "Vous complétez ensuite un dossier de 3 minutes, sans CV.",
    "Vous décidez après. Jamais avant.",
  ],
  // ⚠️ Texte versionné : toute modification change `LEAD_APPORTEUR_CONSENT_VERSION`
  // (`lib/commercial-application/lead-apporteur.ts`) — la preuve enregistrée
  // doit pointer vers le texte réellement coché. v2 (2026-09-19) : plus de
  // rappel promis, et « jamais transmises » devient « jamais vendues ni
  // cédées » (nos sous-traitants d'envoi et de notification les reçoivent :
  // le texte doit dire vrai). v3 (2026-10-07) : plus de durée promise — aucun
  // dossier n'est supprimé automatiquement (décision de Will).
  consent:
    "J'accepte qu'Axion-IA m'écrive au sujet du réseau d'apporteurs d'affaires. Données conservées pour garder la trace de nos échanges, jamais vendues ni cédées.",
  bouton: "Recevoir le kit",
  // JUR-T44b : le document de présentation est retiré jusqu'à sa réécriture (JUR-T45).
  micro: "Un e-mail tout de suite, avec le catalogue de nos prestations.",
} as const;

export const MERCI = {
  title: "C'est noté 🎉",
  description: "En attendant, deux choses si vous le souhaitez.",
  email:
    "Un e-mail arrive dans les prochaines minutes. Regardez vos courriers indésirables si vous ne le voyez pas.",
  // 2026-09-19 — le bloc « choisis le moment de l'appel » est remplacé par le
  // KIT : le lien de réservation n'est plus distribué à tous (il saturerait
  // l'agenda de Will), il part sur invitation depuis la console.
  kitTitre: "Découvrez ce que vous allez présenter",
  // JUR-T44 : le document de présentation est retiré jusqu'à sa réécriture
  // (`DOCUMENT_APPORTEUR_DIFFUSE`) ; seul le catalogue est donné ici.
  kitTexte:
    "La Journée IA, et le catalogue de nos prestations pour aller plus loin. Vous le retrouvez aussi dans l'e-mail.",
  kitDocument: "Le document de présentation",
  kitCatalogue: "Le catalogue des prestations",
  dossierTitre: "Complétez votre dossier",
  dossierTexte:
    "Trois minutes, sans CV. Vos coordonnées sont déjà remplies. Vos réponses nous disent si un échange de 15 minutes a du sens.",
  dossierCta: "Compléter mon dossier",
} as const;

export const PIED = {
  ligne: "Axion-IA · organisme de formation IA pour les entreprises",
} as const;
