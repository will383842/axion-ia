/**
 * Charte couleur presse — GÉNÉRÉE depuis `BRAND_PALETTE`, jamais figée.
 *
 * POURQUOI cette route existe : la page presse affichait les sept couleurs de
 * marque en pastilles, et `PressImages` prévoyait un bouton « télécharger la
 * charte » — qui ne pouvait JAMAIS apparaître, faute d'un asset de type
 * `color_charter`. Un journaliste voyait les couleurs à l'écran sans pouvoir
 * emporter le fichier : une promesse câblée dans l'interface, sans rien derrière.
 *
 * Le fichier est généré depuis la même constante que les pastilles, il ne peut
 * donc pas les contredire. C'est la leçon du boilerplate figé, qui annonçait
 * « fondé en 2024 » quand le JSON-LD publiait `foundingDate: 2026`.
 *
 * ⚠️ AUCUNE valeur CMJN n'est publiée. Convertir du sRGB en CMJN sans profil ICC
 * cible donne des nombres qui ONT L'AIR officiels et trompent l'imprimeur : la
 * conversion dépend du papier et du profil de sortie. On livre le HEX et le RGB,
 * qui sont exacts, et on renvoie explicitement le CMJN au prépresse.
 */

import { NextResponse } from "next/server";

import { BRAND_PALETTE } from "@/content/press";
import { SITE_URL } from "@/lib/seo";

export const dynamic = "force-dynamic";

const RULE = "=".repeat(77);
const PRESS_EMAIL = "presse@axion-ia.com";

/** "#RRGGBB" → "rgb(r, g, b)". Dérivé du HEX : aucune valeur recopiée. */
function hexToRgb(hex: string): string {
  const clean = hex.replace("#", "");
  const r = Number.parseInt(clean.slice(0, 2), 16);
  const g = Number.parseInt(clean.slice(2, 4), 16);
  const b = Number.parseInt(clean.slice(4, 6), 16);
  return `rgb(${r}, ${g}, ${b})`;
}

export function GET(): Response {
  const largeur = Math.max(...BRAND_PALETTE.map((c) => c.name.length));

  const lignes = BRAND_PALETTE.map(
    (c) => `${c.name.padEnd(largeur + 2)}${c.hex.toUpperCase().padEnd(10)}${hexToRgb(c.hex)}`,
  );

  const body = [
    "CHARTE COULEUR AXION-IA — usage libre pour publication (presse, articles)",
    RULE,
    "",
    ...lignes,
    "",
    RULE,
    "",
    "CMJN : à dériver au prépresse selon le profil de sortie visé. Aucune valeur",
    "CMJN n'est publiée ici — une conversion sans profil ICC dépend du papier et",
    "trompe plus qu'elle n'aide.",
    "",
    "Ces codes sont les couleurs officielles de la marque Axion-IA. Attribution",
    "souhaitée : « Axion-IA ».",
    "",
    `Contact presse : ${PRESS_EMAIL}`,
    `Site : ${SITE_URL}`,
    "",
  ].join("\n");

  return new NextResponse(body, {
    status: 200,
    headers: {
      "Content-Type": "text/plain; charset=utf-8",
      "Content-Disposition": 'attachment; filename="axion-ia-charte-couleur.txt"',
      // 1 h : aligné sur l'ISR de /presse, comme le boilerplate.
      "Cache-Control": "public, max-age=3600",
    },
  });
}
