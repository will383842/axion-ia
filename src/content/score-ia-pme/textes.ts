// Score IA TPE-PME — textes de la page, du consentement et des écrans.
// Nom PUBLIC : « Score IA TPE-PME » (décision de Williams, 20/11/2026).
// Aucun chiffre en dur hors 4 (minutes), 15, 5, 30, 45 ; les autres viennent des constantes
// ou de `formule.ts` (test T-7). Aucun mot interdit (Qualiopi, OPCO, financement…).

import { NB_CARACTERES } from "@/lib/score-ia-pme/code-retrait";
import {
  CONSENT_VERSION,
  DUREE_CONSERVATION_ANS,
  N_MIN_COMPARAISON,
  N_MIN_STATISTIQUE,
  QUESTIONNAIRE_VERSION,
  SCORE_VERSION,
  TEXTE_CONSENTEMENT,
} from "@/lib/score-ia-pme/constantes";

export { CONSENT_VERSION, TEXTE_CONSENTEMENT };

export const NOM_PUBLIC = "Score IA TPE-PME";
export const NB_QUESTIONS = 15;

export const TITRE_PAGE = `${NOM_PUBLIC} : votre maturité IA en 4 minutes · Axion-IA`;
export const H1 = `${NOM_PUBLIC} : où en est votre entreprise avec l'IA ?`;
export const DESCRIPTION_PAGE =
  "Un questionnaire gratuit pour situer la maturité IA de votre entreprise. Calcul dans votre navigateur, sans e-mail, sans compte.";

export const DEFINITION = `Le ${NOM_PUBLIC} est un questionnaire gratuit de ${NB_QUESTIONS} questions qui situe la maturité d'une entreprise face à l'IA, sur une échelle de zéro à cent, à partir de sept critères : niveau d'avancement, stratégie, usages, équipe formée, temps gagné, budget et outils. Le calcul se fait dans votre navigateur, sans e-mail.`;

export const PHRASE_NEUTRE =
  "Il n'y a pas de bonne réponse : décrivez la situation d'aujourd'hui, pas celle que vous visez.";

export const ENGAGEMENTS = [
  "Sans e-mail",
  "Calcul dans votre navigateur",
  "Vos réponses ne sont envoyées nulle part, sauf si vous choisissez de les ajouter à l'Observatoire",
] as const;

export const BOUTON_COMMENCER = "Commencer";

export const ECRANS = {
  question: (n: number) => `Question ${n} sur ${NB_QUESTIONS}`,
  precedent: "Précédent",
  suivant: "Suivant",
  voirResultat: "Voir mon score",
  votreScore: "Votre score",
  choisirReponse: "Choisissez une réponse pour continuer.",
  plafond: (max: number) => `${max} réponses au plus : décochez-en une pour en choisir une autre.`,
  exclusifRetire: "Les autres choix ont été retirés.",
  incoherence:
    "Vous avez indiqué ne pas utiliser l'IA : vous pouvez revenir à la question précédente si besoin.",
  noteSansEffetSurScore:
    "Cette réponse ne change pas votre score ; elle ne sert que si vous choisissez d'aider l'Observatoire.",
  modifier: "Modifier mes réponses",
  imprimer: "Imprimer ou enregistrer en PDF",
  niveau: "Niveau",
  detail: "Détail par critère",
  pistesTitre: "Pistes pour commencer",
  pistesIntro:
    "Déduites des freins que vous avez cochés. Ce sont des idées de départ, pas un plan.",
  sortiesTitre: "Et maintenant ?",
  sorties: {
    roi: { titre: "Chiffrer vos tâches", texte: "Estimez le temps récupérable, tâche par tâche." },
    journee: {
      titre: "La Journée IA",
      texte: "Un audit le matin, une formation l'après-midi, chez vous.",
    },
    appel: {
      titre: "Diagnostic IA",
      texte: "Un appel gratuit de 45 minutes pour faire le point ensemble.",
    },
  },
} as const;

export const COMPARAISON = {
  titre: "Comparaison avec les autres répondants",
  parTaille: (n: number, taille: string, pct: number) =>
    `Parmi les ${n} répondants de la taille « ${taille} », environ ${pct} % ont un score inférieur au vôtre.`,
  parSecteur: (n: number, pct: number) =>
    `Parmi les ${n} répondants de votre secteur, environ ${pct} % ont un score inférieur au vôtre.`,
  global: (n: number, pct: number) =>
    `Parmi les ${n} répondants, environ ${pct} % ont un score inférieur au vôtre.`,
  secteurAutre: "Comparaison par secteur indisponible pour « Autre secteur ».",
  secteurPasAssez: "Pas encore assez de répondants dans votre secteur pour comparer.",
  tailleAbsente: "Pas encore assez de répondants de votre taille pour comparer.",
  bientot: "La comparaison sera disponible sous peu.",
  methode: (genereLe: string) =>
    `Échantillon volontaire, non pondéré, sans marge d'erreur. Calculé le ${genereLe}, formule ${SCORE_VERSION}. Ces chiffres ne se comparent pas directement à ceux de l'Insee ni d'Eurostat.`,
} as const;

/** Encadré d'information (art. 13 RGPD) au-dessus de la case. Texte validé par Williams le 20/11/2026. */
export function encadreInformation(responsable: string, contact: string): readonly string[] {
  return [
    "Votre score est calculé dans votre navigateur : jusqu'ici, rien n'a été envoyé.",
    `Si vous cochez la case, vos ${NB_QUESTIONS} réponses servent uniquement à publier des statistiques d'ensemble, jamais réponse par réponse, ni pour un groupe de moins de ${N_MIN_STATISTIQUE} entreprises.`,
    `Nous n'enregistrons ni votre nom, ni votre e-mail, ni votre adresse IP, ni votre score. Seuls vos réponses et le jour d'envoi sont gardés, ${DUREE_CONSERVATION_ANS} ans.`,
    "Un code de retrait s'affiche une seule fois après l'envoi. Sans lui, nous ne pouvons pas retrouver vos réponses, car nous ne savons pas qui vous êtes. Les statistiques déjà publiées ne changent pas.",
    `Responsable : ${responsable}, ${contact}. Vous pouvez saisir la CNIL (cnil.fr).`,
  ];
}

export const AJOUT = {
  titre: "Aider l'Observatoire de l'IA (facultatif)",
  bouton: "Ajouter mes réponses",
  antiRobotEnCours: "Vérification anti-robot en cours : réessayez dans un instant.",
  caseManquante: "Cochez la case pour envoyer vos réponses",
  enCours: "Envoi en cours…",
  confirmation: "Merci, vos réponses ont été ajoutées.",
  codeTitre: "Votre code de retrait",
  codeAvertissement:
    "Sans ce code, nous ne pouvons pas retrouver vos réponses, car nous ne savons pas qui vous êtes.",
  copier: "Copier",
  copie: "Code copié",
  echec: "L'ajout n'a pas abouti. Votre score reste affiché ; rien n'a été enregistré.",
  antiRobotBloque:
    "La vérification anti-robot n'a pas pu se charger. Rien n'a été envoyé ; votre score reste affiché.",
  lienConfidentialite: "En savoir plus : politique de confidentialité",
  dejaAjoute: "Vos réponses ont déjà été ajoutées depuis ce navigateur.",
} as const;

export const RETRAIT = {
  titre: "Retirer mes réponses",
  intro: "Saisissez le code de retrait affiché après l'envoi. Vos réponses seront supprimées.",
  champ: "Code de retrait",
  bouton: "Retirer mes réponses",
  vide: "Saisissez votre code de retrait.",
  invalide: `Ce code est incomplet : il compte ${NB_CARACTERES} caractères (${NB_CARACTERES / 4} groupes de 4).`,
  antiRobotEnCours: "Vérification anti-robot en cours : réessayez dans un instant.",
  erreur: "Une erreur est survenue. Réessayez plus tard.",
  antiRobotBloque: "La vérification anti-robot n'a pas pu se charger. Réessayez plus tard.",
} as const;

export const METHODE = {
  titre: "Méthode",
  faqTitre: "Questions fréquentes",
  mesure:
    "Le Score IA TPE-PME mesure l'adoption de l'IA : usages, outils, équipe, stratégie, temps gagné et moyens. Il ne mesure pas la qualité de vos données ni votre sécurité informatique.",
  conventions:
    "Les poids et les niveaux sont fixés par Axion-IA, par convention, avec des niveaux de largeur égale. Ils seront revus, dans une nouvelle version publiée, quand assez de réponses permettront de les vérifier. Toute modification crée une nouvelle version et est signalée ici : jamais de changement silencieux.",
  taille:
    "La comparaison se fait à taille égale : le score ne récompense pas simplement la taille de l'entreprise.",
  echantillon: `Les statistiques viennent uniquement des réponses données ici, avec la case cochée. Un groupe n'est comparé qu'à partir de ${N_MIN_COMPARAISON} répondants, et aucune statistique n'est publiée en dessous de ${N_MIN_STATISTIQUE}. L'échantillon est volontaire et non pondéré : il ne représente pas l'ensemble des entreprises.`,
  officielles:
    "Pour des chiffres officiels, consultez directement les enquêtes de l'Insee et d'Eurostat sur l'usage de l'IA par les entreprises. Leur question et leur champ sont différents des nôtres : les résultats ne se comparent pas directement.",
  liens: [
    {
      label: "Insee : enquête sur les technologies de l'information et de la communication",
      href: "https://www.insee.fr/fr/metadonnees/source/operation/s2132/presentation",
    },
    {
      label: "Eurostat : usage de l'intelligence artificielle dans les entreprises",
      href: "https://ec.europa.eu/eurostat/statistics-explained/index.php/Use_of_artificial_intelligence_in_enterprises",
    },
  ],
  versionLibelle: (dateMaj: string) =>
    `Formule ${SCORE_VERSION} · questionnaire ${QUESTIONNAIRE_VERSION} · mise à jour le ${dateMaj}`,
  formuleTitre: "La formule",
  formuleIntro:
    "Le score est la moyenne des points de chaque critère, pondérée par le poids du critère. Si vous répondez « Je ne sais pas » au budget, ce critère est retiré du calcul.",
  niveauxTitre: "Les niveaux",
  colonnes: { critere: "Critère", poids: "Poids", reponses: "Réponses" },
} as const;

export const CRITERES_LIBELLES: Readonly<Record<string, string>> = {
  maturityLevel: "Niveau d'avancement",
  hasStrategy: "Stratégie écrite",
  useCases: "Usages",
  teamTrained: "Équipe formée",
  timeSavedPerDay: "Temps gagné",
  annualBudget: "Budget",
  tools: "Outils",
};

export const FAQ: ReadonlyArray<{ q: string; r: string }> = [
  {
    q: "Mes réponses sont-elles envoyées quelque part ?",
    r: "Non, pas tant que vous ne cochez pas la case de l'Observatoire et ne cliquez pas sur « Ajouter mes réponses ». Jusque-là, tout se passe dans votre navigateur : aucun e-mail, aucun compte, aucun cookie.",
  },
  {
    q: "Comment le score est-il calculé ?",
    r: "Chaque critère rapporte des points selon votre réponse, pondérés par son poids. Le tableau de la formule est publié plus bas, avec les niveaux.",
  },
  {
    q: "À qui suis-je comparé ?",
    r: `Aux entreprises de même taille qui ont ajouté leurs réponses à l'Observatoire depuis cet outil, dès que ce groupe compte ${N_MIN_COMPARAISON} répondants. L'échantillon est volontaire : la comparaison est indicative.`,
  },
  {
    q: "Puis-je retirer mes réponses ?",
    r: "Oui, à tout moment, avec le code de retrait affiché une seule fois après l'envoi. Sans ce code, nous ne pouvons pas retrouver vos réponses, car nous ne savons pas qui vous êtes.",
  },
];

export const OBSERVATOIRE = {
  titre: "L'Observatoire de l'IA",
  texte:
    "Une fois votre score affiché, vous pouvez choisir d'ajouter vos réponses à l'Observatoire de l'IA d'Axion-IA. C'est facultatif, et rien n'est envoyé sans votre accord explicite.",
} as const;
