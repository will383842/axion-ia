/**
 * Qualiopi — Template PDF : évaluation finale RÉALISÉE, nominative et datée.
 *
 * 🔴 Constat du dossier ZIP du 2026-09-30. L'indicateur 11 n'y était prouvé
 * que par la grille d'évaluation du registre — une pièce qui, tirée avant
 * l'évaluation, reste un formulaire à compléter. Cette pièce-ci porte le
 * RÉSULTAT enregistré (`EvaluationAcquis`) : score, niveau global, réussite,
 * notes par compétence, recommandations, et la date de l'évaluation.
 *
 * Elle n'imprime que ce qui est en base : le niveau global et la réussite sont
 * ceux qui ont été enregistrés, jamais recalculés ici.
 *
 * Ce n'est PAS une pièce du registre (`DocumentGenere`) : elle est rendue à la
 * volée depuis la base au moment de constituer le dossier.
 *
 * NE PAS "use client" — rendu serveur exclusif (@react-pdf/renderer).
 */

import React from "react";
import { Document, View, Text } from "@react-pdf/renderer";
import {
  QualiopiPage,
  pdfStyles,
  DocSection,
  FieldRow,
  DataTable,
  LegalCallout,
} from "@/server/qualiopi/documents/base-layout";
import type { OrganismeIdentite } from "@/server/qualiopi/documents/organisme";

export interface CompetenceEvaluee {
  libelle: string;
  /** 1 non acquis, 2 en cours, 3 acquis — absente si la compétence n'est pas notée. */
  note?: 1 | 2 | 3;
  observations?: string;
}

export interface EvaluationRealiseeData {
  /** Référence stable de la pièce (dérivée de l'identifiant de l'évaluation). */
  reference: string;
  nomStagiaire: string;
  intituleFormation: string;
  /** Date de l'évaluation, date et heure de Paris. */
  evalueeLe: string;
  /** Instant RÉEL du tirage de la pièce, date et heure de Paris. */
  tireeLe: string;
  scoreObtenu: number;
  scoreMax: number;
  scorePct: number;
  niveauGlobal: "non_acquis" | "partiellement_acquis" | "acquis";
  reussite: boolean;
  competences: CompetenceEvaluee[];
  recommandations: string | null;
}

const NIVEAU_LABELS: Record<EvaluationRealiseeData["niveauGlobal"], string> = {
  non_acquis: "Non acquis",
  partiellement_acquis: "Partiellement acquis",
  acquis: "Acquis",
};

const NOTE_LABELS: Record<1 | 2 | 3, string> = {
  1: "1 — Non acquis",
  2: "2 — En cours",
  3: "3 — Acquis",
};

export function EvaluationRealiseePdf({
  data,
  identite,
}: {
  data: EvaluationRealiseeData;
  identite: OrganismeIdentite;
}): React.ReactElement {
  return (
    <Document>
      <QualiopiPage
        docTitle="Évaluation finale des acquis — résultat"
        docNumber={data.reference}
        identite={identite}
      >
        <View style={{ marginBottom: 10 }}>
          <FieldRow label="Stagiaire" value={data.nomStagiaire} />
          <FieldRow label="Formation" value={data.intituleFormation} />
          <FieldRow label="Évaluation réalisée le" value={data.evalueeLe} />
          <Text style={pdfStyles.paragraph}>{`Pièce tirée le ${data.tireeLe}.`}</Text>
        </View>

        <DocSection title="Résultat">
          <FieldRow
            label="Score"
            value={`${data.scoreObtenu} / ${data.scoreMax} (${data.scorePct} %)`}
          />
          <FieldRow label="Niveau global" value={NIVEAU_LABELS[data.niveauGlobal]} />
          <FieldRow label="Réussite" value={data.reussite ? "Oui" : "Non"} />
        </DocSection>

        {data.competences.length > 0 ? (
          <DocSection title="Compétences évaluées — barème : 1 Non acquis | 2 En cours | 3 Acquis">
            <DataTable
              columns={[
                { key: "competence", header: "Compétence", flex: 4 },
                { key: "note", header: "Note /3", flex: 2 },
                { key: "observations", header: "Observations", flex: 3 },
              ]}
              rows={data.competences.map((c) => ({
                competence: c.libelle,
                note: c.note !== undefined ? NOTE_LABELS[c.note] : "Non notée",
                observations: c.observations ?? "",
              }))}
            />
          </DocSection>
        ) : null}

        <DocSection title="Recommandations">
          <Text style={pdfStyles.paragraph}>{data.recommandations ?? "Non renseigné"}</Text>
        </DocSection>

        <LegalCallout variant="legal">
          Pièce établie à partir de l&apos;évaluation finale enregistrée — Indicateur Qualiopi 11.
          Droit d&apos;accès : {identite.dpoEmail || identite.email || "contact@formation"}.
        </LegalCallout>
      </QualiopiPage>
    </Document>
  );
}
