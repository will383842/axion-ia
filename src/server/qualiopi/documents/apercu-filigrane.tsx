/**
 * Qualiopi — Filigrane « APERÇU » posé AUTOUR d'un document @react-pdf déjà
 * construit, sans toucher au gabarit (un gabarit modifié doit être archivé en
 * nouvelle version). Le texte est `fixed` : répété sur chaque page.
 */

import React from "react";
import { Text, StyleSheet } from "@react-pdf/renderer";
import { brandColor, QUALIOPI_BRAND_FONTS } from "@/server/qualiopi/brand/brand-tokens";

const styles = StyleSheet.create({
  filigrane: {
    position: "absolute",
    top: "40%",
    left: 0,
    right: 0,
    textAlign: "center",
    fontSize: 80,
    color: brandColor("terracotta"),
    opacity: 0.16,
    transform: "rotate(-45deg)",
    fontFamily: QUALIOPI_BRAND_FONTS.serif,
    fontWeight: "bold",
  },
});

/**
 * @param document élément racine rendu par un gabarit (`<Document><Page…/></Document>`).
 * @returns le même arbre, avec le filigrane ajouté en tête de chaque enfant direct.
 */
export function avecFiligraneApercu(document: React.ReactElement): React.ReactElement {
  const props = document.props as { children?: React.ReactNode };
  const enfants = React.Children.map(props.children, (enfant) => {
    if (!React.isValidElement(enfant)) return enfant;
    const el = enfant as React.ReactElement<{ children?: React.ReactNode }>;
    return React.cloneElement(
      el,
      undefined,
      <Text key="filigrane-apercu" style={styles.filigrane} fixed>
        APERÇU
      </Text>,
      el.props.children,
    );
  });
  return React.cloneElement(document, undefined, enfants);
}
