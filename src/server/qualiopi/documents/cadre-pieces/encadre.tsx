/**
 * Cadre RECOPIÉ NON signable (encadré) — copie de LegalCallout de base-layout.tsx,
 * couleurs via `couleurPiece` (palette définitive).
 * Ne remplace RIEN : les gabarits signables gardent base-layout.tsx.
 */
import React from "react";
import { Text, View } from "@react-pdf/renderer";
import {
  QUALIOPI_PDF_TYPE as T,
  QUALIOPI_PDF_SPACE as S,
} from "@/server/qualiopi/brand/brand-tokens";
import { couleurPiece } from "@/server/qualiopi/brand/jetons-pieces";

export type CalloutVariant = "info" | "warning" | "success" | "legal";

interface CalloutTheme {
  bg: string;
  border: string;
  title: string;
}

function calloutTheme(variant: CalloutVariant): CalloutTheme {
  switch (variant) {
    case "info":
      return {
        bg: couleurPiece("primary-soft"),
        border: couleurPiece("primary"),
        title: couleurPiece("primary-hover"),
      };
    case "warning":
      return {
        bg: couleurPiece("terracotta-soft"),
        border: couleurPiece("terracotta"),
        title: couleurPiece("terracotta-deep"),
      };
    case "success":
      return {
        bg: couleurPiece("sage-soft"),
        border: couleurPiece("sage"),
        title: couleurPiece("sage"),
      };
    case "legal":
    default:
      return {
        bg: couleurPiece("bg"),
        border: couleurPiece("border-strong"),
        title: couleurPiece("mocha"),
      };
  }
}

interface LegalCalloutProps {
  variant?: CalloutVariant;
  /** Titre optionnel (gras) en tête du callout. */
  title?: string;
  children: React.ReactNode;
}

/**
 * `true` si le nœud est purement textuel (string/number, ou tableau de tels —
 * ex. `["texte ", email, "."]`). Sert à envelopper automatiquement le contenu
 * dans un <Text> : @react-pdf rejette toute chaîne hors <Text> (texte perdu
 * silencieusement). Faux dès qu'un élément React est présent (déjà structuré).
 */
function estTextuel(node: React.ReactNode): boolean {
  if (typeof node === "string" || typeof node === "number") return true;
  if (Array.isArray(node)) return node.every((n) => estTextuel(n));
  return false;
}

/**
 * Encart mis en évidence (mention légale, avertissement, info, succès).
 * Bord gauche coloré + fond doux. Unifie les nombreux blocs ad hoc
 * (subrogation, RAC, durée certifiée, bannières d'attestation partielle…).
 */
export function LegalCallout({
  variant = "legal",
  title,
  children,
}: LegalCalloutProps): React.ReactElement {
  const theme = calloutTheme(variant);
  return (
    <View
      wrap={false}
      style={{
        backgroundColor: theme.bg,
        borderWidth: 1,
        borderColor: couleurPiece("border"),
        borderLeftWidth: 3,
        borderLeftColor: theme.border,
        borderRadius: S.radius,
        paddingVertical: S.lg,
        paddingHorizontal: S.xl,
        marginTop: S.lg,
      }}
    >
      {title ? (
        <Text
          style={{
            fontSize: T.sm,
            fontWeight: "bold",
            color: theme.title,
            marginBottom: S.xs,
          }}
        >
          {title}
        </Text>
      ) : null}
      {estTextuel(children) ? (
        <Text style={{ fontSize: T.sm, color: couleurPiece("fg"), lineHeight: T.lineNormal }}>
          {children}
        </Text>
      ) : (
        children
      )}
    </View>
  );
}
