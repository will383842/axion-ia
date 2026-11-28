// Questionnaire du Baromètre 2027 — textes et questions (version « q-v5 »).
// Les valeurs d'options sont des slugs ASCII stables ; seuls les libellés sont lus par les personnes.

import { STUDY_REGIONS } from "@/content/observatoire/study";
import {
  CONSERVATION_MOIS,
  DATE_DEBUT_COLLECTE,
  N_MIN_PUBLICATION,
  SEUIL_PUBLICATION_REPONSES,
} from "@/lib/barometre-questionnaire/constantes";

export interface OptionQ {
  readonly value: string;
  readonly label: string;
  /** Réponse qui s'exclut de toutes les autres (case à choix multiple). */
  readonly exclusive?: boolean;
}

export const TITRE_PAGE = "Questionnaire : l'IA dans les TPE et PME (Baromètre 2027)";
export const DESCRIPTION_PAGE =
  "Questionnaire du Baromètre 2027 de l'IA dans les TPE et PME : 14 questions fermées et 2 questions ouvertes, 5 minutes au plus.";
export const H1 = "L'IA dans les TPE et PME : le questionnaire du Baromètre 2027";
export const DUREE = "Durée : 5 minutes maximum. 14 questions fermées + 2 questions ouvertes.";

const RETRAIT_FERME =
  "Si vous avez déjà répondu, vous pouvez retirer vos réponses avec votre code de retrait, ci-dessous.";

export const FERME = {
  titre: "Le questionnaire n'est pas encore ouvert.",
  texte: `La collecte n'est pas encore ouverte : elle ouvre le 28 novembre 2026, puis reste ouverte en continu. ${RETRAIT_FERME}`,
  /** Une fois le 28 novembre 2026 passé, aucune date n'est affichée (l'interrupteur peut rester éteint). */
  texteSansDate: `La collecte n'est pas ouverte pour le moment. ${RETRAIT_FERME}`,
} as const;

/** Texte « fermé » adapté à la date : jamais une date de début déjà passée. */
export function texteFerme(now: Date): string {
  return now.getTime() >= Date.parse(`${DATE_DEBUT_COLLECTE}T00:00:00.000Z`)
    ? FERME.texteSansDate
    : FERME.texte;
}

/** Mention d'information, affichée en tête du formulaire. */
export const RGPD: ReadonlyArray<{ titre: string; texte: string }> = [
  {
    titre: "Responsable du traitement et contact",
    texte:
      "Axion-IA OÜ, éditeur du site axion-ia.com. Pour toute question ou pour exercer vos droits, utilisez la page contact du site : axion-ia.com/contact.",
  },
  {
    titre: "Finalité",
    texte:
      "vos réponses servent uniquement à des fins statistiques, pour établir le Baromètre 2027 de l'IA dans les TPE et PME.",
  },
  {
    titre: "Base légale",
    texte:
      "votre consentement, que vous donnez en cochant la case prévue avant l'envoi du formulaire.",
  },
  {
    titre: "Données",
    texte:
      "nous ne demandons ni votre nom, ni le nom de votre entreprise, ni vos coordonnées. Vos réponses ne sont pas nominatives. N'indiquez ni nom ni information permettant de vous identifier dans les réponses libres.",
  },
  {
    titre: "Durée de conservation des réponses",
    texte: `${CONSERVATION_MOIS} mois après la date de votre envoi (chaque réponse a sa propre échéance) ; ensuite, seules des statistiques agrégées sont gardées.`,
  },
  {
    titre: "Destinataire",
    texte: `l'éditeur seul lit les réponses brutes. Les résultats publiés sont agrégés : publiés à partir de ${SEUIL_PUBLICATION_REPONSES} réponses, puis mis à jour régulièrement.`,
  },
  {
    titre: "Hébergement et transferts",
    texte:
      "les réponses sont collectées sur axion-ia.com et hébergées chez Hetzner (Union européenne). La vérification anti-robot Turnstile de Cloudflare (États-Unis) reçoit votre adresse IP ; voir la page Sous-processeurs.",
  },
  {
    titre: "Vos droits",
    texte:
      "vous disposez des droits d'accès, de rectification, d'effacement, d'opposition et de portabilité, et du droit de retirer votre consentement à tout moment, à exercer par la page contact du site. Vous pouvez retirer votre consentement à tout moment avant l'envoi en quittant le formulaire. Après l'envoi, un code de retrait s'affiche une seule fois : il permet de retirer vos réponses. Sans ce code, nous ne pouvons pas les retrouver, car elles ne sont pas nominatives (article 11 du RGPD). Vous pouvez aussi introduire une réclamation auprès de la CNIL (www.cnil.fr).",
  },
  {
    titre: "Publication",
    texte: `aucun résultat publié ne portera sur un croisement de moins de ${N_MIN_PUBLICATION} réponses.`,
  },
];

export const TEXTE_CONSENTEMENT =
  "J'accepte que mes réponses, sans nom ni e-mail, servent au Baromètre 2027 de l'IA dans les TPE et PME d'Axion-IA. Je peux les retirer avec mon code.";

export const FORMULAIRE = {
  bouton: "Envoyer mes réponses",
  enCours: "Envoi en cours…",
  caseManquante: "Cochez la case pour envoyer vos réponses.",
  champsManquants:
    "Merci de répondre à toutes les questions obligatoires (marquées d'un astérisque).",
  antiRobotBloque: "La vérification anti-robot n'a pas pu se charger. Rien n'a été envoyé.",
  antiRobotEnCours: "La vérification anti-robot est en cours. Réessayez dans un instant.",
  echec: "Une erreur est survenue. Rien n'a été enregistré.",
  dejaEnvoye: "Vous avez déjà envoyé vos réponses depuis ce navigateur. Merci !",
  confirmation: "Merci, vos réponses sont enregistrées.",
  codeTitre: "Votre code de retrait",
  codeAvertissement:
    "Notez ce code maintenant : il ne s'affichera plus. Il permet de retirer vos réponses ; sans lui, nous ne pouvons pas les retrouver.",
  copier: "Copier le code",
  copie: "Code copié.",
  facultatif: "(facultatif)",
  obligatoire: "Obligatoire",
  choixMax: "3 réponses maximum",
  choisir: "Choisissez…",
} as const;

export const RETRAIT = {
  titre: "Retirer mes réponses",
  intro:
    "Saisissez le code de retrait affiché après votre envoi. Le code ne quitte pas votre navigateur : seule son empreinte est envoyée. Le retrait reste possible à tout moment, tant que la réponse existe.",
  champ: "Code de retrait",
  bouton: "Retirer mes réponses",
  vide: "Saisissez votre code de retrait.",
  invalide: "Ce code n'a pas la bonne forme (16 caractères).",
  antiRobotBloque: "La vérification anti-robot n'a pas pu se charger. Rien n'a été retiré.",
  antiRobotEnCours: "La vérification anti-robot est en cours. Réessayez dans un instant.",
  erreur:
    "Le retrait n'a pas pu être fait. Rien n'a changé : réessayez dans quelques minutes, avec le même code.",
  ouvrir: "Retirer mes réponses avec mon code",
} as const;

// ───────────────────────────── Questions ─────────────────────────────

export const Q1: ReadonlyArray<OptionQ> = [
  { value: "0", label: "0" },
  { value: "1-4", label: "1 à 4" },
  { value: "5-9", label: "5 à 9" },
  { value: "10-19", label: "10 à 19" },
  { value: "20-49", label: "20 à 49" },
  { value: "50-249", label: "50 à 249" },
  { value: "250-et-plus", label: "250 ou plus" },
];

export const Q2: ReadonlyArray<OptionQ> = [
  { value: "banque-assurance", label: "Activités financières / assurances" },
  { value: "agriculture", label: "Agriculture" },
  { value: "batiment-construction", label: "Bâtiment / Construction" },
  { value: "commerce", label: "Commerce (détail et gros)" },
  { value: "hebergement-restauration", label: "Hébergement / Restauration" },
  { value: "agroalimentaire", label: "Industrie agroalimentaire" },
  {
    value: "industrie-artisanat",
    label: "Industrie et fabrication artisanale (hors agroalimentaire)",
  },
  { value: "numerique", label: "Numérique (information, communication)" },
  {
    value: "services-personne",
    label: "Services à la personne (santé, action sociale, enseignement…)",
  },
  {
    value: "services-specialises",
    label: "Services spécialisés / techniques (conseil, ingénierie, immobilier…)",
  },
  { value: "transport-logistique", label: "Transport / Logistique" },
  { value: "autre", label: "Autre" },
];

/** Les 13 régions de France métropolitaine (slugs du site) + « Outre-mer ». */
export const Q3: ReadonlyArray<OptionQ> = [
  ...STUDY_REGIONS.map((r) => ({ value: r.slug, label: r.nameFr })),
  { value: "outre-mer", label: "Outre-mer" },
];

export const Q4: ReadonlyArray<OptionQ> = [
  { value: "oui-regulierement", label: "Oui, régulièrement" },
  { value: "oui-de-temps-en-temps", label: "Oui, de temps en temps" },
  { value: "non-j-y-pense", label: "Non, mais j'y pense" },
  { value: "non-pas-prevu", label: "Non, et je n'y pense pas" },
];
/** Réponses « non » à la question 4 : les questions 5 à 9 ne sont alors pas posées. */
export const Q4_NON: ReadonlyArray<string> = ["non-j-y-pense", "non-pas-prevu"];

export const Q5: ReadonlyArray<OptionQ> = [
  { value: "assistant-grand-public", label: "Assistant conversationnel grand public" },
  { value: "outil-integre", label: "Outil intégré à un logiciel que j'utilise déjà" },
  { value: "images-videos", label: "Outil de génération d'images ou de vidéos" },
  { value: "transcription", label: "Outil de transcription ou de compte rendu" },
  { value: "outil-metier", label: "Outil spécialisé pour mon métier" },
  { value: "autre", label: "Autre" },
  { value: "ne-sais-pas", label: "Je ne sais pas", exclusive: true },
];

export const Q6: ReadonlyArray<OptionQ> = [
  { value: "gratuites", label: "Principalement gratuites" },
  { value: "payantes", label: "Principalement payantes" },
  { value: "les-deux", label: "Les deux" },
  { value: "ne-sais-pas", label: "Je ne sais pas" },
];

export const Q7: ReadonlyArray<OptionQ> = [
  { value: "rediger", label: "Rédiger (e-mails, textes, devis)" },
  { value: "communication", label: "Communication et réseaux sociaux" },
  { value: "recherche", label: "Recherche d'informations" },
  { value: "traduction", label: "Traduction" },
  { value: "analyse", label: "Analyse de documents ou de données" },
  { value: "compta-gestion", label: "Comptabilité / gestion" },
  { value: "service-client", label: "Service client" },
  { value: "recrutement-rh", label: "Recrutement / ressources humaines" },
  { value: "automatisation", label: "Automatiser des tâches répétitives" },
  { value: "autre", label: "Autre" },
  { value: "ne-sais-pas", label: "Je ne sais pas", exclusive: true },
];

export const Q8: ReadonlyArray<OptionQ> = [
  { value: "moins-6-mois", label: "Moins de 6 mois" },
  { value: "6-12-mois", label: "6 à 12 mois" },
  { value: "1-2-ans", label: "1 à 2 ans" },
  { value: "plus-2-ans", label: "Plus de 2 ans" },
];

export const Q9: ReadonlyArray<OptionQ> = [
  { value: "gain-de-temps", label: "Gain de temps" },
  { value: "meilleure-qualite", label: "Meilleure qualité de mes productions" },
  { value: "nouvelles-idees", label: "Nouvelles idées ou nouveaux services" },
  { value: "plus-de-clients", label: "Plus de clients" },
  { value: "effet-negatif", label: "Effet négatif (erreurs, perte de temps…)" },
  {
    value: "cout-apprentissage",
    label: "Coût ou temps d'apprentissage supérieur au bénéfice",
  },
  { value: "aucun-effet", label: "Aucun effet notable", exclusive: true },
  { value: "ne-sais-pas-encore", label: "Je ne sais pas encore", exclusive: true },
];

/** Question 10 : 3 réponses au plus ; l'ordre est mélangé à l'affichage, « Aucun frein » reste dernier. */
export const Q10: ReadonlyArray<OptionQ> = [
  { value: "competences", label: "Manque de compétences" },
  { value: "temps", label: "Manque de temps" },
  { value: "cout", label: "Coût perçu" },
  { value: "donnees", label: "Qualité ou disponibilité des données" },
  { value: "confiance", label: "Confiance dans les résultats" },
  { value: "protection-donnees", label: "Protection des données et confidentialité" },
  { value: "reglementation", label: "Incertitude sur la réglementation" },
  { value: "incompatibilite", label: "Incompatibilité avec mes outils actuels" },
  { value: "inutile", label: "L'IA ne me semble pas utile pour mon activité" },
  { value: "aucun-frein", label: "Aucun frein", exclusive: true },
];
export const Q10_MAX = 3;

export const Q11: ReadonlyArray<OptionQ> = [
  { value: "oui-ecrites", label: "Oui, écrites" },
  { value: "oui-orales", label: "Oui, orales" },
  { value: "non", label: "Non" },
  { value: "ne-sais-pas", label: "Je ne sais pas" },
];

export const Q12: ReadonlyArray<OptionQ> = [
  { value: "oui-moi", label: "Oui, moi" },
  { value: "oui-salaries", label: "Oui, des salariés" },
  { value: "oui-les-deux", label: "Oui, les deux" },
  { value: "non", label: "Non" },
  { value: "ne-sais-pas", label: "Je ne sais pas" },
];
/** Réponses de la question 12 masquées quand l'entreprise n'a aucun salarié (question 1 = 0). */
export const Q12_AVEC_SALARIES: ReadonlyArray<string> = ["oui-salaries", "oui-les-deux"];

export const Q13: ReadonlyArray<OptionQ> = [
  { value: "oui", label: "Oui" },
  { value: "non", label: "Non" },
  { value: "ne-sais-pas", label: "Je ne sais pas" },
];

export const Q14: ReadonlyArray<OptionQ> = [
  { value: "decouvrir", label: "Découvrir les outils" },
  { value: "bien-demander", label: "Bien rédiger ses demandes" },
  { value: "choisir-outil", label: "Choisir un outil adapté à mon métier" },
  { value: "donnees-reglementation", label: "Protection des données et réglementation" },
  { value: "organiser-equipe", label: "Organiser l'usage dans l'équipe" },
  { value: "verifier", label: "Vérifier les résultats" },
  { value: "autre", label: "Autre" },
];

export const LIBELLES_QUESTIONS = {
  q1: "Combien de salariés compte votre entreprise ?",
  q2: "Dans quel secteur travaille votre entreprise ? (une seule réponse)",
  q3: "Dans quelle région se situe votre entreprise ?",
  q4: "Utilisez-vous des outils d'IA (assistants conversationnels, génération de texte ou d'images, etc.) au sein de votre entreprise, à des fins professionnelles ?",
  q5: "Quels outils utilisez-vous ? (plusieurs réponses possibles)",
  q6: "Utilisez-vous principalement des solutions d'IA gratuites, payantes, ou les deux ?",
  q7: "Pour quels usages ? (plusieurs réponses possibles)",
  q8: "Depuis combien de temps utilisez-vous l'IA dans votre entreprise ?",
  q9: "Quels effets avez-vous constatés, positifs ou négatifs ? (plusieurs réponses possibles)",
  q10: "Qu'est-ce qui freine (ou freinerait) l'usage de l'IA dans votre entreprise ? (3 réponses maximum ; l'ordre des réponses varie d'un répondant à l'autre)",
  q11: "Avez-vous défini des règles d'usage de l'IA dans votre entreprise (par exemple : ce qu'on peut ou non saisir dans un outil) ?",
  q12: "Vous ou vos salariés avez-vous suivi une formation sur l'IA ?",
  q13: "Envisagez-vous, dans les 12 prochains mois, une formation ou un accompagnement sur l'IA ?",
  q14: "Si oui à la question 13, sur quels sujets ? (plusieurs réponses possibles)",
  q15: "Quel est l'usage de l'IA qui vous a été le plus utile dans votre entreprise, ou celui que vous aimeriez essayer ?",
  q16: "Quelle question ou quelle inquiétude sur l'IA aimeriez-vous voir traitée dans le Baromètre ?",
} as const;

export const SECTIONS = {
  entreprise: "Votre entreprise",
  usage: "Votre usage de l'IA",
  freins: "Freins et besoins",
  ouvertes: "Questions ouvertes (facultatives)",
} as const;

export const AIDES = {
  q4: "Si vous répondez « Non », passez directement à la question 10, qui s'applique à tous.",
  q3: "Sans ville ni code postal.",
  q14: "Posée seulement si vous répondez « Oui » à la question 13.",
} as const;
