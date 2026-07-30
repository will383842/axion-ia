/**
 * AFEST 1-to-1 — Libellés d'affichage des rôles et des modalités.
 *
 * ## Pourquoi un module FEUILLE
 *
 * Ces deux tables vivaient dans `seance-queries.ts`, qui tire Prisma, l'identité
 * de l'organisme et la chaîne d'authentification. Toute surface voulant nommer
 * un rôle héritait donc de ces dépendances — un registre de LECTURE se
 * retrouvait à importer next-auth pour afficher « Bénéficiaire ».
 *
 * Les recopier ailleurs aurait été pire : deux écrans nommant différemment le
 * même rôle, c'est un dossier d'audit qui se contredit lui-même. D'où ce module
 * sans aucun import applicatif, dont les deux consommateurs (espace formateur et
 * registre admin) tirent la MÊME phrase.
 */

import type { MethodeSignatureAfest, RoleSignataireAfest } from "./seance-signature-hash";

/**
 * Rôles, en clair.
 *
 * ⚠️ Distinction à tenir dans toute communication : bénéficiaire et formateur
 * apposent une SIGNATURE-PRÉSENCE ; le tuteur entreprise apporte une
 * CO-ATTESTATION DE RÉALITÉ. Le second est un tiers, sa ligne n'a pas la même
 * portée probante, et le libellé le porte plutôt que de l'enfouir dans un
 * commentaire.
 */
export const LIBELLES_ROLE: Readonly<Record<RoleSignataireAfest, string>> = {
  beneficiaire: "Bénéficiaire — signature de présence",
  formateur: "Formateur AFEST — signature de présence",
  tuteur: "Tuteur en entreprise — co-attestation de réalité",
};

/**
 * Modalités, en clair.
 *
 * La modalité est HACHÉE dans le tuple : la dire à l'écran n'est pas un détail
 * d'ergonomie, c'est une partie de ce que la ligne prouve. Une confirmation
 * accessible et un tracé manuscrit ne se valent pas en apparence — ils se valent
 * en valeur probante, et c'est le rendu qui doit le porter, pas le silence.
 */
export const LIBELLES_METHODE: Readonly<Record<MethodeSignatureAfest, string>> = {
  trace: "signature tracée",
  papier_scanne: "feuille papier signée puis photographiée",
  confirmation_accessible: "confirmation nominative (modalité accessible)",
};
