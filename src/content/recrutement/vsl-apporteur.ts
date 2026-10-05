// Page VSL de recrutement d'apporteurs — CONTENU de `/apporteur-affaires/video`
// et de `/apporteur-affaires/video/merci` (plan `_PLAN-VSL-TUNNEL-APPORTEURS-2026-10-05`,
// lot 3 ; textes de `02-ACQUISITION-CREATIF.md` §6 et §7, tranchés par `03`).
//
// ── Ce qui a écrit chaque phrase ────────────────────────────────────────────
// Un visiteur venu d'une publicité Facebook ou Instagram, sur son téléphone,
// qui donne dix secondes. TRÈS PEU DE TEXTE, une colonne, UN seul bouton répété.
//
// 🔴 VOUVOIEMENT partout (décision du 29/09/2026).
// 🔴 AUCUN MONTANT EN DUR : la seule somme de la page vient de `pricing.ts` et
//    entre par un PARAMÈTRE (`faqVsl`). Deux barèmes publics ont déjà divergé de
//    150 € pour un montant recopié. Aucun gain en tête de page (décision 11 du
//    plan 03) : le chiffre vit en petit, « à titre indicatif », dans la FAQ.
// 🔴 AUCUN Qualiopi, AUCUN parrainage (jamais, dans une publicité ni sur sa page).
// 🔴 AUCUN numéro de téléphone public.
// 🔴 VOCABULAIRE : « recommander », « présenter », « mettre en relation »,
//    « échange ». Jamais « commercial », « poste », « recrutement », « entretien »
//    ni le verbe « vendre » (R7 du plan 03, décisions du 19/09 et du 03/09).
// 🔴 AUCUN DÉLAI DE RÉPONSE PROMIS, aucun compteur de rareté, aucun faux témoignage.
// 🔴 « Vous recevez un e-mail » : l'envoi est fait par la capture (autre PR) ; ces
//    textes ne promettent pas d'appel.
//
// Le test `vsl-apporteur.spec.ts` verrouille ces règles sur le TEXTE servi.

import { VSL_PAGE_PATH } from "@/lib/commercial-application/vsl-apporteur";

export * from "./vsl-apporteur-client";
export * from "./vsl-apporteur-merci";

/** Chemin de la page (sans préfixe de langue). */
export const VSL_PATH = VSL_PAGE_PATH;

export const VSL_META = {
  title: "Apporteur d'affaires IA : présentez, nous faisons le reste",
  description:
    "Vous connaissez des dirigeants de PME ? Présentez-les à Axion-IA. Nous nous occupons de la vente, de la facturation et de la formation.",
} as const;

export const VSL_HERO = {
  badge: "Apporteur d'affaires indépendant",
  h1: "Vous connaissez des dirigeants de PME ?",
  h1Em: "Présentez-les. Nous nous occupons du reste.",
  sousTitre:
    "Axion-IA forme les équipes des entreprises à l'IA. Vous recommandez, nous nous occupons de la vente, de la facturation et de la formation.",
  cta: "Je candidate (2 minutes)",
  micro: "Aucun frais d'entrée · Aucun quota · Aucun gain garanti",
  videoLabel: "Regardez comment ça marche",
} as const;

/**
 * Le film. Les fichiers sont posés par Will dans `public/videos/` ; le bloc
 * n'apparaît QUE si le MP4 ET l'affiche existent (`videoDisponible`), donc la
 * page est livrable sans film. Les sous-titres (`.vtt`) et la transcription
 * sont facultatifs : la transcription est lue dans le `.vtt` quand il existe.
 *
 * 🔴 Même domaine, pas d'hébergeur tiers : la CSP n'a pas de `media-src`, une
 * vidéo externe serait bloquée sans message (voir `content/lp/diagnostic.ts`).
 * 🔴 Nom de fichier VERSIONNÉ (`-v1`) : l'en-tête de cache de `/videos/*` est
 * long (un an, immuable) ; un film refait prend un nouveau nom.
 */
export const VSL_VIDEO_FICHIERS = {
  src: "/videos/vsl-apporteur-v1.mp4",
  poster: "/videos/vsl-apporteur-v1-poster.avif",
  sousTitres: "/videos/vsl-apporteur-v1.fr.vtt",
  /** Ce que lit l'affiche (« 1 min 20 ») — à ajuster à la durée réelle du film. */
  durationLabel: "1 min 20",
} as const;

/**
 * Bloc « Votre commission » (décision de Will du 05/10 : on PARLE de la
 * commission sur la page, c'est le gros point d'accroche).
 *
 * 🔴 UN INTERRUPTEUR : `AFFICHER_BLOC_COMMISSION`. Les allégations de revenus
 * sont surveillées par Meta : si la page était refusée, on retire le bloc en UN
 * commit (le passer à `false`), sans toucher à la page ni au reste du texte.
 *
 * 🔴 Le montant n'est JAMAIS écrit ici : il entre par paramètre, formaté par la
 * page à partir de `COMMISSION_FORMATION_PAR_JOURNEE_EUR` (`pricing.ts`).
 * 🔴 Il ne figure NI dans le titre de la page, NI dans le sous-titre du héro, NI
 * dans les métadonnées / OG / annonce : seulement ce bloc et la FAQ.
 * 🔴 « À titre indicatif » est dans le bloc (garde `jur:remuneration-indicative`) ;
 * la sous-ligne dit que c'est une règle du contrat et non une promesse. Aucun
 * exemple chiffré cumulé, aucun « revenu complémentaire », « sans effort » ni
 * « garanti ».
 */
export const AFFICHER_BLOC_COMMISSION: boolean = true;

export function commissionVsl(montant: string): {
  readonly titre: string;
  readonly indicatif: string;
  readonly avant: string;
  readonly montant: string;
  readonly apres: string;
  readonly sousLigne: string;
} {
  return {
    titre: "Votre commission",
    indicatif: "À titre indicatif",
    avant: "jusqu'à",
    montant,
    apres: "par journée de formation facturée",
    sousLigne:
      "Règle de calcul du contrat, pas une promesse de gain. Versée quand l'entreprise a payé à 100 %, réduite au prorata en cas de remise.",
  };
}

/** Les trois pastilles « pour qui ». */
export const VSL_POUR_QUI: readonly string[] = [
  "Vous avez des contacts de dirigeants de PME",
  "Vous gardez votre activité",
  "Aucune négociation, aucune explication technique à fournir",
];

export const VSL_PAS_POUR_QUI =
  "Ce n'est pas pour vous si vous cherchez un salaire fixe ou si vous n'avez pas de contacts en entreprise.";

export const VSL_ETAPES: readonly { readonly titre: string; readonly texte: string }[] = [
  {
    titre: "Vous présentez",
    texte: "Vous mettez en relation Axion-IA et un dirigeant que vous connaissez.",
  },
  {
    titre: "Nous nous occupons du reste",
    texte: "Nous menons le rendez-vous, la proposition, la facturation et la formation.",
  },
  {
    titre: "Vous recevez votre commission",
    texte: "Quand l'entreprise a payé, selon les conditions du contrat.",
  },
];

/** Section anti-doute : ce que ce n'est pas. */
export const VSL_PAS_CA: readonly string[] = [
  "Pas de frais d'entrée",
  "Pas de quota, pas d'exclusivité",
  "Pas de gain garanti : la commission dépend des entreprises que vous présentez",
  "Un contrat écrit, des conditions que vous lisez avant de signer",
];

/** Preuves honnêtes : ce qui existe réellement. Aucune statistique. */
export const VSL_PREUVES = {
  catalogue: {
    titre: "Des formations réelles, avec leurs prix publics",
    lien: "Voir le catalogue",
  },
  commission: {
    titre: "Une commission calculée sur la facture",
    texte: "Versée quand l'entreprise a payé.",
  },
  echange: {
    titre: "Un échange de 15 minutes avant tout engagement",
  },
} as const;

/**
 * Les six questions. Une seule somme, passée en PARAMÈTRE (libellé déjà formaté
 * par la page à partir de `pricing.ts`), « à titre indicatif » dans la même
 * phrase (garde `jur:remuneration-indicative`).
 */
export function faqVsl(commissionParJournee: string): readonly {
  readonly id: string;
  readonly question: string;
  readonly answer: string;
}[] {
  return [
    {
      id: "ia",
      question: "Faut-il connaître l'IA ?",
      answer: "Non. Vous présentez ; nous nous occupons des explications.",
    },
    {
      id: "statut",
      question: "Faut-il un statut ?",
      answer:
        "Oui : vous intervenez comme indépendant (micro-entreprise ou société). Vous n'êtes pas salarié d'Axion-IA.",
    },
    {
      id: "gains",
      question: "Combien puis-je gagner ?",
      answer: `À titre indicatif, jusqu'à ${commissionParJournee} par journée de formation facturée et encaissée, selon le contrat. Cela dépend des entreprises que vous présentez et de celles qui signent : nous ne garantissons aucun gain.`,
    },
    {
      id: "negocier",
      question: "Dois-je négocier quelque chose ?",
      answer:
        "Non. Vous présentez ; nous nous occupons du rendez-vous, de la proposition et de la facturation.",
    },
    {
      id: "frais",
      question: "Y a-t-il des frais, un quota, une exclusivité ?",
      answer: "Non, aucun des trois.",
    },
    {
      id: "apres",
      question: "Que se passe-t-il après ma candidature ?",
      answer:
        "Vous recevez un e-mail de confirmation, puis vous choisissez un créneau de 15 minutes. Si nous poursuivons ensemble, vous complétez un dossier en ligne, puis un contrat vous est proposé.",
    },
  ];
}
