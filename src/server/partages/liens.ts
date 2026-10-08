/**
 * LIENS PRIVÉS — les règles PURES (Candidatures unifiées L5, ADR 0065 D6).
 *
 * Aucune entrée/sortie : durée d'un lien, plafond de téléchargements, durée
 * d'une adresse R2 signée, état d'un lien, paragraphe ajouté au message. Le
 * serveur, la console et les tests lisent les MÊMES constantes.
 */

const JOUR_MS = 24 * 60 * 60 * 1000;

/** Un lien vit 30 jours (décision 2 de Will)… */
export const DUREE_LIEN_JOURS = 30;
/** …et 7 jours seulement dès qu'il porte des rushs (décision 8, [B3]). */
export const DUREE_LIEN_RUSHS_JOURS = 7;

/**
 * Plafond anti-fuite [I4] : au-delà de 20 téléchargements d'un MÊME fichier par
 * le même lien, dans la période de validité en cours, le bouton disparaît et
 * Will est prévenu. Prolonger le lien ouvre une nouvelle période.
 */
export const PLAFOND_TELECHARGEMENTS = 20;

/** Au plus, fichiers joints à un même message. */
export const FICHIERS_PAR_LIEN_MAX = 20;

/** Adresse R2 signée : 1 h, 12 h au-delà de 1 Go (une reprise relance la même adresse) [C2]. */
export const DUREE_URL_SIGNEE_S = 60 * 60;
export const DUREE_URL_SIGNEE_GROS_S = 12 * 60 * 60;
export const SEUIL_GROS_FICHIER_OCTETS = 1_000_000_000;

export function dureeUrlSigneeS(tailleOctets: number | null): number {
  return tailleOctets !== null && tailleOctets > SEUIL_GROS_FICHIER_OCTETS
    ? DUREE_URL_SIGNEE_GROS_S
    : DUREE_URL_SIGNEE_S;
}

/** Le lien porte-t-il des rushs (fichiers confiés pour un essai) ? */
export function porteDesRushs(categories: ReadonlyArray<string>): boolean {
  return categories.includes("rushs");
}

/** La durée de validité d'un lien selon ses fichiers, en jours. */
export function dureeLienJours(categories: ReadonlyArray<string>): number {
  return porteDesRushs(categories) ? DUREE_LIEN_RUSHS_JOURS : DUREE_LIEN_JOURS;
}

/** La date limite d'un lien créé ou prolongé à `maintenant`. */
export function expirationLien(categories: ReadonlyArray<string>, maintenant: Date): Date {
  return new Date(maintenant.getTime() + dureeLienJours(categories) * JOUR_MS);
}

/**
 * Le début de la période de validité en cours : la date limite moins la durée
 * du lien. Une prolongation repousse la date limite, donc ouvre une nouvelle
 * période — et remet le compteur du plafond à zéro.
 */
export function debutPeriode(expireLe: Date, categories: ReadonlyArray<string>): Date {
  return new Date(expireLe.getTime() - dureeLienJours(categories) * JOUR_MS);
}

export type EtatLien = "actif" | "expire" | "retire";

export function etatLien(
  l: { expireLe: Date; revoqueLe: Date | null },
  maintenant: Date,
): EtatLien {
  if (l.revoqueLe !== null) return "retire";
  if (l.expireLe.getTime() <= maintenant.getTime()) return "expire";
  return "actif";
}

/** Une décision qui PROPOSE de retirer les liens envoyés [I5] : Non retenue, Retirée. */
export function retraitPropose(statut: string): boolean {
  return statut === "rejected" || statut === "withdrawn";
}

/** Motifs de retrait (colonne `motif_retrait`, 200 caractères au plus). */
export const MOTIF_RETRAIT = {
  manuel: "retiré depuis la fiche",
  decision: "candidature non retenue ou retirée",
} as const;

/** « 14/10/2026 », heure de Paris. */
export function dateCourte(d: Date): string {
  return d.toLocaleDateString("fr-FR", {
    timeZone: "Europe/Paris",
    day: "2-digit",
    month: "2-digit",
    year: "numeric",
  });
}

/** La phrase d'information (décision 6 de Will), mot pour mot. */
export const PHRASE_SUIVI =
  "Ce lien est personnel ; nous voyons quand les fichiers sont téléchargés.";

/**
 * Le paragraphe ajouté à la fin du message : un LIEN, jamais une pièce jointe.
 * Markdown léger (`[libellé](adresse)`), rendu par le gabarit e-mail existant.
 */
export function paragrapheFichiers(
  adresse: string,
  expireLe: Date,
  opts: { readonly depotAutorise?: boolean } = {},
): string {
  return (
    `**Fichiers à télécharger (jusqu'au ${dateCourte(expireLe)})** : ` +
    `[ouvrir la page de téléchargement](${adresse})\n\n${PHRASE_SUIVI}` +
    (opts.depotAutorise ? `\n\n${PHRASE_DEPOT}` : "")
  );
}

/** L5b — ajouté au message quand l'équipe autorise le candidat à renvoyer sa version. */
export const PHRASE_DEPOT =
  "Votre montage est prêt ? Vous pourrez aussi déposer votre version sur cette même page (une vidéo ou une archive ZIP, 4 Go au plus).";
