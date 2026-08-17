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
  PieceCompetencesData,
} from "@/server/qualiopi/documents/templates/cv-formateur";

/**
 * Préfixe des URL servies par la route de téléchargement des pièces générées
 * (`src/app/api/qualiopi/documents/[id]/route.ts`). `verserFicheFormateurAction`
 * écrit `Trainer.cvUrl` avec cette forme.
 */
const PREFIXE_DOCUMENT_GENERE = "/api/qualiopi/documents/";

/**
 * Déduit ce que le dossier formateur contient réellement à partir du seul
 * `cvUrl`.
 *
 * 🔴 Non-conformité relevée à l'audit blanc du 2026-08-15 : `cvJoint` valait
 * `cvUrl != null`, et la fiche imprimait « CV téléversé dans le dossier
 * formateur ». Or, dès le PREMIER versement, `cvUrl` pointe vers la fiche que
 * l'organisme vient lui-même de générer. Le document se citait comme sa propre
 * source de preuve, et affirmait devant l'auditrice un téléversement qui
 * n'avait jamais eu lieu.
 *
 * Ce repli reste une DÉDUCTION : l'appelant qui sait compter les CV sources
 * (`TrainerDocument type=cv, statutValidation=valide`) doit écraser la valeur —
 * c'est ce que fait `verserFicheFormateurAction`.
 */
export function deduirePieceCompetences(cvUrl: string | null): PieceCompetencesData {
  if (cvUrl === null || cvUrl.trim() === "") return "aucune";
  return cvUrl.includes(PREFIXE_DOCUMENT_GENERE) ? "fiche_organisme" : "cv_televerse";
}

/** Formate une date en fr-FR, chaîne vide si absente. */
export function formatDateFr(d: Date | null | undefined): string {
  // Une Date invalide est *truthy* : sans ce garde, `new Date("15/01/2026")`
  // imprimerait littéralement « Invalid Date » dans une pièce d'audit.
  if (!d || Number.isNaN(d.getTime())) return "";
  return d.toLocaleDateString("fr-FR");
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
    pieceCompetences: deduirePieceCompetences(trainer.cvUrl),
    // 2026-08-10 (décision Will) : le bloc « Habilitation AFEST » a été retiré
    // de la fiche (1-to-1 = conseil, hors Qualiopi) — plus aucun champ propagé.
    sousTraitantNda: trainer.sousTraitantNda ?? "",
    sousTraitantVerifieAt: formatDateFr(trainer.sousTraitantVerifieAt),
  };
}
