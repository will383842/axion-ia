/**
 * Cadre RECOPIÉ NON signable (tableau) — copie de DataTable de base-layout.tsx,
 * couleurs via `couleurPiece` / `pdfStylesPieces` (palette définitive).
 * Ne remplace RIEN : les gabarits signables gardent base-layout.tsx.
 */
import React from "react";
import { StyleSheet, Text, View } from "@react-pdf/renderer";
import {
  QUALIOPI_PDF_TYPE as T,
  QUALIOPI_PDF_SPACE as S,
} from "@/server/qualiopi/brand/brand-tokens";
import { couleurPiece } from "@/server/qualiopi/brand/jetons-pieces";
import { pdfStylesPieces } from "@/server/qualiopi/documents/cadre-pieces/styles-blocs";

export interface DataColumn {
  /** Clé dans chaque ligne (`rows[i][key]`). */
  key: string;
  /** Libellé d'en-tête. */
  header: string;
  /** Poids de la colonne (flex). Défaut 1. */
  flex?: number;
  /** Alignement du contenu. Défaut « left ». */
  align?: "left" | "right" | "center";
}

interface DataTableProps {
  columns: DataColumn[];
  rows: Array<Record<string, React.ReactNode>>;
  /** Nombre de lignes vides à ajouter (émargement papier). Défaut 0. */
  emptyRows?: number;
  /** Hauteur minimale des lignes (émargement = grandes cases). */
  minRowHeight?: number;
}

const tableLocal = StyleSheet.create({
  headerRow: {
    flexDirection: "row",
    backgroundColor: couleurPiece("sand"),
    borderTopWidth: 1,
    borderTopColor: couleurPiece("border-strong"),
    borderBottomWidth: 1.5,
    borderBottomColor: couleurPiece("border-strong"),
    paddingVertical: S.md,
    paddingHorizontal: S.sm,
  },
  headerCell: {
    fontSize: T.sm,
    fontWeight: "bold",
    color: couleurPiece("mocha"),
    paddingRight: S.sm,
  },
  dataRow: {
    flexDirection: "row",
    borderBottomWidth: 1,
    borderBottomColor: couleurPiece("border"),
    paddingVertical: S.md,
    paddingHorizontal: S.sm,
  },
  dataCell: {
    fontSize: T.base,
    color: couleurPiece("fg"),
    paddingRight: S.sm,
  },
});

/**
 * Tableau de données générique (en-tête + lignes + lignes vides optionnelles).
 * Remplace les `tableHeaderRow`/`tableDataRow`/`cellXxx` réinventés dans
 * facture, émargement, kits, lettre-mission, grille d'évaluation, etc.
 */
export function DataTable({
  columns,
  rows,
  emptyRows = 0,
  minRowHeight,
}: DataTableProps): React.ReactElement {
  const colStyle = (c: DataColumn) => ({
    flex: c.flex ?? 1,
    textAlign: (c.align ?? "left") as "left" | "right" | "center",
  });
  const rowStyle = minRowHeight
    ? [tableLocal.dataRow, { minHeight: minRowHeight }]
    : tableLocal.dataRow;

  return (
    <View style={pdfStylesPieces.table}>
      <View style={tableLocal.headerRow}>
        {columns.map((c) => (
          <Text key={c.key} style={[tableLocal.headerCell, colStyle(c)]}>
            {c.header}
          </Text>
        ))}
      </View>
      {rows.map((row, idx) => (
        <View key={idx} style={rowStyle} wrap={false}>
          {columns.map((c) => (
            <View key={c.key} style={colStyle(c)}>
              {typeof row[c.key] === "string" || typeof row[c.key] === "number" ? (
                <Text style={[tableLocal.dataCell, { textAlign: c.align ?? "left" }]}>
                  {row[c.key]}
                </Text>
              ) : (
                ((row[c.key] as React.ReactNode) ?? <Text style={tableLocal.dataCell}> </Text>)
              )}
            </View>
          ))}
        </View>
      ))}
      {Array.from({ length: emptyRows }).map((_, idx) => (
        <View key={`empty-${idx}`} style={rowStyle}>
          {columns.map((c) => (
            <View key={c.key} style={colStyle(c)}>
              <Text style={tableLocal.dataCell}> </Text>
            </View>
          ))}
        </View>
      ))}
    </View>
  );
}
