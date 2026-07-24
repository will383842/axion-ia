/**
 * Qualiopi — Feuille d'émargement 1-to-1 / AFEST (preuve de présence par séance).
 *
 * Analogue de l'émargement collectif mais pour 1 bénéficiaire : tableau des
 * séances (date, durée, présence DÉCLARÉE par l'organisme).
 *
 * 🔴 Ce document NE porte PAS de signature électronique des parties : tant que
 * la signature 1-to-1 n'est pas déployée, il affiche des présences déclarées et
 * un avertissement explicite (pas de fausses cases « signé »). Voir chantier
 * fondation signature AFEST (différé).
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
  avertissement: { marginTop: 6, fontSize: 8, fontStyle: "italic", color: "#6a1c10" },
});

export interface EmargementSeance1to1 {
  date: string;
  dureeLabel: string;
  /** Présence DÉCLARÉE par l'organisme (pas une signature du bénéficiaire). */
  present: boolean;
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

        <DocSection title="Séances réalisées (présences déclarées par l'organisme)">
          <DataTable
            columns={[
              { key: "date", header: "Date", flex: 1.5 },
              { key: "duree", header: "Durée", flex: 1 },
              { key: "present", header: "Présent", flex: 1 },
              { key: "observations", header: "Observations", flex: 2 },
            ]}
            rows={data.seances.map((s) => ({
              date: s.date,
              duree: s.dureeLabel,
              present: s.present ? "Oui" : "Non",
              observations: "",
            }))}
          />
          <Text style={styles.total}>{`Total heures réalisées : ${data.totalHeures} h`}</Text>
          {/* 🔴 HONNÊTETÉ — auparavant ce tableau portait 3 colonnes « signé »
              (bénéficiaire/formateur/tuteur) rendues à partir de simples cases
              cochées par l'admin, SANS acte signataire, image, ni empreinte : un
              faux positif de preuve. Tant que la signature électronique 1-to-1
              n'est pas déployée, le document dit la vérité : présences DÉCLARÉES
              par l'organisme, non signées par les parties. */}
          <Text style={styles.avertissement}>
            {"Présences déclarées par l'organisme de formation. La signature électronique du " +
              "bénéficiaire, du formateur et du tuteur entreprise est en cours de déploiement : ce " +
              "document ne constitue pas encore un émargement signé par les parties."}
          </Text>
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
