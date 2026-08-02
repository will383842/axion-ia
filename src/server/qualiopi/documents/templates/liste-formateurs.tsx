/**
 * Qualiopi — Liste des formateurs et de leurs qualifications.
 *
 * ## La pièce qui manquait
 *
 * La déclaration d'activité exige « la liste des personnes qui interviendront,
 * précisant leurs titres et qualités et le lien avec la prestation réalisée »
 * (art. R.6351-5 C. trav.) ainsi que la nature de leur lien contractuel avec
 * l'organisme. Le référentiel national qualité demande la même chose à
 * l'indicateur 21.
 *
 * Le dépôt ne produisait qu'une FICHE PAR FORMATEUR (`cv_formateur`). Une fiche
 * n'est pas une liste : avec un seul intervenant la différence est théorique,
 * avec trois elle ne l'est plus — et c'est précisément une liste que réclament
 * le formulaire et l'auditeur.
 *
 * 🔴 Les quatre colonnes ne sont pas décoratives : ce sont les quatre choses que
 * le texte exige (qui, à quel titre, en lien avec quelles prestations, sous quel
 * lien contractuel). Retirer une colonne, c'est retirer une réponse.
 *
 * ⚠️ Une lacune se DIT. Un intervenant sans compétence saisie, sans habilitation
 * ou sans CV le voit écrit sur la pièce : un blanc se lirait comme une omission
 * de mise en page, alors que c'est une information — et celle qu'un auditeur
 * cherche en premier.
 *
 * Rendu serveur exclusif — NE PAS "use client".
 */

import React from "react";
import { Document, Text } from "@react-pdf/renderer";
import {
  QualiopiPage,
  DocSection,
  DataTable,
  FieldRow,
  pdfStyles,
} from "@/server/qualiopi/documents/base-layout";
import type { OrganismeIdentite } from "@/server/qualiopi/documents/organisme";

// ============================================================
// Types
// ============================================================

export interface FormateurListe {
  nomPrenom: string;
  /** `Trainer.statut` : dirigeant / salarie / sous_traitant. */
  statut: string;
  /** Domaines de compétences déclarés, déjà aplatis. */
  domaines: string[];
  /** Nombre de formations habilitées (résolu depuis `TrainerHabilitation`). */
  nbHabilitations: number;
  /** Quelques intitulés habilités, pour montrer le lien avec les prestations. */
  exemplesHabilitations: string[];
  /** Un CV source validé est-il au dossier ? */
  cvAuDossier: boolean;
  /** NDA du sous-traitant, si renseigné (indicateur 27). */
  sousTraitantNda?: string;
  /** Date de début de collaboration, déjà formatée. "" si inconnue. */
  depuis: string;
}

export interface ListeFormateursData {
  numero: string;
  estCopie?: boolean;
  estSpecimen?: boolean;
  specimenMotif?: string;
  /** Date d'édition, déjà formatée. */
  dateEdition: string;
  formateurs: FormateurListe[];
}

// ============================================================
// Libellés
// ============================================================

/**
 * Le libellé dit le LIEN CONTRACTUEL, pas seulement le statut — c'est la
 * colonne que le formulaire de déclaration réclame nommément. « Dirigeant »
 * seul ne dirait pas sous quel lien la personne intervient.
 */
const LIEN_CONTRACTUEL: Record<string, string> = {
  dirigeant: "Dirigeant de l'organisme — mandat social (sans contrat de travail)",
  salarie: "Salarié de l'organisme — contrat de travail",
  sous_traitant: "Prestataire externe — contrat de sous-traitance",
};

const QUALITE: Record<string, string> = {
  dirigeant: "Dirigeant-formateur",
  salarie: "Formateur salarié",
  sous_traitant: "Formateur sous-traitant",
};

// ============================================================
// Composant
// ============================================================

export function ListeFormateursPdf({
  data,
  identite,
}: {
  data: ListeFormateursData;
  identite: OrganismeIdentite;
}): React.ReactElement {
  const nbInternes = data.formateurs.filter((f) => f.statut !== "sous_traitant").length;
  const nbExternes = data.formateurs.length - nbInternes;

  return (
    <Document>
      <QualiopiPage
        docTitle="Liste des formateurs et qualifications"
        docNumber={data.numero}
        identite={identite}
        {...(data.estCopie ? { estCopie: true as const } : {})}
        {...(data.estSpecimen ? { estSpecimen: true as const } : {})}
        {...(data.specimenMotif ? { specimenMotif: data.specimenMotif } : {})}
      >
        <Text style={pdfStyles.legalNote}>
          Liste établie au titre de l&apos;article R.6351-5 du Code du travail (personnes
          intervenant dans les actions de formation : titres et qualités, lien avec la prestation
          réalisée, nature du lien contractuel avec l&apos;organisme) et de l&apos;indicateur 21 du
          référentiel national qualité.
        </Text>

        {/* 1. Synthèse */}
        <DocSection title="1. Effectif intervenant">
          <FieldRow label="Date d'édition" value={data.dateEdition} />
          <FieldRow
            label="Intervenants internes"
            value={`${nbInternes} (dirigeant(s) et salarié(s))`}
          />
          <FieldRow label="Intervenants externes" value={`${nbExternes} (sous-traitance)`} />
          <FieldRow
            label="Total"
            value={`${data.formateurs.length} personne(s) dispensant des heures de formation`}
            required
          />
        </DocSection>

        {/* 2. La liste — le cœur de la pièce */}
        <DocSection title="2. Liste des intervenants">
          {data.formateurs.length > 0 ? (
            <DataTable
              columns={[
                { key: "intervenant", header: "Intervenant", flex: 2 },
                { key: "qualite", header: "Titre et qualité", flex: 2 },
                { key: "lien", header: "Lien avec les prestations", flex: 3 },
                { key: "contrat", header: "Lien contractuel", flex: 3 },
              ]}
              rows={data.formateurs.map((f) => ({
                intervenant: f.depuis ? `${f.nomPrenom} (depuis le ${f.depuis})` : f.nomPrenom,
                qualite: QUALITE[f.statut] ?? f.statut,
                lien:
                  f.domaines.length > 0 || f.nbHabilitations > 0
                    ? [
                        f.domaines.length > 0 ? f.domaines.join(", ") : null,
                        f.nbHabilitations > 0
                          ? `${f.nbHabilitations} formation(s) habilitée(s)`
                          : null,
                      ]
                        .filter(Boolean)
                        .join(" — ")
                    : "Compétences non renseignées",
                contrat:
                  (LIEN_CONTRACTUEL[f.statut] ?? f.statut) +
                  (f.sousTraitantNda ? ` — NDA ${f.sousTraitantNda}` : ""),
              }))}
            />
          ) : (
            <Text style={pdfStyles.paragraph}>Aucun intervenant enregistré à ce jour.</Text>
          )}
        </DocSection>

        {/* 3. Pièces justificatives détenues */}
        <DocSection title="3. Pièces justificatives au dossier">
          <Text style={pdfStyles.paragraph}>
            Les pièces ci-dessous sont conservées au dossier de chaque intervenant et communicables
            sur demande.
          </Text>
          {data.formateurs.map((f, i) => (
            <FieldRow
              key={`${i}-${f.nomPrenom}`}
              label={f.nomPrenom}
              value={
                [
                  f.cvAuDossier ? "CV au dossier" : "CV non versé",
                  f.exemplesHabilitations.length > 0
                    ? `Habilité notamment sur : ${f.exemplesHabilitations.join(", ")}`
                    : null,
                ]
                  .filter(Boolean)
                  .join(" — ") || "—"
              }
            />
          ))}
        </DocSection>

        <Text style={pdfStyles.legalNote}>
          Aucun diplôme n&apos;est légalement exigé pour dispenser une action de formation
          professionnelle : la maîtrise des compétences s&apos;apprécie au regard du parcours, de
          l&apos;expérience et des réalisations de l&apos;intervenant, documentés par les pièces
          ci-dessus.
        </Text>
      </QualiopiPage>
    </Document>
  );
}
