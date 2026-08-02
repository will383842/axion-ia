/**
 * Qualiopi — Organisation de l'action de formation.
 *
 * Pièce descriptive attendue à l'appui de la déclaration d'activité
 * (art. R.6351-5 C. trav., « organisation des actions ») et preuve du déroulé
 * pour les indicateurs 9 et 12. Le PROGRAMME dit ce qui est enseigné ; cette
 * pièce dit QUAND (calendrier réel `session_jours`), OÙ (lieu résolu comme sur
 * la convention) et COMMENT (rythme, encadrement, suivi de l'exécution).
 *
 * 🔴 Le calendrier vient de `session_jours`, jamais d'un découpage recalculé :
 * ce sont les horaires qui figurent sur les pièces d'émargement, et deux pièces
 * d'un même dossier ne doivent pas se contredire. Les horaires non confirmés
 * sont marqués comme PRÉVISIONNELS — un défaut visible et assumé se défend, le
 * même défaut muet ne se défend pas (même doctrine que D13/D14).
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
  pdfStyles,
} from "@/server/qualiopi/documents/base-layout";
import type { OrganismeIdentite } from "@/server/qualiopi/documents/organisme";

// ============================================================
// Types
// ============================================================

export interface JourOrganisationData {
  /** Date du jour, déjà formatée (fr-FR). */
  date: string;
  /** Horaires réels `HH:MM` (CHECK SQL côté base). */
  heureDebut: string;
  heureFin: string;
  /** Formateur du jour — vide = formateur principal de la session. */
  formateur: string;
  /** Faux = horaires proposés à la création, jamais confirmés. */
  horairesConfirmes: boolean;
}

export interface OrganisationActionData {
  numero: string;
  estCopie?: boolean;
  estSpecimen?: boolean;
  specimenMotif?: string;

  /** Intitulé de l'action, tel que porté par la convention. */
  intitule: string;
  /** Numéro de la session (traçabilité vers émargements et convention). */
  numeroSession: string;
  /** Date d'édition, déjà formatée. */
  dateEdition: string;

  /** Durée CONTRACTUELLE en heures — celle qui engage. */
  dureeHeures: number;
  modalite: string;
  lieu: string;
  effectifPrevu: number;

  /** Calendrier réel, un élément par journée, trié par date. */
  jours: JourOrganisationData[];
  /** Libellé du rythme, calculé par l'appelant (ex. « 1 journée continue »). */
  rythme: string;

  /** Formateur principal de la session — "" si non assigné. */
  formateurPrincipal: string;
  /** Contact du référent handicap, si désigné. */
  referentHandicapEmail?: string;
}

export interface OrganisationActionProps {
  data: OrganisationActionData;
  identite: OrganismeIdentite;
}

// ============================================================
// Composant
// ============================================================

export function OrganisationActionPdf({
  data,
  identite,
}: OrganisationActionProps): React.ReactElement {
  const auMoinsUnPrevisionnel = data.jours.some((j) => !j.horairesConfirmes);

  return (
    <Document>
      <QualiopiPage
        docTitle="Organisation de l'action de formation"
        docNumber={data.numero}
        identite={identite}
        {...(data.estCopie ? { estCopie: true as const } : {})}
        {...(data.estSpecimen ? { estSpecimen: true as const } : {})}
        {...(data.specimenMotif ? { specimenMotif: data.specimenMotif } : {})}
      >
        {/* 1. Identification */}
        <DocSection title="1. Identification de l'action">
          <FieldRow label="Intitulé" value={data.intitule} required />
          <FieldRow label="Session" value={data.numeroSession} />
          <FieldRow label="Durée totale" value={`${data.dureeHeures} heure(s)`} required />
          <FieldRow label="Modalité" value={data.modalite} required />
          <FieldRow label="Lieu de déroulement" value={data.lieu} required />
          <FieldRow label="Effectif prévu" value={`${data.effectifPrevu} stagiaire(s)`} />
          <FieldRow label="Date d'édition" value={data.dateEdition} />
        </DocSection>

        {/* 2. Calendrier — le cœur de la pièce */}
        <DocSection title="2. Calendrier de déroulement">
          {data.jours.length > 0 ? (
            <>
              <DataTable
                columns={[
                  { key: "date", header: "Date", flex: 2 },
                  { key: "horaires", header: "Horaires", flex: 2, align: "center" },
                  { key: "formateur", header: "Formateur", flex: 3 },
                ]}
                rows={data.jours.map((j) => ({
                  date: j.date,
                  horaires: `${j.heureDebut} – ${j.heureFin}${j.horairesConfirmes ? "" : " *"}`,
                  formateur: j.formateur || data.formateurPrincipal || "—",
                }))}
              />
              {auMoinsUnPrevisionnel ? (
                <Text style={pdfStyles.legalNote}>
                  * Horaires prévisionnels, non encore confirmés. Les horaires constatés figurent
                  sur les feuilles d&apos;émargement.
                </Text>
              ) : null}
            </>
          ) : (
            /*
              On DIT que le calendrier n'est pas arrêté plutôt que d'imprimer une
              section vide : les dates de début et de fin restent portées par la
              convention, et une pièce qui nomme sa lacune est vérifiable.
            */
            <Text style={pdfStyles.legalNote}>
              Le calendrier détaillé n&apos;est pas encore arrêté pour cette session. Les dates de
              début et de fin figurent sur la convention de formation.
            </Text>
          )}
        </DocSection>

        {/* 3. Rythme */}
        <DocSection title="3. Durée et rythme">
          <FieldRow label="Rythme" value={data.rythme} />
          <Text style={pdfStyles.paragraph}>
            L&apos;assiduité est suivie par demi-journée : émargement signé par le stagiaire et le
            formateur en présentiel, relevé de connexion horodaté en distanciel. Ces pièces
            constituent la preuve de l&apos;exécution de l&apos;action.
          </Text>
        </DocSection>

        {/* 4. Encadrement */}
        <DocSection title="4. Encadrement et coordination">
          <FieldRow
            label="Formateur principal"
            value={data.formateurPrincipal || "Non renseigné"}
            required
          />
          <FieldRow label="Coordination pédagogique" value={identite.email || "—"} />
          <FieldRow
            label="Référent handicap"
            value={data.referentHandicapEmail || identite.email || "—"}
          />
          <Text style={pdfStyles.paragraph}>
            Les stagiaires reçoivent une convocation précisant dates, horaires et lieu, ainsi
            qu&apos;un livret d&apos;accueil. Toute difficulté d&apos;organisation peut être
            signalée au contact ci-dessus ; les réclamations sont tracées et suivies.
          </Text>
        </DocSection>

        <Text style={pdfStyles.legalNote}>
          Pièce établie au titre de l&apos;organisation des actions de formation (art. R.6351-5 du
          Code du travail). Le contenu pédagogique de l&apos;action figure au programme, annexé à la
          convention de formation.
        </Text>
      </QualiopiPage>
    </Document>
  );
}
