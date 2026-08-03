/**
 * Qualiopi — Template PDF : Grille d'évaluation des compétences.
 *
 * Type : Initiale / En cours / Finale.
 * Grille : compétences avec barème Non acquis (1) / En cours (2) / Acquis (3).
 * Score total / max, niveau global, recommandations.
 * Signatures formateur + stagiaire.
 * Indicateur Qualiopi n°11.
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
} from "@/server/qualiopi/documents/base-layout";
import type { OrganismeIdentite } from "@/server/qualiopi/documents/organisme";
import { brandColor } from "@/server/qualiopi/brand/brand-tokens";

// ============================================================
// Styles locaux
// ============================================================

const localStyles = StyleSheet.create({
  typeRow: {
    flexDirection: "row",
    marginBottom: 12,
    gap: 16,
  },
  typeOption: {
    flexDirection: "row",
    alignItems: "center",
    gap: 6,
  },
  checkBox: {
    width: 12,
    height: 12,
    borderWidth: 1,
    borderColor: brandColor("border-strong"),
  },
  checkBoxChecked: {
    width: 12,
    height: 12,
    borderWidth: 1,
    borderColor: brandColor("terracotta"),
    backgroundColor: brandColor("terracotta"),
  },
  typeLabel: { fontSize: 10, color: brandColor("fg") },
  summaryBox: {
    backgroundColor: brandColor("sand"),
    borderRadius: 2,
    padding: 8,
    marginTop: 8,
    marginBottom: 8,
  },
  levelRow: {
    flexDirection: "row",
    marginTop: 8,
    gap: 12,
  },
  levelOption: {
    flexDirection: "row",
    alignItems: "center",
    gap: 5,
  },
  levelLabel: { fontSize: 10, color: brandColor("fg") },
});

// ============================================================
// Types
// ============================================================

export type EvaluationType = "initiale" | "en-cours" | "finale";

export interface CompetenceItem {
  libelle: string;
  /** Note 1 (non acquis), 2 (en cours), 3 (acquis) — optionnelle si grille vide. */
  note?: 1 | 2 | 3;
  observations?: string;
}

export interface GrilleEvaluationData {
  numero: string;
  estCopie?: boolean;
  intituleFormation: string;
  dateEvaluation: string;
  typeEvaluation: EvaluationType;
  nomFormateur: string;
  nomStagiaire: string;
  competences: CompetenceItem[];
  recommandations?: string;
}

// ============================================================
// Helpers
// ============================================================

const TYPE_LABELS: Record<EvaluationType, string> = {
  initiale: "Initiale",
  "en-cours": "En cours de formation",
  finale: "Finale",
};

const NOTE_LABELS: Record<1 | 2 | 3, string> = {
  1: "Non acquis",
  2: "En cours",
  3: "Acquis",
};

function noteToText(note?: 1 | 2 | 3): string {
  if (note === undefined) return "";
  return `${note} — ${NOTE_LABELS[note]}`;
}

/**
 * Niveau global, ou `"—"` quand **aucune** compétence n'est notée.
 *
 * 🔴 Audit pré-visite 2026-08-03. Sans ce garde, une grille VIERGE cochait
 * « Non acquis » : zéro note donne un total de 0, donc 0 %, donc `pct < 50`.
 *
 * Constaté sur le premier dossier réel. La grille `AXI-DOC-2026-019` affichait
 * « Score total : — / 15 » — donc explicitement aucune note — **et** la case
 * « Non acquis » cochée, pendant que l'attestation du même dossier portait
 * « Réussite — score 100 % ». Deux pièces du même dossier qui se contredisent,
 * c'est ce qu'un contrôle relève en premier.
 *
 * Un formulaire non rempli ne dit rien du niveau atteint. Il ne coche donc rien.
 */
function computeNiveauGlobal(scores: number[], max: number): string {
  if (max === 0 || scores.length === 0) return "—";
  const total = scores.reduce((a, b) => a + b, 0);
  const pct = (total / max) * 100;
  if (pct < 50) return "Non acquis";
  if (pct <= 80) return "Partiellement acquis (50–80 %)";
  return "Acquis";
}

// ============================================================
// Composant
// ============================================================

export function GrilleEvaluationPdf({
  data,
  identite,
}: {
  data: GrilleEvaluationData;
  identite: OrganismeIdentite;
}): React.ReactElement {
  const notedItems = data.competences.filter((c) => c.note !== undefined);
  const scoreTotal = notedItems.reduce((s, c) => s + (c.note ?? 0), 0);
  const scoreMax = data.competences.length * 3;
  const niveauGlobal = computeNiveauGlobal(
    notedItems.map((c) => c.note ?? 0),
    scoreMax,
  );

  return (
    <Document>
      <QualiopiPage
        docTitle="Grille d'évaluation des compétences"
        docNumber={data.numero}
        identite={identite}
        {...(data.estCopie !== undefined ? { estCopie: data.estCopie } : {})}
      >
        {/* Mention indicateur */}
        <View style={{ marginBottom: 10 }}>
          <Text style={pdfStyles.legalNote}>
            Indicateur Qualiopi n°11 — Évaluation des acquis à l'issue de la formation.
          </Text>
        </View>

        {/* Type d'évaluation */}
        <DocSection title="Type d'évaluation">
          <View style={localStyles.typeRow}>
            {(["initiale", "en-cours", "finale"] as EvaluationType[]).map((t) => (
              <View key={t} style={localStyles.typeOption}>
                <View
                  style={
                    data.typeEvaluation === t ? localStyles.checkBoxChecked : localStyles.checkBox
                  }
                />
                <Text style={localStyles.typeLabel}>{TYPE_LABELS[t]}</Text>
              </View>
            ))}
          </View>
          <FieldRow label="Formation" value={data.intituleFormation} />
          <FieldRow label="Date d'évaluation" value={data.dateEvaluation} />
          <FieldRow label="Stagiaire" value={data.nomStagiaire} />
          <FieldRow label="Formateur / Formatrice" value={data.nomFormateur} />
        </DocSection>

        {/* Grille des compétences */}
        <DocSection title="Grille des compétences — Barème : 1 Non acquis | 2 En cours | 3 Acquis">
          <DataTable
            columns={[
              { key: "competence", header: "Compétence", flex: 4 },
              { key: "note", header: "Note /3", flex: 1, align: "center" },
              { key: "observations", header: "Observations", flex: 3 },
            ]}
            rows={data.competences.map((comp) => ({
              competence: comp.libelle,
              note: noteToText(comp.note),
              observations: comp.observations ?? "",
            }))}
            minRowHeight={28}
          />

          {/* Score */}
          <View style={localStyles.summaryBox}>
            <Text style={{ fontSize: 10, fontWeight: "bold" }}>
              Score total : {notedItems.length > 0 ? scoreTotal : "—"} / {scoreMax}
            </Text>
          </View>
        </DocSection>

        {/* Niveau global */}
        <DocSection title="Niveau global">
          <View style={localStyles.levelRow}>
            {(["Non acquis", "Partiellement acquis (50–80 %)", "Acquis"] as const).map((n) => (
              <View key={n} style={localStyles.levelOption}>
                <View
                  style={niveauGlobal === n ? localStyles.checkBoxChecked : localStyles.checkBox}
                />
                <Text style={localStyles.levelLabel}>{n}</Text>
              </View>
            ))}
          </View>
          <View style={{ marginTop: 6 }}>
            <Text style={{ fontSize: 9, color: brandColor("fg-soft") }}>
              Seuils : Non acquis {"<"} 50 % | Partiellement acquis 50–80 % | Acquis {">"} 80 %
            </Text>
          </View>
        </DocSection>

        {/* Recommandations */}
        <DocSection title="Recommandations du formateur">
          <View
            style={{
              borderWidth: 1,
              borderColor: brandColor("border"),
              minHeight: 50,
              padding: 6,
              borderRadius: 2,
            }}
          >
            {data.recommandations ? (
              <Text style={pdfStyles.paragraph}>{data.recommandations}</Text>
            ) : null}
          </View>
        </DocSection>

        {/* Signatures */}
        <View style={pdfStyles.signatureZone}>
          <View style={pdfStyles.signatureBox}>
            <Text style={{ fontSize: 9, fontWeight: "bold", marginBottom: 4 }}>
              Signature du formateur / de la formatrice
            </Text>
            <Text style={{ fontSize: 8, color: brandColor("fg-soft") }}>
              Nom : {data.nomFormateur}
            </Text>
            <Text style={{ fontSize: 8, color: brandColor("fg-soft"), marginTop: 4 }}>Date :</Text>
          </View>
          <View style={pdfStyles.signatureBox}>
            <Text style={{ fontSize: 9, fontWeight: "bold", marginBottom: 4 }}>
              Signature du / de la stagiaire
            </Text>
            <Text style={{ fontSize: 8, color: brandColor("fg-soft") }}>
              Nom : {data.nomStagiaire}
            </Text>
            <Text style={{ fontSize: 8, color: brandColor("fg-soft"), marginTop: 4 }}>Date :</Text>
          </View>
        </View>
      </QualiopiPage>
    </Document>
  );
}
