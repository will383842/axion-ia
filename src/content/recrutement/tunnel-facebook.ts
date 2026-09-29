// Tunnel Facebook apporteurs d'affaires — CONTENU de la landing `/apporteur-affaires`
// et de la page `/apporteur-affaires/merci` (2026-09-03).
//
// ── D'où vient le visiteur, et ce que ça change ─────────────────────────────
// D'un post ou d'une publicité, sur son téléphone, sans rien avoir demandé.
// Il donne dix secondes. Tout ce fichier est écrit pour ces dix secondes :
// une promesse dans SES mots (« vous connaissez des dirigeants »), une action
// unique (« recevoir le kit »), la preuve avant l'argument — et PEU DE TEXTE
// (demande Will 2026-09-03 : « pas trop de blabla »). Une phrase par idée.
//
// ── Les trois contraintes qui ont écrit chaque phrase ───────────────────────
//  1. VOCABULAIRE (décision Will 2026-09-03) : « apporteur d'affaires », jamais
//     « commercial », « poste », « recrute », « salaire », « objectif ». C'est
//     aussi la première pièce du faisceau anti-requalification
//     (`docs/partners/ANTI-REQUALIFICATION.md`) : la pratique QUOTIDIENNE
//     commence par l'annonce.
//  2. RÈGLES META : la pub ET la page d'arrivée sont vérifiées. Aucune promesse
//     de revenus (« sans plafond », « revenus » en titre), aucun parrainage
//     (un second niveau ressemble à du MLM), et les trois phrases qui
//     distinguent l'apport d'affaires d'une arnaque : aucun frais, rien à
//     acheter, aucun recrutement d'autres personnes.
//  3. FORMULATION INDICATIVE (W12, `GRILLE-PAR-APPORTEUR-ET-PERIMETRE.md`) :
//     la grille d'un contrat peut descendre sous la grille publiée, donc les
//     montants publics sont des PLAFONDS — « jusqu'à », « exemple de calcul »,
//     jamais un chiffre nu.
//
//     ⚠️ EXCEPTION DU HÉRO — LEVÉE. Le 2026-09-04, Will avait assumé un montant
//     NU au héro, sans « jusqu'à » (motif : un visiteur venu d'un post Facebook
//     s'arrête deux secondes, et « jusqu'à » tue l'accroche). Ce que ça coûtait :
//     un contrat dont la grille descend sous la grille publiée contredisait une
//     page publique, et Meta lit un montant nu comme une promesse de revenus.
//     Exception levée le 2026-09-29 par arbitrage -d7 (délégation de Williams),
//     qui pourra la rétablir : face à JUR-T29, le héro passe au registre
//     indicatif. Le chiffre reste en grand (le design de l'accroche) et
//     « À titre indicatif » est écrit à côté, à deux lignes au plus, en tokens.
//     La garde `jur:remuneration-indicative` ne nomme AUCUNE exception pour lui.
//
// 🔴 AUCUN MONTANT EN DUR ICI : ils viennent de `pricing.ts` (SSOT) et sont
// calculés dans la page. Deux barèmes publics ont déjà divergé de 150 € pour
// un montant recopié à la main.
//
// 🔴 AUCUN DÉLAI DE RÉPONSE PROMIS (règle Will 2026-08-23) : « nous vous répondons »,
// jamais « sous 48 h ».
//
// 🔴 AUCUN APPEL PROMIS (décision Will 2026-09-19, B4). L'échange de
// 15 minutes part sur invitation, depuis la console, aux seuls profils
// retenus : le promettre à chaque personne qui laisse son numéro, c'était
// annoncer un service qu'on ne rend pas. Ce qui arrive vraiment, et que la
// page dit : le kit par e-mail tout de suite, puis une réponse.
//
// VOUVOIEMENT, comme tout le tunnel de candidature (décision Will du 29/09/2026 :
// « on reste sur le vouvoiement »).
//
// 🔴 AUCUNE INVITATION PROMISE ICI : ce formulaire court n'envoie PAS
// l'invitation automatique (réservée au dossier complet, `invitation-auto.ts`).
// Il envoie le kit, puis des rappels pour compléter le dossier.

export const TUNNEL_FACEBOOK_META = {
  title: "Apporteur d'affaires IA : recommandez, sans vendre",
  description:
    "Vous connaissez des dirigeants ? Présentez-leur Axion-IA, nous faisons le reste : une commission indicative par formation payée. 4 champs, zéro CV.",
} as const;

export const HERO = {
  badge: "Réseau d'apporteurs d'affaires · partout en France",
  h1: "Vous connaissez des dirigeants ?",
  h1Em: "Votre carnet d'adresses vaut une commission.",
  /** Bloc du montant — LE point d'accroche des deux premières secondes.
   *  Le chiffre lui-même n'est PAS ici : il est dérivé de
   *  `COMMISSION_FORMATION_PAR_JOURNEE_EUR` (`pricing.ts`, SSOT) par la page.
   *  Deux barèmes publics ont déjà divergé de 150 € pour un montant recopié. */
  // « À titre indicatif » est écrit dans la page, à côté du chiffre : la légende
  // ne le répète pas, elle dit de quoi il dépend.
  montantLegende: "par journée de formation vendue, selon votre profil",
  montantSous: "Versé dès que l'entreprise nous a payés.",
  chapo:
    "La loi européenne oblige désormais les entreprises à former leurs équipes à l'IA. Vous présentez Axion-IA aux dirigeants que vous connaissez, nous faisons tout le reste, vous touchez une commission sur chaque formation payée, selon un barème indicatif.",
  cta: "Recevoir le kit",
  micro: "30 secondes · 4 champs · zéro CV",
  /** Couverture nationale, dite en clair sous le formulaire ET dans le héro :
   *  la question « est-ce que ça marche chez moi ? » est le premier frein d'un
   *  visiteur qui n'est ni à Paris ni à Lyon. Aucune restriction géographique
   *  n'existe côté serveur (`ville` est un champ libre). */
  france: "Partout en France — votre ville n'a aucune importance.",
} as const;

/** Mentions de confiance INCONDITIONNELLES. Les mentions liées à la
 *  certification vivent dans la page, à côté de l'appel au drapeau. */
export const CONFIANCE_BASE: readonly string[] = [
  "Aucun frais, rien à acheter",
  "Aucune exclusivité, aucun quota",
  "Cumulable avec votre activité",
];

export const FORMULAIRE = {
  titre: "Recevez le kit, nous vous répondons",
  sousTitre: "Quatre champs. Aucun engagement : vous décidez après.",
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
  // le texte doit dire vrai).
  consent:
    "J'accepte qu'Axion-IA m'écrive au sujet du réseau d'apporteurs d'affaires. Données conservées 24 mois après la clôture de mon dossier, jamais vendues ni cédées.",
  bouton: "Recevoir le kit",
  micro: "Un e-mail tout de suite, avec le document de présentation et le catalogue.",
} as const;

export const ETAPES: readonly { readonly titre: string; readonly texte: string }[] = [
  {
    titre: "Vous présentez",
    texte:
      "Vous parlez d'Axion-IA à un dirigeant que vous connaissez. Il est enregistré à votre nom.",
  },
  {
    titre: "On vend, on forme",
    texte: "Nous appelons, chiffrons, facturons, formons. Ni devis, ni négociation pour vous.",
  },
  {
    titre: "Vous êtes payé",
    texte: "Quand l'entreprise nous a payés, nous vous versons votre commission.",
  },
];

export const ARGUMENT = {
  titre: "Vous n'arrivez pas avec un produit à pousser.",
  em: "Vous arrivez avec une obligation légale que le dirigeant ignore.",
} as const;

export const POUR_QUI: readonly string[] = [
  "Vous avez vendu aux entreprises, ou vous en visitez toute la journée",
  "Consultant, courtier, agent, indépendant",
  "Dirigeant, ancien dirigeant, jeune retraité du commerce",
  "Vous connaissez des patrons de PME et aimez rendre service",
];

export const PAS_POUR_QUI: readonly string[] = [
  "Vous cherchez un salaire fixe",
  "Vous ne connaissez aucun dirigeant",
  "Vous voulez un résultat sans passer un coup de fil",
];

export const CARTES_SUR_TABLE: readonly { readonly t: string; readonly d: string }[] = [
  { t: "Aucun frais d'entrée", d: "Rien à acheter, aucun abonnement, aucune avance." },
  { t: "Aucun recrutement en cascade", d: "Votre commission vient des formations vendues, point." },
  { t: "Aucun objectif, aucun quota", d: "Pas de reporting, pas d'exclusivité. Votre rythme." },
  {
    t: "Pas de salaire fixe",
    d: "Une commission sur les ventes réelles, une fois la facture réglée.",
  },
];

export const FONDATEUR = {
  eyebrow: "Qui est derrière",
  citation:
    "« On cherche des gens qui connaissent des dirigeants et qui aiment rendre service. Le reste, c'est notre métier. »",
  nom: "Williams",
  role: "Fondateur d'Axion-IA, organisme de formation IA pour les entreprises",
  photo: "/illustrations/devenir-commercial-fondateur.webp",
  alt: "Williams, fondateur d'Axion-IA",
} as const;

export const MERCI = {
  title: "C'est noté 🎉",
  description: "En attendant, deux choses si vous le souhaitez.",
  email:
    "Un e-mail arrive dans les prochaines minutes. Regardez vos courriers indésirables si vous ne le voyez pas.",
  // 2026-09-19 — le bloc « choisis le moment de l'appel » est remplacé par le
  // KIT : le lien de réservation n'est plus distribué à tous (il saturerait
  // l'agenda de Will), il part sur invitation depuis la console.
  kitTitre: "Découvrez ce que vous pourrez recommander",
  kitTexte:
    "Le document de présentation — statut, commissions, fonctionnement — et le catalogue complet de nos prestations : formations, audit IA, accompagnement, implémentation. Vous les retrouvez aussi dans l'e-mail.",
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
