/**
 * Libellés français des parties signataires — SOURCE UNIQUE.
 *
 * 🔴 CE QUI S'AFFICHAIT AVANT. Le panneau de signature construisait ses boutons
 * par `Envoyer à ${p === "client" ? "le client" : p}` : d'où « Envoyer à le
 * client » pour la seule partie traitée, et « Envoyer à sous_traitant »,
 * « Envoyer à responsable_pedagogique » pour toutes les autres. Le registre du
 * mode auditeur — l'écran que lit l'auditrice — décrivait chaque signataire par
 * « sous_traitant · … · confirmation_accessible · interne », trois valeurs
 * d'enum brutes côte à côte, sur la page dont dépend la preuve.
 *
 * Deux formes sont nécessaires et ne se déduisent pas l'une de l'autre en
 * français : le NOM (« Sous-traitant », en tête de ligne) et le COMPLÉMENT
 * (« au sous-traitant », après un verbe). Les deux tables sont donc explicites
 * plutôt que reconstruites par concaténation — c'est précisément la
 * concaténation qui produisait « à le client ».
 *
 * Typées sur l'enum Prisma : ajouter une partie au schéma sans la nommer ici
 * casse la compilation, au lieu de laisser fuir sa valeur brute à l'écran.
 */

import type { DocumentPartieSignataire } from "../../../../../prisma/generated/client";

/** Forme nominative : « Sous-traitant ». En tête de ligne, dans un tableau. */
export const PARTIE_NOM: Record<DocumentPartieSignataire, string> = {
  client: "Client",
  financeur: "Financeur",
  formateur: "Formateur",
  beneficiaire: "Bénéficiaire",
  tuteur: "Tuteur",
  sous_traitant: "Sous-traitant",
  responsable_pedagogique: "Responsable pédagogique",
  axionia: "Organisme de formation",
};

/** Forme avec article contracté : « au sous-traitant ». Après un verbe. */
export const PARTIE_COMPLEMENT: Record<DocumentPartieSignataire, string> = {
  client: "au client",
  financeur: "au financeur",
  formateur: "au formateur",
  beneficiaire: "au bénéficiaire",
  tuteur: "au tuteur",
  sous_traitant: "au sous-traitant",
  responsable_pedagogique: "au responsable pédagogique",
  axionia: "à l'organisme de formation",
};

/** Nom d'une partie. Une valeur inconnue est CITÉE, jamais maquillée. */
export function nomPartie(partie: string): string {
  return PARTIE_NOM[partie as DocumentPartieSignataire] ?? `« ${partie} »`;
}

/** Complément d'une partie, pour « Envoyer … », « Lien pour … ». */
export function complementPartie(partie: string): string {
  return PARTIE_COMPLEMENT[partie as DocumentPartieSignataire] ?? `à « ${partie} »`;
}
