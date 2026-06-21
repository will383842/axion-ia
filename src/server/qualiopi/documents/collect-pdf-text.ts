/**
 * Qualiopi — Utilitaire de TEST : extraction du texte d'un arbre de document PDF.
 *
 * Pourquoi : les `.spec` historiques ne vérifiaient QUE « le buffer commence par
 * %PDF » — une mention légale omise passait les tests. @react-pdf compresse les
 * streams, l'extraction depuis le binaire est fragile et coûteuse (dépendance
 * pdf-parse). À la place, on parcourt l'arbre React AVANT rendu : les primitives
 * @react-pdf sont des hôtes typés par chaîne ("TEXT"/"VIEW"/…), nos composants
 * (QualiopiPage, FieldRow, DataTable, LegalCallout…) sont des fonctions PURES
 * (aucun hook) → on les invoque directement et on concatène tout le texte.
 *
 * ⚠️ RÉSERVÉ AUX TESTS. N'est importé par aucun code de production.
 */

import React from "react";

/**
 * Concatène récursivement tout le texte d'un `ReactNode` d'un document
 * @react-pdf. Invoque les composants-fonctions purs ; descend dans les hôtes
 * (chaînes). Ignore les `Text render={fn}` dynamiques (n° de page).
 */
export function collectPdfText(node: React.ReactNode): string {
  if (node === null || node === undefined || typeof node === "boolean") return "";
  if (typeof node === "string") return node;
  if (typeof node === "number") return String(node);
  if (Array.isArray(node)) return node.map(collectPdfText).join(" ");

  if (React.isValidElement(node)) {
    const element = node as React.ReactElement<Record<string, unknown>>;
    const type = element.type;

    // Composant-fonction pur (les nôtres) → on l'invoque pour obtenir son rendu.
    if (typeof type === "function") {
      const rendered = (type as (props: unknown) => React.ReactNode)(element.props);
      return collectPdfText(rendered);
    }

    // Hôte @react-pdf (type = "DOCUMENT"/"PAGE"/"VIEW"/"TEXT"/…) → descend.
    return collectPdfText(element.props.children as React.ReactNode);
  }

  return "";
}

/**
 * Assertion-friendly : retourne le texte normalisé (espaces compressés) pour
 * des `expect(text).toContain(...)` robustes aux retours à la ligne.
 */
export function collectPdfTextNormalized(node: React.ReactNode): string {
  return collectPdfText(node).replace(/\s+/g, " ").trim();
}
