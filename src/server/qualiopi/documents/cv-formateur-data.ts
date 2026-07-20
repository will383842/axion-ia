/**
 * Construction des données de la fiche formateur (ind. 21) — logique PURE.
 *
 * Partagé par deux appelants aux sémantiques différentes :
 *   - `exports-pdf.ts`  → export éphémère téléchargé (état, non persisté) ;
 *   - `documents.ts`    → versement au dossier de preuves (DocumentGenere
 *                         numéroté, hashé, conservé, pointé par Trainer.cvUrl).
 *
 * Vit ici plutôt que dans l'un des deux : un fichier `"use server"` ne peut
 * exporter que des fonctions asynchrones, donc aucun helper synchrone ne peut y
 * être mutualisé.
 *
 * Aucun import Prisma / accès DB : entrée = ligne déjà lue, sortie = données
 * d'affichage.
 */

import type {
  CvFormateurData,
  DomaineCompetenceData,
} from "@/server/qualiopi/documents/templates/cv-formateur";

/** Formate une date en fr-FR, chaîne vide si absente. */
export function formatDateFr(d: Date | null | undefined): string {
  return d ? d.toLocaleDateString("fr-FR") : "";
}

/**
 * Parse le Json `Trainer.domainesCompetences` en lignes affichables.
 *
 * Tolère DEUX formes, car les deux coexistent en base :
 *   - objet  `{ domaine, niveauMaitrise?, verifiedAt? }` — forme documentée au schéma ;
 *   - chaîne `"IA générative"` — forme réellement présente en production.
 *
 * Sans cette tolérance, une fiche dont les compétences sont de simples chaînes
 * produit une section « compétences » VIDE — soit exactement la preuve attendue
 * à l'indicateur 21 qui disparaît du document censé la porter.
 */
export function parseDomainesCompetences(raw: unknown): DomaineCompetenceData[] {
  if (!Array.isArray(raw)) return [];
  return raw
    .map((entree): DomaineCompetenceData | null => {
      if (typeof entree === "string") {
        return entree.trim().length > 0
          ? { domaine: entree.trim(), niveauMaitrise: "", verifiedAt: "" }
          : null;
      }
      if (entree === null || typeof entree !== "object") return null;
      const o = entree as Record<string, unknown>;
      const domaine = typeof o["domaine"] === "string" ? o["domaine"].trim() : "";
      if (domaine.length === 0) return null;
      return {
        domaine,
        niveauMaitrise: typeof o["niveauMaitrise"] === "string" ? o["niveauMaitrise"] : "",
        verifiedAt:
          typeof o["verifiedAt"] === "string" && o["verifiedAt"]
            ? formatDateFr(new Date(o["verifiedAt"]))
            : "",
      };
    })
    .filter((d): d is DomaineCompetenceData => d !== null);
}

/** Ligne formateur nécessaire à la construction de la fiche. */
export interface TrainerCvSource {
  nom: string;
  prenom: string;
  email: string;
  telephone: string | null;
  statut: string;
  cvUrl: string | null;
  domainesCompetences: unknown;
  dateEmbauche: Date | null;
  afestHabiliteAt: Date | null;
  sousTraitantNda: string | null;
  sousTraitantVerifieAt: Date | null;
}

/**
 * Assemble les données d'affichage de la fiche formateur.
 *
 * @param trainer              - Ligne formateur lue en base.
 * @param titresHabilitations  - Titres des formations habilitées, déjà résolus.
 * @param maintenant           - Date d'édition (injectée, jamais `new Date()` caché).
 */
export function buildCvFormateurData(
  trainer: TrainerCvSource,
  titresHabilitations: string[],
  maintenant: Date,
): CvFormateurData {
  return {
    dateEdition: formatDateFr(maintenant),
    nom: trainer.nom,
    prenom: trainer.prenom,
    email: trainer.email,
    telephone: trainer.telephone ?? "",
    statut: trainer.statut,
    dateEmbauche: formatDateFr(trainer.dateEmbauche),
    domainesCompetences: parseDomainesCompetences(trainer.domainesCompetences),
    formationsHabilitees: titresHabilitations,
    cvJoint: trainer.cvUrl != null,
    afestHabiliteAt: formatDateFr(trainer.afestHabiliteAt),
    sousTraitantNda: trainer.sousTraitantNda ?? "",
    sousTraitantVerifieAt: formatDateFr(trainer.sousTraitantVerifieAt),
  };
}
