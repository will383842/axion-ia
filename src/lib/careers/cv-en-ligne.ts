/**
 * LE CV LISIBLE SUR PLACE (Candidatures unifiées L8c) — module PUR.
 *
 * Les routes de CV servaient TOUJOURS un téléchargement neutre
 * (`application/octet-stream`, `attachment`) : on ne fait pas confiance au type
 * déclaré par la personne au dépôt. « Lire ici » (`?lire=1`) ouvre le CV dans
 * le navigateur, mais seulement quand le CONTENU est un PDF (signature
 * `%PDF-` lue dans les octets, jamais le type déclaré) : il part alors en
 * `application/pdf`, `inline`, `nosniff` — un fichier HTML déguisé reste un
 * téléchargement neutre. Même en-têtes que le contrat apporteur, déjà servi
 * ainsi (`apporteurs/[id]/contrat/route.ts`).
 *
 * Les dispositions passent par le SSOT `lib/content-disposition.ts`
 * (`CONSULTATION` / `ENREGISTREMENT`), comme toute route qui sert un PDF.
 */

import { CONSULTATION, ENREGISTREMENT, enTeteContentDisposition } from "@/lib/content-disposition";

/** Le contenu commence-t-il par la signature d'un PDF ? */
export function estPdf(octets: Uint8Array): boolean {
  const sig = [0x25, 0x50, 0x44, 0x46, 0x2d]; // %PDF-
  return octets.length >= sig.length && sig.every((b, i) => octets[i] === b);
}

/** Les en-têtes de la réponse, pour un nom déjà assaini. */
export function entetesCv(
  nomSur: string,
  lire: boolean,
  octets: Uint8Array,
): Record<string, string> {
  const commun = { "X-Content-Type-Options": "nosniff", "Cache-Control": "private, no-store" };
  if (lire && estPdf(octets)) {
    return {
      ...commun,
      "Content-Type": "application/pdf",
      "Content-Disposition": enTeteContentDisposition(CONSULTATION, nomSur),
    };
  }
  return {
    ...commun,
    "Content-Type": "application/octet-stream",
    "Content-Disposition": enTeteContentDisposition(ENREGISTREMENT, nomSur),
  };
}
