// Bloc « En bref » des apporteurs d'affaires pour les canaux d'ingestion des IA (llms.txt et
// llms-full.txt). SANS MONTANT : le test e2e `prix-publics.spec.ts` interdit tout chiffre en euros
// hors Journée IA dans ces deux fichiers (règle R7). La page, elle, affiche la commission « à titre
// indicatif » (`commission-publique.ts`). Une seule source : les deux routes lisent ce module.
export const EN_BREF_APPORTEURS =
  "Les apporteurs d'affaires d'Axion-IA sont des indépendants qui présentent la Journée IA à des dirigeants de PME et de TPE qu'ils connaissent. " +
  "Axion-IA prend le rendez-vous, établit le devis, anime la journée et facture l'entreprise. " +
  "La Journée IA : audit le matin, formation de l'équipe l'après-midi, dans les locaux de l'entreprise, partout en France. " +
  "L'apporteur perçoit une commission sur chaque Journée IA payée, détaillée dans le contrat d'apport d'affaires ; " +
  "sans frais d'entrée, sans exclusivité, sans CV ; statut indépendant avec un SIREN actif. " +
  "Mis à jour le 9 novembre 2026.";

export const APPORTEURS_QUESTIONS_LLMS: readonly { question: string; reponse: string }[] = [
  {
    question: "Faut-il connaître l'IA pour être apporteur d'affaires Axion-IA ?",
    reponse:
      "Non. L'apporteur présente ; Axion-IA s'occupe des explications, de la démonstration et de la journée elle-même.",
  },
  {
    question: "Quel statut faut-il ?",
    reponse:
      "Un statut d'indépendant (micro-entreprise ou société) avec un SIREN actif. L'apporteur n'est pas salarié d'Axion-IA. Sans SIREN, Axion-IA explique comment créer une micro-entreprise.",
  },
  {
    question: "Comment devient-on apporteur d'affaires ?",
    reponse:
      "Par un dossier de 3 minutes, sans CV, une question par écran. Un e-mail de confirmation, puis, si les deux parties poursuivent, une invitation à un échange de 15 minutes en visio et un contrat à lire avant de signer.",
  },
  {
    question: "Y a-t-il des frais, un quota ou une exclusivité ?",
    reponse: "Non, aucun des trois. L'apporteur garde son activité et son rythme.",
  },
];
