/**
 * Les codes d'erreur des actions de candidature, traduits pour l'écran.
 *
 * ## Pourquoi ce fichier existe — et il a été payé cher
 *
 * 🔴 Ces tables vivaient dans les fichiers d'actions, à côté du code qu'elles
 * décrivent. C'était l'endroit évident, et c'était FAUX : un module
 * `"use server"` ne peut exporter QUE des fonctions asynchrones. Next.js le
 * refuse au chargement du module, avec ce message :
 *
 *     A "use server" file can only export async functions, found object.
 *
 * Conséquence observée : **la fiche candidat plantait entièrement** — pas
 * l'action, la PAGE, remplacée par « Une erreur est survenue dans la console ».
 * Trois fichiers d'actions étaient concernés, chacun avec sa table de libellés.
 *
 * ## Ce qui l'a trouvé, et ce qui ne l'a pas trouvé
 *
 * Ni le typecheck, ni ESLint, ni Prettier, ni les quelque mille tests unitaires
 * du chantier : aucun n'a rien vu. C'est un **parcours Playwright** qui a ouvert
 * la fiche et constaté qu'elle ne s'affichait plus.
 *
 * ⚠️ Ce défaut serait passé en revue humaine sans difficulté : le code est
 * lisible, le type est juste, l'intention est claire. Il n'existe que parce que
 * `"use server"` change la nature d'un fichier entier — et rien dans le fichier
 * ne le rappelle à part sa première ligne.
 *
 * `le-use-server-n-exporte-que-des-fonctions.spec.ts` refuse désormais le retour
 * de ce motif, sur TOUT le dépôt et pas seulement ici.
 */

/** Réponse écrite à un candidat — `reply-actions.ts`. */
export const LIBELLES_ERREUR_REPONSE: Record<string, string> = {
  unauthorized: "Session expirée — reconnectez-vous.",
  forbidden: "Vous n'avez pas accès aux dossiers de candidature.",
  candidature_introuvable: "Candidature introuvable.",
  invalid_recipient: "Adresse du candidat illisible (clé de chiffrement absente ?).",
  render_failed: "Erreur de génération de l'e-mail.",
  db_failed: "Échec d'enregistrement en base.",
  enqueue_failed: "File d'envoi indisponible — la réponse est enregistrée, réessayez.",
  champs_invalides: "Champs invalides.",
  deja_envoyee: "Cette réponse est déjà partie.",
};

/** Consignation au journal — `journal-actions.ts`. */
export const LIBELLES_ERREUR_JOURNAL: Record<string, string> = {
  unauthorized: "Session expirée — reconnectez-vous.",
  forbidden: "Vous n'avez pas accès aux dossiers de candidature.",
  champs_invalides: "Il manque le texte, ou il est trop court.",
  date_future: "La date d'un fait ne peut pas être dans le futur.",
  db_failed: "Échec d'enregistrement.",
};

/** Entretiens — `interview-actions.ts`. */
export const LIBELLES_ERREUR_ENTRETIEN: Record<string, string> = {
  unauthorized: "Session expirée — reconnectez-vous.",
  forbidden: "Vous n'avez pas accès aux dossiers de candidature.",
  champs_invalides: "Champs invalides.",
  candidature_introuvable: "Candidature introuvable.",
  entretien_introuvable: "Entretien introuvable.",
  deja_tenu: "Cet entretien est déjà marqué tenu — un compte rendu ne se réécrit pas.",
  debrief_requis: "Un entretien tenu exige son compte rendu et son issue.",
  date_passee_pour_planification: "Un entretien se planifie dans le futur.",
  db_failed: "Échec d'enregistrement.",
};

/** Rattachement d'un rendez-vous d'agenda — `rattacher-rendez-vous.ts`. */
export const LIBELLES_ERREUR_RATTACHEMENT: Record<string, string> = {
  unauthorized: "Session expirée — reconnectez-vous.",
  forbidden: "Vous n'avez pas accès aux dossiers de candidature.",
  champs_invalides: "Champs invalides.",
  rendez_vous_introuvable: "Rendez-vous introuvable.",
  candidature_introuvable: "Candidature introuvable.",
  deja_rattache_ailleurs: "Ce rendez-vous est déjà rattaché à une autre candidature.",
  sans_horaire:
    "Ce rendez-vous n'a pas d'horaire connu — complétez-le avant d'en faire un entretien.",
  db_failed: "Échec d'enregistrement.",
};
