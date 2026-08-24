/**
 * LA DATE D'ÉCHÉANCE DE CONSERVATION — quels modèles la portent, dérivé du schéma.
 *
 * ## Le contexte, mesuré le 2026-08-24
 *
 * 🔴 Chaque pièce signée porte, imprimée dessus, « Conservation : 5 ans »
 * (`DOCUMENT_RETENTION_YEARS`, `legal-mentions.ts`). Trois services écrivent
 * une échéance `suppressionPrevueAt` à la création de chaque pièce —
 * `documents-service.ts`, `documents/signature/document-signature-service.ts`,
 * `emargement/signature-service.ts`.
 *
 * **Et rien ne la lit comme critère d'effacement.** Le seul lecteur applicatif
 * (`actions/qualiopi/piece-lien-signature.ts`) s'en sert comme borne de
 * validité d'un lien de signature. Aucune purge dans `src/server/queue/`, ni
 * dans `scripts/`, ni dans `prisma/`.
 *
 * L'organisme annonce donc par écrit une durée qu'il n'applique pas.
 *
 * ⛔ **Ce module ne supprime rien et ne doit jamais le faire.** Il sert au
 * rapport à blanc (`scripts/qualiopi-retention-dry-run.ts`) qui chiffre ce
 * qu'une purge emporterait — pour que l'arbitrage (purger, ou aligner la
 * mention sur la pratique) se prenne sur des volumes réels.
 *
 * ## Pourquoi la liste est dérivée et non écrite
 *
 * 🔑 Une liste de modèles énumérée à la main prend du retard sur le schéma
 * **sans que rien ne le signale**. Ce dépôt l'a payé quatre fois. Ici la liste
 * vient du DMMF Prisma : un cinquième modèle qui recevrait la colonne demain
 * serait compté sans qu'on touche à ce fichier.
 *
 * Et parce qu'un balayage qui ne trouve plus rien rendrait un rapport **vide et
 * rassurant**, le cliquet associé exige un plancher : voir
 * `__tests__/retention-echeance.spec.ts`.
 */

// ⚠️ Ce dépôt génère son client dans `prisma/generated/client` (cf. le bloc
// `generator client` du schéma) et n'importe JAMAIS depuis `@prisma/client` :
// ce paquet-là ne contient pas le client généré et échoue à l'exécution.
import { Prisma } from "../../../../prisma/generated/client";

/** La colonne d'échéance, telle que le schéma Prisma la nomme. */
export const COLONNE_ECHEANCE = "suppressionPrevueAt";

/**
 * Les modèles porteurs de l'échéance de conservation, dérivés du schéma.
 *
 * Triés, pour que deux exécutions successives se comparent.
 */
export function modelesAvecEcheance(): string[] {
  return Prisma.dmmf.datamodel.models
    .filter((m) => m.fields.some((f) => f.name === COLONNE_ECHEANCE))
    .map((m) => m.name)
    .sort();
}

/**
 * Le nom du délégué Prisma pour un modèle (`DocumentGenere` → `documentGenere`).
 *
 * Prisma n'expose pas cette correspondance ; elle est stable (initiale en
 * minuscule) mais elle est une convention, pas un contrat — d'où le contrôle
 * d'existence côté appelant plutôt qu'un accès aveugle.
 */
export function nomDelegue(modele: string): string {
  return modele.charAt(0).toLowerCase() + modele.slice(1);
}
