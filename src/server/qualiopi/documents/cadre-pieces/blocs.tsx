/**
 * Cadre RECOPIÉ NON signable (blocs) — copie de DocSection, FieldRow, NdaFieldRow et
 * BulletList de base-layout.tsx, couleurs via `couleurPiece` / `pdfStylesPieces`
 * (palette définitive). Ne remplace RIEN : les gabarits signables gardent base-layout.tsx.
 * Les commentaires d'historique restent dans base-layout.tsx.
 */
import React from "react";
import { StyleSheet, Text, View } from "@react-pdf/renderer";
import {
  QUALIOPI_PDF_TYPE as T,
  QUALIOPI_PDF_SPACE as S,
} from "@/server/qualiopi/brand/brand-tokens";
import { couleurPiece } from "@/server/qualiopi/brand/jetons-pieces";
import { pdfStylesPieces } from "@/server/qualiopi/documents/cadre-pieces/styles-blocs";

const pdfStyles = pdfStylesPieces;

interface DocSectionProps {
  title: string;
  children: React.ReactNode;
}

/** Section avec titre et séparateur. */
export function DocSection({ title, children }: DocSectionProps): React.ReactElement {
  return (
    <View style={pdfStyles.section}>
      <Text style={pdfStyles.sectionTitle}>{title}</Text>
      {children}
    </View>
  );
}

interface FieldRowProps {
  label: string;
  value: string;
  /**
   * Si `true` et `value` vide/—, la valeur est rendue en rouge italique
   * (« Non renseigné ») au lieu d'être masquée : un identifiant obligatoire
   * absent doit SAUTER AUX YEUX, pas disparaître en silence.
   */
  required?: boolean;
}

/** Ligne label / valeur (tableau de champs). */
export function FieldRow({ label, value, required = false }: FieldRowProps): React.ReactElement {
  const isMissing = !value || !value.trim() || value.trim() === "—";
  if (isMissing && required) {
    return (
      <View style={pdfStyles.fieldRow}>
        <Text style={pdfStyles.fieldLabel}>{label}</Text>
        <Text style={pdfStyles.fieldValueMissing}>Non renseigné</Text>
      </View>
    );
  }
  return (
    <View style={pdfStyles.fieldRow}>
      <Text style={pdfStyles.fieldLabel}>{label}</Text>
      <Text style={pdfStyles.fieldValue}>{value}</Text>
    </View>
  );
}

interface NdaFieldRowProps {
  /**
   * Libellé de la ligne. Il varie d'une pièce à l'autre (« NDA », « N°
   * déclaration activité (NDA) », « NDA organisme ») — on ne l'uniformise pas
   * ici, ce serait modifier onze documents légaux pour une question de style.
   */
  label?: string;
  /** Numéro de déclaration d'activité. Vide ⇒ la ligne entière est omise. */
  nda: string;
}

/** Ligne « NDA », omise tant que le numéro n'existe pas (L.6351-1 : dit en pied de page). */
export function NdaFieldRow({ label = "NDA", nda }: NdaFieldRowProps): React.ReactElement | null {
  const numero = typeof nda === "string" ? nda.trim() : "";
  if (numero === "") return null;
  return <FieldRow label={label} value={numero} />;
}

export type BulletVariant = "default" | "check" | "objective";

interface BulletListProps {
  items: string[];
  variant?: BulletVariant;
}

function bulletGlyph(variant: BulletVariant): { glyph: string; color: string } {
  switch (variant) {
    case "check":
      return { glyph: "✓", color: couleurPiece("sage") };
    case "objective":
      return { glyph: "→", color: couleurPiece("primary") };
    case "default":
    default:
      return { glyph: "•", color: couleurPiece("terracotta") };
  }
}

const bulletLocal = StyleSheet.create({
  row: {
    flexDirection: "row",
    marginBottom: S.xs,
    paddingLeft: S.sm,
  },
  glyph: {
    width: 12,
    fontSize: T.base,
    fontWeight: "bold",
  },
  text: {
    flex: 1,
    fontSize: T.base,
    color: couleurPiece("fg"),
    lineHeight: T.lineNormal,
  },
});

/**
 * Liste à puces normalisée (• terracotta par défaut, ✓ sage, → objectifs, terracotta dans la palette des pièces).
 * Remplace les `{items.map(i => <Text>• {i}</Text>)}` manuels dispersés.
 */
export function BulletList({ items, variant = "default" }: BulletListProps): React.ReactElement {
  const { glyph, color } = bulletGlyph(variant);
  return (
    <View>
      {items.map((item, i) => (
        // `wrap={false}` : une puce ne se coupe pas au saut de page (cf. base-layout.tsx).
        <View key={i} style={bulletLocal.row} wrap={false}>
          <Text style={[bulletLocal.glyph, { color }]}>{glyph}</Text>
          <Text style={bulletLocal.text}>{item}</Text>
        </View>
      ))}
    </View>
  );
}
