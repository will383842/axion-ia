/**
 * Qualiopi — Fiche formateur : CV + plan de compétences (doc A15, ind. 21/22).
 *
 * Synthèse de la qualification d'un intervenant : identité, statut, domaines de
 * compétences, formations habilitées, habilitation AFEST, sous-traitance
 * (NDA + vérification data.gouv.fr), CV joint. EXPORT D'ÉTAT à la volée : PAS
 * un document officiel numéroté.
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
  /** True si un CV est téléversé (Trainer.cvUrl non null). */
  cvJoint: boolean;
  /** Date d'habilitation AFEST formatée (fr-FR) — "" si non habilité. */
  afestHabiliteAt: string;
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

        {/* Pièces & habilitations */}
        <DocSection title="Pièces et habilitations">
          <FieldRow
            label="CV joint au dossier"
            value={data.cvJoint ? "Oui — CV téléversé dans le dossier formateur" : "Non"}
            required
          />
          <FieldRow
            label="Habilitation AFEST"
            value={data.afestHabiliteAt ? `Habilité le ${data.afestHabiliteAt}` : "Non habilité"}
          />
        </DocSection>

        {/* Sous-traitance (uniquement si sous-traitant) */}
        {data.statut === "sous_traitant" ? (
          <DocSection title="Sous-traitance (ind. 27)">
            <FieldRow label="NDA du sous-traitant" value={data.sousTraitantNda} required />
            <FieldRow
              label="Vérification data.gouv.fr"
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
          Le CV original téléversé fait partie du dossier formateur.
        </LegalCallout>
      </QualiopiPage>
    </Document>
  );
}
