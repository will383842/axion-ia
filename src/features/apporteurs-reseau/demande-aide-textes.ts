// Demande d'aide depuis l'espace de l'apporteur : sujets, bornes et textes, hors du fichier
// d'action (un fichier « use server » n'exporte que des fonctions asynchrones). Lu par le
// formulaire (navigateur) ET par l'action : aucune dépendance serveur ici.

export const SUJETS_AIDE = [
  { cle: "dossier", libelle: "Mon dossier" },
  { cle: "contrat", libelle: "Mon contrat" },
  { cle: "entreprise", libelle: "Une entreprise présentée" },
  { cle: "commissions", libelle: "Mes commissions" },
  { cle: "autre", libelle: "Autre" },
] as const;

export type SujetAide = (typeof SUJETS_AIDE)[number]["cle"];

export const MESSAGE_AIDE_MIN = 10;
export const MESSAGE_AIDE_MAX = 2000;

export const TEXTES_AIDE = {
  lien: "Besoin d'aide ?",
  titre: "Besoin d'aide ?",
  intro: "Une question, un blocage ? Écrivez-nous ici : nous vous répondons par e-mail.",
  sujet: "Votre question porte sur",
  choisir: "Choisissez…",
  message: "Votre message",
  aideMessage: `De ${MESSAGE_AIDE_MIN} à ${MESSAGE_AIDE_MAX.toLocaleString("fr-FR")} caractères.`,
  jamaisBancaire: "N'indiquez jamais de coordonnées bancaires dans ce message.",
  envoyer: "Envoyer mon message",
  envoi: "Envoi…",
  confirmation: "Votre message est bien parti. Nous vous répondons par e-mail.",
  retour: "← Retour à mon espace",
  // Erreurs
  sujetManquant: "Choisissez le sujet de votre question.",
  messageCourt: `Votre message est trop court : écrivez au moins ${MESSAGE_AIDE_MIN} caractères.`,
  messageLong: `Votre message est trop long : ${MESSAGE_AIDE_MAX.toLocaleString("fr-FR")} caractères au plus.`,
  lienInvalide:
    "Ce lien n'est plus valable. Rouvrez votre espace depuis le dernier e-mail que nous vous avons envoyé.",
  tropDEnvois:
    "Vous nous avez déjà envoyé plusieurs messages. Réessayez dans une heure, ou écrivez-nous à contact@axion-ia.com.",
  echec:
    "Votre message n'a pas pu partir. Réessayez dans un instant, ou écrivez-nous à contact@axion-ia.com.",
} as const;

/** Ce que l'action rend au formulaire. `saisie` : ce que la personne a tapé, pour ne rien perdre. */
export type EtatDemandeAide =
  | { readonly ok: true }
  | {
      readonly ok: false;
      readonly message: string;
      readonly champ?: "sujet" | "message";
      readonly saisie?: { readonly sujet: string; readonly message: string };
    };
