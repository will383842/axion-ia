/**
 * Qualiopi — Template PDF : Feuille d'émargement présentiel.
 *
 * Tableau participants : Nom-Prénom / Entreprise / Signature matin /
 * Signature après-midi / Paraphe formateur / Observations.
 * Mention de certification + signature formateur + visa responsable pédagogique.
 * Conservation obligatoire 5 ans (DOCUMENT_RETENTION_YEARS).
 *
 * NE PAS "use client" — rendu serveur exclusif (@react-pdf/renderer).
 */

import React from "react";
import { Document, View, Text, StyleSheet } from "@react-pdf/renderer";
import {
  QualiopiPage,
  pdfStyles,
  DocSection,
  FieldRow,
  DataTable,
  SignatureZone,
} from "@/server/qualiopi/documents/base-layout";
import type { OrganismeIdentite } from "@/server/qualiopi/documents/organisme";
import { DOCUMENT_RETENTION_YEARS } from "@/server/qualiopi/legal/legal-mentions";
import { brandColor } from "@/server/qualiopi/brand/brand-tokens";

// ============================================================
// Styles locaux
// ============================================================

const localStyles = StyleSheet.create({
  certificationText: {
    fontSize: 10,
    fontWeight: "bold",
    color: brandColor("mocha"),
    marginTop: 16,
    marginBottom: 8,
  },
});

// ============================================================
// Types
// ============================================================

export interface EmargementParticipant {
  nom: string;
  entreprise?: string;
}

/** Une case d'émargement, telle qu'elle sera imprimée. */
export interface EmargementCase {
  /** En-tête de colonne, ex. « Matin (09:00–13:00) ». */
  entete: string;
  /** Valeur imprimée : heure de signature, écart éventuel, ou vide. */
  valeurs: string[];
}

/** Une journée réellement animée. */
export interface EmargementJournee {
  dateLisible: string;
  horaires: string;
  formateurNom: string;
  modules: string[];
  entetes: string[];
  lignes: Array<{
    nom: string;
    entreprise: string;
    /** Une entrée par demi-journée, dans l'ordre des `entetes`. */
    cases: string[];
    /** Ancrage de chaîne — voir `feuille-pdf.ts`. */
    ancrage: string;
  }>;
  /**
   * Contresignatures du formateur pour la journée, une ligne lisible par
   * demi-journée contresignée. Exigence « stagiaire ET formateur »
   * (CAA Nantes 20/04/2021). Vide = journée non contresignée, affichée comme
   * telle plutôt que masquée.
   */
  contresignatures: string[];
}

export interface EmargementData {
  numero: string;
  estCopie?: boolean;
  intituleFormation: string;
  numeroSession: string;
  lieu: string;
  nda: string;
  /**
   * Journées RÉELLEMENT animées, avec leurs horaires réels.
   *
   * 🔴 Remplace l'ancien couple `date` + `horaires` codé en dur à
   * « 09h00–17h00 » : sur une session de plusieurs jours, la pièce était fausse.
   * `CAA Nantes 20/04/2021` sanctionne précisément les feuilles sans horaires
   * exacts et sans nom de formateur.
   */
  journees: EmargementJournee[];
  /** Total de signatures au tirage — l'ancre globale du document. */
  totalSignatures: number;
  /** Nombre de lignes vides à ajouter après les participants (défaut 3). */
  lignesVides?: number;
}

// ============================================================
// Composant
// ============================================================

export function EmargementPdf({
  data,
  identite,
}: {
  data: EmargementData;
  identite: OrganismeIdentite;
}): React.ReactElement {
  const lignesVides = data.lignesVides ?? 3;

  return (
    <Document>
      <QualiopiPage
        docTitle="Feuille d'émargement — Présentiel"
        docNumber={data.numero}
        identite={identite}
        {...(data.estCopie !== undefined ? { estCopie: data.estCopie } : {})}
      >
        {/* En-tête de session */}
        <DocSection title="Informations de la session">
          <FieldRow label="Formation" value={data.intituleFormation} />
          <FieldRow label="Session" value={data.numeroSession} />
          <FieldRow label="Lieu" value={data.lieu} />
          <FieldRow label="NDA organisme" value={data.nda || identite.nda} required />
          {/* Ancrage : ce nombre, figé dans un document numéroté et archivé,
              rend détectable la suppression des dernières signatures — que le
              chaînage seul ne voit pas. */}
          <FieldRow
            label="Signatures enregistrées au tirage"
            value={String(data.totalSignatures)}
          />
        </DocSection>

        {/* Un tableau PAR JOURNÉE : une session de trois jours produit trois
            tableaux, chacun avec ses horaires réels et son formateur. */}
        {data.journees.map((journee, index) => (
          <DocSection
            key={`${journee.dateLisible}-${index}`}
            title={`${journee.dateLisible} — ${journee.horaires} (heure de Paris)`}
          >
            <FieldRow label="Formateur / Formatrice" value={journee.formateurNom} required />
            {journee.modules.length > 0 && (
              <FieldRow label="Modules couverts" value={journee.modules.join(" · ")} />
            )}
            <DataTable
              columns={[
                { key: "nom", header: "Nom — Prénom", flex: 2 },
                { key: "entreprise", header: "Entreprise", flex: 2 },
                ...journee.entetes.map((e, i) => ({
                  key: `case${i}`,
                  header: e,
                  flex: 2,
                })),
                { key: "ancrage", header: "Réf. signature", flex: 2 },
              ]}
              rows={journee.lignes.map((l) => {
                const ligne: Record<string, string> = {
                  nom: l.nom,
                  entreprise: l.entreprise,
                  ancrage: l.ancrage,
                };
                l.cases.forEach((c, i) => {
                  ligne[`case${i}`] = c;
                });
                return ligne;
              })}
              emptyRows={lignesVides}
              minRowHeight={32}
            />
            {/* Signature du formateur, exigée EN PLUS de celle des stagiaires
                (CAA Nantes 20/04/2021). Absence dite explicitement : une feuille
                dont le formateur n'a pas signé est insuffisamment probante. */}
            {journee.contresignatures.length > 0 ? (
              journee.contresignatures.map((c) => (
                <FieldRow key={c} label="Contresignature formateur" value={c} />
              ))
            ) : (
              <FieldRow
                label="Contresignature formateur"
                value="Non contresignée par le formateur — feuille incomplète."
                required
              />
            )}
          </DocSection>
        ))}

        {/* Certification des présences */}
        <View>
          <Text style={localStyles.certificationText}>
            Je certifie l'exactitude des présences enregistrées sur ce document.
          </Text>
        </View>

        {/* Zone de signatures. La signature du formateur est portée PAR JOURNÉE
            ci-dessus (contresignature électronique, horodatée). Cet encadré
            recueille le visa du responsable pédagogique et sert de repli manuel
            si une journée n'a pas pu être contresignée électroniquement. */}
        <SignatureZone
          parties={[
            {
              titre: "Contresignature du formateur / de la formatrice",
              nom: `Nom : ${data.journees[0]?.formateurNom ?? ""}`,
              mention: "Contresignée par journée ci-dessus, ou à défaut ici — Date :",
            },
            {
              titre: "Visa du responsable pédagogique",
              nom: "Nom :",
              mention: "Date :",
            },
          ]}
        />

        {/* Mention conservation */}
        <Text style={pdfStyles.legalNote}>
          Document à conserver {DOCUMENT_RETENTION_YEARS} ans — Article L.6353-9 du Code du travail.
        </Text>
      </QualiopiPage>
    </Document>
  );
}
