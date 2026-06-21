/**
 * Qualiopi — Feuille d'émargement 1-to-1 / AFEST (preuve de présence par séance).
 *
 * Analogue de l'émargement collectif mais pour 1 bénéficiaire : tableau des
 * séances (date, durée, présence) avec colonnes de signature (bénéficiaire,
 * formateur, tuteur entreprise) — matérialise la réalité de l'alternance AFEST.
 *
 * NE PAS "use client" — rendu serveur exclusif (@react-pdf/renderer).
 */

import React from "react";
import { Document, Text, StyleSheet } from "@react-pdf/renderer";
import {
  QualiopiPage,
  pdfStyles,
  DocSection,
  FieldRow,
  DataTable,
  SignatureZone,
} from "@/server/qualiopi/documents/base-layout";
import type { OrganismeIdentite } from "@/server/qualiopi/documents/organisme";

const styles = StyleSheet.create({
  total: { marginTop: 8, fontSize: 10, fontWeight: "bold" },
});

export interface EmargementSeance1to1 {
  date: string;
  dureeLabel: string;
  present: boolean;
  beneficiaireSigne: boolean;
  formateurSigne: boolean;
  tuteurSigne: boolean;
}

export interface Emargement1to1Data {
  numero: string;
  dateEmission: string;
  identite: OrganismeIdentite;
  intitule: string;
  beneficiaire: { nom: string; prenom: string; entreprise?: string };
  formateur: string;
  tuteur?: string;
  seances: EmargementSeance1to1[];
  totalHeures: string;
  estCopie?: boolean;
}

function sig(ok: boolean): string {
  return ok ? "signé" : "—";
}

export function Emargement1to1Pdf({ data }: { data: Emargement1to1Data }): React.ReactElement {
  const prenomNom = `${data.beneficiaire.prenom} ${data.beneficiaire.nom}`.trim();
  return (
    <Document>
      <QualiopiPage
        docTitle="Feuille d'émargement — AFEST 1-to-1"
        docNumber={`N° ${data.numero}`}
        identite={data.identite}
        {...(data.estCopie === true ? { estCopie: true } : {})}
      >
        <DocSection title="Parcours">
          <FieldRow label="Intitulé" value={data.intitule} />
          <FieldRow
            label="Bénéficiaire"
            value={
              data.beneficiaire.entreprise
                ? `${prenomNom} (${data.beneficiaire.entreprise})`
                : prenomNom
            }
          />
          <FieldRow label="Formateur AFEST" value={data.formateur} />
          {data.tuteur ? <FieldRow label="Tuteur entreprise" value={data.tuteur} /> : null}
        </DocSection>

        <DocSection title="Présence par séance">
          <DataTable
            columns={[
              { key: "date", header: "Date", flex: 1.5 },
              { key: "duree", header: "Durée", flex: 1 },
              { key: "present", header: "Présent", flex: 1 },
              { key: "benef", header: "Bénéf.", flex: 1, align: "center" },
              { key: "formateur", header: "Formateur", flex: 1, align: "center" },
              { key: "tuteur", header: "Tuteur", flex: 1, align: "center" },
              { key: "observations", header: "Observations", flex: 1.5 },
            ]}
            rows={data.seances.map((s) => ({
              date: s.date,
              duree: s.dureeLabel,
              present: s.present ? "Oui" : "Non",
              benef: sig(s.beneficiaireSigne),
              formateur: sig(s.formateurSigne),
              tuteur: sig(s.tuteurSigne),
              observations: "",
            }))}
          />
          <Text style={styles.total}>{`Total heures réalisées : ${data.totalHeures} h`}</Text>
        </DocSection>

        <DocSection title="Attestation de présence">
          <Text style={pdfStyles.paragraph}>
            {`Le formateur atteste la réalité des séances ci-dessus et des mises en situation de travail correspondantes.`}
          </Text>
          <SignatureZone
            faitLe={data.dateEmission}
            parties={[
              { titre: "Le formateur", nom: data.formateur },
              { titre: "Cachet de l'organisme" },
            ]}
          />
        </DocSection>
      </QualiopiPage>
    </Document>
  );
}
