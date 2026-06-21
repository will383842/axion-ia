/**
 * Qualiopi — Lettre de mission formateur sous-traitant.
 *
 * Définit le périmètre de mission, les formations confiées, le tarif,
 * les obligations de confidentialité et de conformité Qualiopi.
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
  SignatureZone,
  formatEur,
  pdfStyles,
} from "@/server/qualiopi/documents/base-layout";
import type { OrganismeIdentite } from "@/server/qualiopi/documents/organisme";

// ============================================================
// Types
// ============================================================

export interface FormationConfiee {
  intitule: string;
  dateDebut: string;
  dateFin: string;
  lieuOuModalite: string;
  dureeHeures: number;
}

export interface LettreMissionData {
  numero: string;
  estCopie?: boolean;
  // Formateur
  formateur: {
    nomPrenom: string;
    siretOuSirenOuNaf?: string;
    adresse: string;
    email: string;
    telephone?: string;
    specialite: string;
  };
  // Mission
  objetMission: string;
  formations: FormationConfiee[];
  tarifJourHt: number;
  // Dates
  dateMission: string;
}

// ============================================================
// Composant
// ============================================================

export function LettreMissionPdf({
  data,
  identite,
}: {
  data: LettreMissionData;
  identite: OrganismeIdentite;
}): React.ReactElement {
  return (
    <Document>
      <QualiopiPage
        docTitle="Lettre de mission formateur"
        docNumber={data.numero}
        identite={identite}
        {...(data.estCopie ? { estCopie: true as const } : {})}
      >
        {/* 1. Parties */}
        <DocSection title="1. Parties">
          <Text style={[pdfStyles.paragraph, { fontWeight: "bold" }]}>
            Organisme de formation (mandant)
          </Text>
          <FieldRow label="Raison sociale" value={identite.raisonSociale || "Axion-IA SAS"} />
          <FieldRow label="SIRET" value={identite.siret} required />
          <FieldRow label="NDA" value={identite.nda} required />
          <FieldRow label="Qualiopi" value={identite.qualiopi} required />
          <FieldRow label="Adresse" value={identite.adresseSiege} required />

          <Text style={[pdfStyles.paragraph, { fontWeight: "bold", marginTop: 8 }]}>
            Formateur (mandataire sous-traitant)
          </Text>
          <FieldRow label="Nom / Prénom" value={data.formateur.nomPrenom} />
          {data.formateur.siretOuSirenOuNaf ? (
            <FieldRow label="SIRET / SIREN / NAF" value={data.formateur.siretOuSirenOuNaf} />
          ) : null}
          <FieldRow label="Adresse" value={data.formateur.adresse} />
          <FieldRow label="Email" value={data.formateur.email} />
          {data.formateur.telephone ? (
            <FieldRow label="Téléphone" value={data.formateur.telephone} />
          ) : null}
          <FieldRow label="Spécialité" value={data.formateur.specialite} />
        </DocSection>

        {/* 2. Objet et périmètre */}
        <DocSection title="2. Objet et périmètre de la mission">
          <Text style={pdfStyles.paragraph}>{data.objetMission}</Text>
        </DocSection>

        {/* 3. Formations confiées */}
        <DocSection title="3. Formation(s) confiée(s)">
          <DataTable
            columns={[
              { key: "intitule", header: "Intitulé", flex: 2 },
              { key: "dateDebut", header: "Du", flex: 1 },
              { key: "dateFin", header: "Au", flex: 1 },
              { key: "duree", header: "Durée", flex: 1 },
              { key: "lieuOuModalite", header: "Lieu / Modalité", flex: 1 },
            ]}
            rows={data.formations.map((f) => ({
              intitule: f.intitule,
              dateDebut: f.dateDebut,
              dateFin: f.dateFin,
              duree: `${f.dureeHeures} h`,
              lieuOuModalite: f.lieuOuModalite,
            }))}
          />
        </DocSection>

        {/* 4. Tarif */}
        <DocSection title="4. Rémunération">
          <FieldRow label="Tarif journalier HT" value={formatEur(data.tarifJourHt) + " / jour"} />
          <Text style={pdfStyles.legalNote}>
            La facturation s'effectue sur présentation de facture conforme par le formateur, après
            chaque session réalisée. Le tarif est exprimé hors taxes (TVA selon régime applicable au
            formateur).
          </Text>
        </DocSection>

        {/* 5. Obligations */}
        <DocSection title="5. Obligations du formateur">
          <BulletList
            items={[
              "Respecter les référentiels pédagogiques transmis par l'organisme de formation.",
              "Être titulaire ou en cours d'obtention d'une certification Qualiopi valide (ou sous sous-traitance déclarée conformément à l'indicateur 27 du référentiel Qualiopi) et en justifier sur demande (indicateur 19).",
              "Maintenir la confidentialité sur tout document, programme, technique ou information appris dans le cadre de cette mission (NDA implicite — voir article 6).",
              "Remettre les feuilles d'émargement dûment signées à l'issue de chaque demi-journée.",
              "Informer l'organisme sans délai de toute difficulté pédagogique ou logistique susceptible d'affecter la réalisation de la formation.",
            ]}
          />
        </DocSection>

        {/* 6. Confidentialité */}
        <DocSection title="6. Confidentialité">
          <Text style={pdfStyles.paragraph}>
            Le formateur s'engage à ne divulguer à aucun tiers, pendant la durée de la mission et
            pendant cinq (5) ans après son terme, toute information confidentielle relative à
            l'organisme de formation, à ses clients, stagiaires, méthodes pédagogiques, outils ou
            supports, sauf autorisation écrite préalable de l'organisme ou obligation légale.
          </Text>
        </DocSection>

        {/* 7. Signatures */}
        <DocSection title="7. Signatures">
          <SignatureZone
            faitLe={`_________________________, le ${data.dateMission}`}
            parties={[
              {
                titre: "Pour l'organisme de formation",
                nom: identite.raisonSociale || "Axion-IA SAS",
              },
              {
                titre: "Pour le formateur",
                nom: data.formateur.nomPrenom,
                mention: "Nom, signature",
              },
            ]}
          />
        </DocSection>
      </QualiopiPage>
    </Document>
  );
}
