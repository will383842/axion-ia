/**
 * Traduction des 21 jetons de `QualiopiBrandColorToken` vers la palette définitive
 * des pièces (`COULEURS_PIECES`). Sert le cadre recopié NON signable
 * (`cadre-pieces/`) : les gabarits signables gardent leur palette gelée.
 *
 * 🟠 À CONFIRMER par Williams (jetons sans équivalent direct) :
 *  - tons doux (`terracotta-soft`, `primary-soft`, `sage-soft`, `sand-deep`) → gris chaud ;
 *  - `terracotta-deep` et `primary` (ex-bleu) → terracotta ;
 *  - `border-strong` → gris moyen ; `mocha-soft` → noir ; `primary-hover` → terracotta.
 *  - `sage` = vert réussite #5E7050 : GARDÉ par décision de Williams le 08/11/2026.
 */
import { COULEURS_PIECES as P } from "@/lib/brand/couleurs-pieces";
import type { QualiopiBrandColorToken } from "@/server/qualiopi/brand/brand-tokens";

export const JETONS_PIECES = Object.freeze({
  bg: P.ivoire,
  paper: P.blanc,
  sand: P["gris-chaud"],
  "sand-deep": P["gris-chaud"],
  mocha: P.noir,
  "mocha-soft": P.noir,
  "mocha-fg": P.ivoire,
  fg: P.noir,
  "fg-soft": P["texte-secondaire"],
  "fg-muted": P["texte-secondaire"],
  primary: P.terracotta,
  "primary-hover": P.terracotta,
  "primary-fg": P.blanc,
  "primary-soft": P["gris-chaud"],
  terracotta: P.terracotta,
  "terracotta-soft": P["gris-chaud"],
  "terracotta-deep": P.terracotta,
  sage: P.reussite,
  "sage-soft": P["gris-chaud"],
  border: P["gris-chaud"],
  "border-strong": P["gris-moyen"],
} as const satisfies Record<QualiopiBrandColorToken, string>);

export function couleurPiece(jeton: QualiopiBrandColorToken): string {
  return JETONS_PIECES[jeton];
}
