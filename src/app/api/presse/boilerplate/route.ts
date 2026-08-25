/**
 * Boilerplate presse FR + EN — GÉNÉRÉ, jamais figé.
 *
 * POURQUOI cette route existe : le kit presse servait `/press/axion-ia-boilerplate-fr-en.txt`,
 * un fichier statique recopié à la main depuis `PRESS_PITCH`. Les deux ont divergé —
 * le TXT annonçait « Axion-IA … fondé en 2024 » alors que `buildOrganizationJsonLd`
 * publie `foundingDate: "2026"` et que la société est immatriculée au RCS Grenoble
 * depuis le 30/07/2026. C'est précisément le document que les journalistes
 * copient-collent sans vérifier : une divergence y coûte un article faux.
 *
 * Le texte descriptif vient donc de `PRESS_PITCH[locale].boilerplate` (SSOT
 * éditoriale) et l'identité légale de `resolveLegalIdentity()` (SSOT partagée avec
 * les mentions légales et les factures). Aucune valeur n'est recopiée ici.
 *
 * Note : l'année de fondation N'EST PAS exposée — décision Will 2026-06-23,
 * cf. le commentaire de `PRESS_PITCH` dans `src/content/press.ts`.
 */

import { NextResponse } from "next/server";

import { PRESS_PITCH } from "@/content/press";
import { resolveLegalIdentity } from "@/lib/legal-identity";
import { SITE_URL } from "@/lib/seo";

export const dynamic = "force-dynamic";

const RULE = "=".repeat(77);
const PRESS_EMAIL = "presse@axion-ia.com";

/** Wrappe un paragraphe à 78 colonnes (lisible en TXT brut, comme une dépêche). */
function wrap(text: string, width = 78): string {
  const lines: string[] = [];
  let current = "";
  for (const word of text.split(/\s+/)) {
    if (current.length === 0) {
      current = word;
    } else if (current.length + 1 + word.length <= width) {
      current += ` ${word}`;
    } else {
      lines.push(current);
      current = word;
    }
  }
  if (current.length > 0) lines.push(current);
  return lines.join("\n");
}

export async function GET(): Promise<Response> {
  const legal = await resolveLegalIdentity();

  // Lignes d'identité : chacune n'apparaît que si la valeur est réellement
  // renseignée en base. Une mention légale absente ne doit jamais sortir sous
  // forme de libellé vide dans un document que la presse republie.
  const identityLines: string[] = [`Dénomination sociale : ${legal.legalName}`];
  if (legal.rcsVille && legal.siren) {
    identityLines.push(`Immatriculation : RCS ${legal.rcsVille} — SIREN ${legal.siren}`);
  } else if (legal.siren) {
    identityLines.push(`SIREN : ${legal.siren}`);
  }
  if (legal.addressSiege) identityLines.push(`Siège social : ${legal.addressSiege}`);
  identityLines.push(`Direction : ${legal.directorName}, ${legal.directorTitle}`);

  const body = [
    "BOILERPLATE AXION-IA — usage libre pour publication (presse, articles, dépêches)",
    RULE,
    "",
    "--- FRANÇAIS ---",
    "",
    wrap(PRESS_PITCH.fr.boilerplate),
    "",
    "--- ENGLISH ---",
    "",
    wrap(PRESS_PITCH.en.boilerplate),
    "",
    "--- IDENTITÉ / LEGAL ENTITY ---",
    "",
    ...identityLines,
    "",
    `Contact presse / Press contact : ${PRESS_EMAIL}`,
    `Site : ${SITE_URL}`,
    "",
    RULE,
    "Licence : texte libre de droits pour citation et reproduction presse.",
    "Attribution souhaitée : « Axion-IA » ou « cabinet IA Axion-IA ».",
    "",
  ].join("\n");

  return new NextResponse(body, {
    status: 200,
    headers: {
      "Content-Type": "text/plain; charset=utf-8",
      "Content-Disposition": 'attachment; filename="axion-ia-boilerplate-fr-en.txt"',
      // 1 h : aligné sur l'ISR de /presse. L'identité légale change au rythme
      // d'un Kbis, pas d'une requête.
      "Cache-Control": "public, max-age=3600",
    },
  });
}
