// Réponses HTML STATIQUES de la page « Recevoir le guide » (lot S2) : erreur de saisie et merci.
//
// Pourquoi une réponse de ROUTE plutôt qu'une page React : une page App Router embarque le socle
// Next/React côté navigateur (≈ 185 Ko gz mesurés sur `/guide-reseau`), même sans une ligne de
// JavaScript applicatif. Ces deux écrans n'ont besoin que de texte et d'un lien : une chaîne HTML,
// zéro octet de JavaScript. Aucune donnée saisie n'y est répétée.
import { NextResponse } from "next/server";
import { TEXTES_PAGE_GUIDE as T } from "./textes";

export const ENTETES_PAGE_GUIDE = {
  "Cache-Control": "no-store",
  "Referrer-Policy": "no-referrer",
} as const;

export const echapper = (s: string): string =>
  s.replace(/[&<>"']/g, (c) => `&#${c.charCodeAt(0)};`);

/** Document HTML complet, sans script ; `corps` est du HTML DÉJÀ échappé par l'appelant. */
export function pageStatique(titre: string, corps: string, statut: number): NextResponse {
  const html = `<!doctype html><html lang="fr"><head><meta charset="utf-8"><meta name="viewport" content="width=device-width,initial-scale=1"><meta name="robots" content="noindex,nofollow,noarchive"><meta name="referrer" content="no-referrer"><title>${echapper(titre)} — ${echapper(T.marque)}</title></head><body style="font-family:system-ui,sans-serif;max-width:36rem;margin:2rem auto;padding:0 1.25rem"><h1 style="font-size:1.5rem">${echapper(titre)}</h1>${corps}</body></html>`;
  return new NextResponse(html, {
    status: statut,
    headers: { ...ENTETES_PAGE_GUIDE, "Content-Type": "text/html; charset=utf-8" },
  });
}
