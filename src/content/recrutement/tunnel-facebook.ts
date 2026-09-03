// Tunnel Facebook apporteurs d'affaires — CONTENU de la landing `/facebook`
// et de la page `/facebook/merci` (2026-09-03).
//
// ── D'où vient le visiteur, et ce que ça change ─────────────────────────────
// D'un post ou d'une publicité, sur son téléphone, sans rien avoir demandé.
// Il donne dix secondes. Tout ce fichier est écrit pour ces dix secondes :
// une promesse dans SES mots (« tu connais des dirigeants »), une action
// unique (« qu'on m'appelle »), la preuve avant l'argument — et PEU DE TEXTE
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
// 🔴 AUCUN MONTANT EN DUR ICI : ils viennent de `pricing.ts` (SSOT) et sont
// calculés dans la page. Deux barèmes publics ont déjà divergé de 150 € pour
// un montant recopié à la main.
//
// 🔴 AUCUN DÉLAI DE RÉPONSE PROMIS (règle Will 2026-08-23) : « on t'appelle »,
// jamais « sous 48 h ».
//
// TUTOIEMENT, comme tout le tunnel de candidature.

export const TUNNEL_FACEBOOK_META = {
  title: "Apporteur d'affaires IA — on t'appelle",
  description:
    "Tu connais des dirigeants ? Présente-leur Axion-IA, on s'occupe du reste, tu touches une commission sur chaque formation payée. Cinq questions, zéro CV.",
} as const;

export const HERO = {
  badge: "Réseau d'apporteurs d'affaires · toute la France",
  h1: "Tu connais des dirigeants ?",
  h1Em: "Ton carnet d'adresses vaut une commission.",
  chapo:
    "La loi européenne oblige désormais les entreprises à former leurs équipes à l'IA. Tu présentes Axion-IA aux dirigeants que tu connais, on fait tout le reste, tu touches une commission sur chaque formation payée.",
  cta: "Je veux qu'on m'appelle",
  micro: "30 secondes · 5 questions · zéro CV",
} as const;

/** Mentions de confiance INCONDITIONNELLES. Les mentions liées à la
 *  certification vivent dans la page, à côté de l'appel au drapeau. */
export const CONFIANCE_BASE: readonly string[] = [
  "Aucun frais, rien à acheter",
  "Aucune exclusivité, aucun quota",
  "Cumulable avec ton activité",
];

export const FORMULAIRE = {
  titre: "On t'appelle, on t'explique",
  sousTitre: "Cinq questions. Aucun engagement : tu décides après.",
  points: [
    "On t'appelle et on répond à tes questions.",
    "Tu complètes ensuite un dossier de 3 minutes, sans CV.",
    "Tu décides après. Jamais avant.",
  ],
  consent:
    "J'accepte qu'Axion-IA me rappelle et m'écrive au sujet du réseau d'apporteurs d'affaires. Données conservées 2 ans, jamais transmises.",
  bouton: "Je veux qu'on m'appelle",
  micro: "Un e-mail tout de suite, puis un appel de notre part.",
} as const;

export const ETAPES: readonly { readonly titre: string; readonly texte: string }[] = [
  {
    titre: "Tu présentes",
    texte: "Tu parles d'Axion-IA à un dirigeant que tu connais. Il est enregistré à ton nom.",
  },
  {
    titre: "On vend, on forme",
    texte: "On appelle, on chiffre, on facture, on forme. Ni devis, ni négociation pour toi.",
  },
  {
    titre: "Tu es payé",
    texte: "Quand l'entreprise nous a payés, on te paie ta commission.",
  },
];

export const ARGUMENT = {
  titre: "Tu n'arrives pas avec un produit à pousser.",
  em: "Tu arrives avec une obligation légale que le dirigeant ignore.",
} as const;

export const POUR_QUI: readonly string[] = [
  "Tu as vendu aux entreprises, ou tu en visites toute la journée",
  "Consultant, courtier, agent, indépendant",
  "Dirigeant, ancien dirigeant, jeune retraité du commerce",
  "Tu connais des patrons de PME et tu aimes rendre service",
];

export const PAS_POUR_QUI: readonly string[] = [
  "Tu cherches un salaire fixe",
  "Tu ne connais aucun dirigeant",
  "Tu veux un résultat sans passer un coup de fil",
];

export const CARTES_SUR_TABLE: readonly { readonly t: string; readonly d: string }[] = [
  { t: "Aucun frais d'entrée", d: "Rien à acheter, aucun abonnement, aucune avance." },
  { t: "Aucun recrutement en cascade", d: "Ta commission vient des formations vendues, point." },
  { t: "Aucun objectif, aucun quota", d: "Pas de reporting, pas d'exclusivité. Ton rythme." },
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
  description: "On t'appelle. En attendant, deux choses si tu veux.",
  email: "Un e-mail arrive dans les prochaines minutes. Regarde tes spams si tu ne le vois pas.",
  creneauTitre: "Choisis le moment de l'appel",
  creneauTexte: "Réserve un créneau, on t'appelle à ce moment-là. Sinon, on t'appelle nous-mêmes.",
  creneauAbsent: "On t'appelle nous-mêmes. Tu n'as rien à faire de plus.",
  dossierTitre: "Complète ton dossier",
  dossierTexte:
    "Trois minutes, sans CV. Tes coordonnées sont déjà remplies. On prépare l'appel à partir de tes réponses.",
  dossierCta: "Compléter mon dossier",
} as const;

export const PIED = {
  ligne: "Axion-IA · organisme de formation IA pour les entreprises",
} as const;
