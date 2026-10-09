/**
 * Textes PRÉ-REMPLIS pour écrire à un FUTUR APPORTEUR d'affaires (Candidatures
 * unifiées L6) — le pendant de `content/recrutement/modeles-reponse.ts`, dans
 * le vocabulaire du réseau.
 *
 * Ce sont des points de départ, chargés dans le composeur unique
 * (`components/admin/echanges/Composeur.tsx`), modifiables avant l'envoi. Le
 * gabarit, unique, reste `submission-reply`.
 *
 * 🔴 AUCUN MOT DE RECRUTEMENT. Un futur apporteur est un indépendant qui
 * recommande Axion-IA, pas une personne qu'on sélectionne : pas de
 * « candidature », de « poste », d'« entretien », de « retenu »… Balayé par
 * `lib/commercial-application/__tests__/vocabulaire-apporteur.spec.ts`
 * (liste unique : `vocabulaire-apporteur.ts`). Vouvoiement.
 *
 * ⚠️ Pas de modèle « relance » : relancer quelqu'un qui n'a pas répondu est la
 * relance de dormance que l'audit d'anti-requalification a jugée fautive
 * (`features/personne/fiche-personne.ts`).
 *
 * ⚠️ Textes NOUVEAUX vus par des personnes : à faire relire par Will.
 *
 * Variable substituée : `{prenom}` (une variable inconnue reste visible).
 */

export const MODELES_REPONSE_APPORTEUR_IDS = [
  "libre",
  "presentation-reseau",
  "apres-echange",
  "reponse-question",
  "pas-de-suite",
] as const;

export type ModeleReponseApporteurId = (typeof MODELES_REPONSE_APPORTEUR_IDS)[number];

export interface ModeleReponseApporteur {
  readonly id: ModeleReponseApporteurId;
  readonly libelle: string;
  readonly quand: string;
  readonly objet: string;
  readonly corps: string;
}

export const MODELES_REPONSE_APPORTEUR: readonly ModeleReponseApporteur[] = [
  {
    id: "libre",
    libelle: "Message libre",
    quand: "Aucun texte de départ — on écrit tout.",
    objet: "",
    corps: "",
  },
  {
    id: "presentation-reseau",
    libelle: "Présenter le réseau",
    quand: "Premier message : on joint le kit et la présentation.",
    objet: "Le réseau d'apporteurs d'affaires d'Axion-IA",
    corps: [
      "Bonjour {prenom},",
      "",
      "Merci de l'intérêt que vous portez au réseau d'apporteurs d'affaires d'Axion-IA.",
      "",
      "Vous trouverez ci-dessous les documents qui présentent son fonctionnement et nos prestations. Prenez le temps de les lire ; si une question se pose, répondez simplement à ce message.",
    ].join("\n"),
  },
  {
    id: "apres-echange",
    libelle: "Après notre échange",
    quand: "Après l'échange de 15 minutes : on renvoie ce dont on a parlé.",
    objet: "Suite à notre échange",
    corps: [
      "Bonjour {prenom},",
      "",
      "Merci pour le temps que vous m'avez accordé.",
      "",
      "Comme convenu, vous trouverez ci-dessous les documents dont nous avons parlé. Je reste disponible si vous avez la moindre question.",
    ].join("\n"),
  },
  {
    id: "reponse-question",
    libelle: "Répondre à une question",
    quand: "La personne nous a écrit : on répond, sans rien joindre d'office.",
    objet: "Réponse à votre message",
    corps: ["Bonjour {prenom},", "", "Merci pour votre message.", ""].join("\n"),
  },
  {
    id: "pas-de-suite",
    libelle: "Pas de suite pour l'instant",
    quand: "On ne poursuit pas : on le dit clairement, et on remercie.",
    objet: "Le réseau d'apporteurs d'Axion-IA",
    corps: [
      "Bonjour {prenom},",
      "",
      "Merci de l'intérêt que vous avez porté au réseau d'apporteurs d'affaires d'Axion-IA.",
      "",
      "Nous ne donnerons pas suite pour l'instant. Merci encore pour le temps que vous nous avez consacré.",
    ].join("\n"),
  },
];
