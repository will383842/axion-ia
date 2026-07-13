/**
 * Qualiopi — Fiche d'adaptation individuelle (docs A16/A9, ind. 10/20/26).
 *
 * Trace les adaptations réalisées pour un stagiaire sur une session
 * (Enrollment.adaptationsRealisees) + coordonnées du référent handicap +
 * rappel factuel de la procédure d'adaptation. EXPORT D'ÉTAT à la volée :
 * PAS un document officiel numéroté.
 *
 * Rendu serveur exclusif — NE PAS "use client".
 */

import React from "react";
import { Document, Text } from "@react-pdf/renderer";
import {
  QualiopiPage,
  DocSection,
  FieldRow,
  BulletList,
  LegalCallout,
  pdfStyles,
} from "@/server/qualiopi/documents/base-layout";
import type { OrganismeIdentite } from "@/server/qualiopi/documents/organisme";

// ============================================================
// Types
// ============================================================

export interface FicheAdaptationData {
  /** Date d'édition formatée (fr-FR). */
  dateEdition: string;
  nomStagiaire: string;
  prenomStagiaire: string;
  intituleSession: string;
  /** Dates de session formatées (fr-FR), ex. "01/09/2026 – 02/09/2026". */
  datesSession: string;
  /** Adaptations réalisées (Enrollment.adaptationsRealisees) — "" si aucune. */
  adaptationsRealisees: string;
  /** Référent handicap (SiteSetting qualiopi). */
  referentHandicapNom: string;
  referentHandicapEmail: string;
  referentHandicapTelephone: string;
  /** Délai de réponse du référent handicap (heures). */
  referentHandicapDelaiReponseH: number;
}

// ============================================================
// Composant
// ============================================================

export function FicheAdaptationPdf({
  data,
  identite,
}: {
  data: FicheAdaptationData;
  identite: OrganismeIdentite;
}): React.ReactElement {
  return (
    <Document>
      <QualiopiPage
        docTitle="Fiche d'adaptation individuelle"
        docNumber={`Éditée le ${data.dateEdition}`}
        identite={identite}
      >
        {/* Stagiaire + session */}
        <DocSection title="Bénéficiaire et session">
          <FieldRow label="Nom" value={data.nomStagiaire} required />
          <FieldRow label="Prénom" value={data.prenomStagiaire} required />
          <FieldRow label="Session" value={data.intituleSession} required />
          <FieldRow label="Dates" value={data.datesSession} />
        </DocSection>

        {/* Adaptations réalisées */}
        <DocSection title="Adaptations réalisées">
          {data.adaptationsRealisees.trim() ? (
            <Text style={pdfStyles.paragraph}>{data.adaptationsRealisees}</Text>
          ) : (
            <Text style={pdfStyles.legalNote}>
              Aucune adaptation renseignée pour cette inscription à ce jour.
            </Text>
          )}
        </DocSection>

        {/* Référent handicap */}
        <DocSection title="Référent handicap">
          <FieldRow label="Nom" value={data.referentHandicapNom} required />
          <FieldRow label="Email" value={data.referentHandicapEmail} />
          <FieldRow label="Téléphone" value={data.referentHandicapTelephone} />
          <FieldRow
            label="Délai de réponse"
            value={`${data.referentHandicapDelaiReponseH} heures`}
          />
        </DocSection>

        {/* Procédure d'adaptation — texte standard factuel */}
        <DocSection title="Procédure d'adaptation">
          <BulletList
            items={[
              "Recueil du besoin d'adaptation auprès du bénéficiaire (positionnement et échanges préalables).",
              "Analyse du besoin avec le référent handicap et, le cas échéant, l'entreprise.",
              "Définition et mise en œuvre des adaptations (rythme, supports, modalités, environnement).",
              "Suivi des adaptations pendant la prestation et traçage dans la présente fiche.",
            ]}
          />
        </DocSection>

        <LegalCallout variant="legal" title="Référentiel national qualité">
          Cette fiche trace l&apos;adaptation de la prestation aux bénéficiaires (indicateur 10) et
          l&apos;accueil des personnes en situation de handicap (indicateurs 20 et 26). Toute
          demande d&apos;adaptation peut être adressée au référent handicap ci-dessus.
        </LegalCallout>
      </QualiopiPage>
    </Document>
  );
}
