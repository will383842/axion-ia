/**
 * Qualiopi — Fiche formateur : CV + plan de compétences (doc A15, ind. 21/22).
 *
 * Synthèse de la qualification d'un intervenant : identité, statut, domaines de
 * compétences, formations habilitées (catalogue en vigueur uniquement), actions
 * d'entretien des compétences (ind. 22), sous-traitance
 * (NDA + vérification data.gouv.fr), pièce justificative au dossier.
 *
 * DEUX appelants, deux régimes — ne pas croire l'un pour l'autre :
 *   - `exports-pdf.ts`  → aperçu à la volée, non numéroté, non conservé ;
 *   - `documents.ts`    → pièce OFFICIELLE versée au dossier de preuves
 *                         (numéro séquentiel, hash, conservation) et pointée
 *                         par `Trainer.cvUrl`. C'est celle que lit l'auditeur.
 *
 * Rendu serveur exclusif — NE PAS "use client".
 */

import React from "react";
import { Document, Text } from "@react-pdf/renderer";
import {
  QualiopiPage,
  DocSection,
  FieldRow,
  DataTable,
  BulletList,
  LegalCallout,
  pdfStyles,
} from "@/server/qualiopi/documents/base-layout";
import type { OrganismeIdentite } from "@/server/qualiopi/documents/organisme";

// ============================================================
// Types
// ============================================================

export interface DomaineCompetenceData {
  domaine: string;
  niveauMaitrise: string;
  /** Date de vérification formatée (fr-FR) — "" si non vérifiée. */
  verifiedAt: string;
}

/**
 * Nature de la pièce qui justifie les compétences au dossier formateur.
 *
 * 🔴 Trois états, et pas un booléen : `Trainer.cvUrl` pointe vers la fiche que
 * l'organisme vient lui-même de générer dès le premier versement. Réduire cela
 * à « CV joint : oui » faisait dire au document qu'un CV avait été téléversé
 * alors que la seule pièce au dossier était… lui-même. Une pièce d'audit ne
 * peut pas se citer comme sa propre source.
 */
export type PieceCompetencesData =
  /** Un CV rédigé par l'intervenant a été téléversé et validé au dossier. */
  | "cv_televerse"
  /** Aucun CV source : la présente fiche, établie par l'organisme, en tient lieu. */
  | "fiche_organisme"
  /** Rien au dossier. */
  | "aucune";

/** Action d'entretien / développement des compétences (ind. 22). */
export interface ActionDeveloppementData {
  /** Date de l'action formatée (fr-FR). */
  date: string;
  /** Libellé du type (« Entretien professionnel », « Formation suivie »…). */
  type: string;
  /** Description saisie — "" si l'action n'en porte pas. */
  description: string;
}

export interface CvFormateurData {
  /** Date d'édition formatée (fr-FR). */
  dateEdition: string;
  nom: string;
  prenom: string;
  email: string;
  telephone: string;
  /** "salarie" | "sous_traitant" | "dirigeant". */
  statut: string;
  /** Date d'embauche / de début de collaboration formatée (fr-FR) — "" si absente. */
  dateEmbauche: string;
  /** Domaines de compétences (Json Trainer.domainesCompetences). */
  domainesCompetences: DomaineCompetenceData[];
  /** Titres des formations habilitées (résolus depuis formationsHabilitees). */
  formationsHabilitees: string[];
  /**
   * True si une pièce justificative existe au dossier — CONSERVÉ pour les
   * appelants qui n'ont pas encore la distinction fine. Ne dit PAS qu'un CV a
   * été téléversé : voir `pieceCompetences`, qui fait foi quand il est fourni.
   */
  cvJoint: boolean;
  /**
   * Nature exacte de la pièce justificative. Optionnel : quand il est absent on
   * retombe sur `cvJoint`, qui ne sait distinguer que « quelque chose / rien ».
   */
  pieceCompetences?: PieceCompetencesData;
  /**
   * Actions d'entretien / développement des compétences (ind. 22), les plus
   * récentes d'abord. Tableau VIDE = section rendue avec le constat d'absence ;
   * champ ABSENT = l'appelant n'a pas chargé la donnée, la section est omise
   * (un export d'aperçu ne doit pas laisser croire qu'il n'y a rien).
   */
  actionsDeveloppement?: ActionDeveloppementData[];
  /** NDA propre du sous-traitant — "" si non applicable. */
  sousTraitantNda: string;
  /** Date de vérification data.gouv.fr formatée (fr-FR) — "" si non vérifiée. */
  sousTraitantVerifieAt: string;
}

// ============================================================
// Libellés
// ============================================================

const STATUT_LABELS: Record<string, string> = {
  salarie: "Salarié",
  sous_traitant: "Sous-traitant",
  dirigeant: "Dirigeant-formateur",
};

/**
 * Ce que le dossier formateur contient RÉELLEMENT. Les trois libellés sont
 * écrits pour être lus par un auditeur : aucun ne laisse penser qu'un CV a été
 * fourni par l'intervenant quand ce n'est pas le cas.
 */
const PIECE_COMPETENCES_LABELS: Record<PieceCompetencesData, string> = {
  cv_televerse: "Oui — CV téléversé et conservé au dossier formateur",
  fiche_organisme:
    "Non — aucun CV téléversé : la présente fiche de compétences, établie par l'organisme, en tient lieu",
  aucune: "Non — aucune pièce au dossier formateur",
};

// ============================================================
// Composant
// ============================================================

export function CvFormateurPdf({
  data,
  identite,
}: {
  data: CvFormateurData;
  identite: OrganismeIdentite;
}): React.ReactElement {
  // Repli quand l'appelant ne fournit pas encore la distinction fine : un
  // booléen ne sait pas dire d'où vient la pièce, on ne prétend donc pas
  // qu'elle vient de l'intervenant.
  const piece: PieceCompetencesData =
    data.pieceCompetences ?? (data.cvJoint ? "cv_televerse" : "aucune");

  return (
    <Document>
      <QualiopiPage
        docTitle="Fiche formateur — CV et compétences"
        docNumber={`Édité le ${data.dateEdition}`}
        identite={identite}
      >
        {/* Identité */}
        <DocSection title="Identité de l'intervenant">
          <FieldRow label="Nom" value={data.nom} required />
          <FieldRow label="Prénom" value={data.prenom} required />
          <FieldRow label="Email" value={data.email} />
          <FieldRow label="Téléphone" value={data.telephone || "—"} />
          <FieldRow label="Statut" value={STATUT_LABELS[data.statut] ?? data.statut} required />
          <FieldRow label="Début de collaboration" value={data.dateEmbauche || "Non renseigné"} />
        </DocSection>

        {/* Domaines de compétences */}
        <DocSection title="Domaines de compétences">
          {data.domainesCompetences.length === 0 ? (
            <Text style={pdfStyles.legalNote}>Aucun domaine de compétence renseigné.</Text>
          ) : (
            <DataTable
              columns={[
                { key: "domaine", header: "Domaine", flex: 3 },
                { key: "niveau", header: "Niveau de maîtrise", flex: 2 },
                { key: "verifie", header: "Vérifié le", flex: 1 },
              ]}
              rows={data.domainesCompetences.map((d) => ({
                domaine: d.domaine,
                niveau: d.niveauMaitrise || "—",
                verifie: d.verifiedAt || "Non vérifié",
              }))}
            />
          )}
        </DocSection>

        {/* Formations habilitées */}
        <DocSection title="Formations habilitées">
          {data.formationsHabilitees.length === 0 ? (
            <Text style={pdfStyles.legalNote}>
              Aucune habilitation formation enregistrée pour cet intervenant.
            </Text>
          ) : (
            <BulletList items={data.formationsHabilitees} variant="check" />
          )}
        </DocSection>

        {/* Développement des compétences (ind. 22) — omis si l'appelant n'a pas
            chargé la donnée : une section absente vaut mieux qu'un « aucune
            action » qui serait faux. */}
        {data.actionsDeveloppement ? (
          <DocSection title="Entretien et développement des compétences (ind. 22)">
            {data.actionsDeveloppement.length === 0 ? (
              <Text style={pdfStyles.legalNote}>
                Aucune action d&apos;entretien ou de développement des compétences enregistrée pour
                cet intervenant à la date d&apos;édition.
              </Text>
            ) : (
              <DataTable
                columns={[
                  { key: "date", header: "Date", flex: 1 },
                  { key: "type", header: "Nature", flex: 2 },
                  { key: "description", header: "Objet", flex: 4 },
                ]}
                rows={data.actionsDeveloppement.map((a) => ({
                  date: a.date || "—",
                  type: a.type,
                  description: a.description || "—",
                }))}
              />
            )}
          </DocSection>
        ) : null}

        {/* Pièces & habilitations */}
        <DocSection title="Pièces et habilitations">
          <FieldRow
            label="CV de l'intervenant joint au dossier"
            value={PIECE_COMPETENCES_LABELS[piece]}
            required
          />
          {/* 2026-08-10 (décision Will) : ligne « Habilitation AFEST » retirée —
              le 1-to-1 est une prestation de conseil hors Qualiopi. */}
        </DocSection>

        {/* Sous-traitance (uniquement si sous-traitant) */}
        {data.statut === "sous_traitant" ? (
          <DocSection title="Sous-traitance (ind. 27)">
            <FieldRow label="NDA du sous-traitant" value={data.sousTraitantNda} required />
            <FieldRow
              label="Consultation data.gouv.fr attestée le"
              value={
                data.sousTraitantVerifieAt
                  ? `Vérifié le ${data.sousTraitantVerifieAt}`
                  : "Non vérifié"
              }
              required
            />
          </DocSection>
        ) : null}

        <LegalCallout variant="legal" title="Référentiel national qualité">
          Cette fiche synthétise la détermination et la mobilisation des compétences de
          l&apos;intervenant (indicateur 21) et l&apos;entretien de ces compétences (indicateur 22).
          Les formations habilitées listées ci-dessus sont celles du catalogue en vigueur à la date
          d&apos;édition : une formation archivée n&apos;y figure pas, l&apos;habilitation
          correspondante étant devenue sans objet.
          {piece === "cv_televerse"
            ? " Le CV original téléversé fait partie du dossier formateur."
            : " Aucun CV rédigé par l'intervenant ne figure au dossier : la présente fiche, établie par l'organisme, constitue la pièce de synthèse."}
        </LegalCallout>
      </QualiopiPage>
    </Document>
  );
}
