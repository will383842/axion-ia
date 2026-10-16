// Fragment d'accusé de réception — « N pièce(s) jointe(s) bien reçue(s) »
// (2026-10-15). Partagé par les quatre accusés du formulaire de contact
// unifié ; ne rend RIEN quand la demande est arrivée sans fichier.

import { Text } from "@react-email/components";
import { emailStyles } from "./_layout";
import type { Locale } from "../../../../prisma/generated/client";

/** La phrase, exportée pour les tests et l'aperçu. */
export function phrasePiecesJointesRecues(locale: Locale, n: number): string {
  if (locale === "en") return n > 1 ? `${n} attachments received.` : "1 attachment received.";
  return n > 1 ? `${n} pièces jointes bien reçues.` : "1 pièce jointe bien reçue.";
}

export function PiecesJointesRecues({
  locale,
  payload,
}: {
  locale: Locale;
  payload: Record<string, unknown>;
}) {
  const n = payload["piecesJointesRecues"];
  if (typeof n !== "number" || !Number.isInteger(n) || n <= 0) return null;
  return <Text style={emailStyles.paragraphStyle}>{phrasePiecesJointesRecues(locale, n)}</Text>;
}
