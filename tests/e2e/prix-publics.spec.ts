// R7 — ordre de Williams du 08/11/2026 : « il ne faut plus de prix affichés pour les
// formations, les audits ou autres. La seule chose à mettre en avant est la journée audit à
// 1 490 €. TOUT LE RESTE, IL NE FAUT PLUS RIEN AFFICHER NULLE PART. »
//
// Garde sur le HTML RENDU (serveur) des pages publiques stratégiques et des canaux machine :
// texte visible, balises meta, JSON-LD et charge RSC compris. Les gardes unitaires du lot R7
// verrouillent chaque couche (interrupteur `pricing.ts`, jetons de prose, pages, JSON-LD,
// llms, chatbot) ; celle-ci est le filet de bout en bout.
//
// ⚠️ Rouge tant que les PR fix/prix-* ne sont pas toutes fusionnées : à fusionner EN DERNIER.
// Tour France IA (`/tour-france-ia`) : hors périmètre (chantier séparé, événement daté).

import { expect, test } from "@playwright/test";

/** Pages publiques et canaux machine contrôlés. */
const URLS = [
  "/fr",
  "/fr/tarifs",
  "/fr/formations",
  "/fr/audit",
  "/fr/audit/cible",
  "/fr/un-a-un",
  "/fr/un-a-un/par-ville/lyon",
  "/fr/implementation",
  "/fr/implantations/auvergne-rhone-alpes/lyon",
  "/fr/comparaisons",
  "/fr/a-propos",
  "/fr/faq",
  "/llms.txt",
  "/llms-full.txt",
  "/fr/faq/feed.xml",
] as const;

/**
 * Ramène les espaces insécables, entités HTML et échappements JSON (charge RSC, JSON-LD) à
 * une forme simple, pour que la détection reste LINÉAIRE : une version précédente à
 * quantificateurs optionnels imbriqués backtrackait sans fin sur 650 Ko de HTML.
 */
function normaliser(corps: string): string {
  return corps
    .replace(
      /&nbsp;|&#160;|&#x202f;|&#xa0;|&#8239;|&#8201;|&thinsp;|&#x2009;|\\+u00a0|\\+u202f|\\+u2009| | | /gi,
      " ",
    )
    .replace(/&euro;|\\+u20ac/gi, "€");
}

/** La Journée IA : seul montant permis. */
const JOURNEE = /(?<!\d ?)1 ?490(?! ?\d) ?(?:€|EUR\b)/g;

/**
 * Chiffres en euros qui ne sont PAS un prix d'Axion-IA, retirés avant la recherche :
 * - un gain annoncé « X k€ à Y M€ par an » (sujet des gains chiffrés, hors R7) ;
 * - les tranches de budget du formulaire de diagnostic (« < 1 000 € », « 1-5 k€ »…),
 *   saisies par le visiteur ;
 * - un volume annuel côté client (« 200 k€ de projets/an », « 500 k€/an ») ;
 * - le seuil de 5 000 € HT des conditions de paiement (CGV) — sujet « paiement visible »
 *   de l'audit d'harmonie (Z2-06/07), pas un prix.
 */
const HORS_SUJET = [
  /(?<![\d.,])\d[\d.,]* ?[kM]€(?: ?(?:à|-|–) ?\d[\d.,]* ?[kM]€)? par an/g,
  /(?<![\d.,])\d[\d.,]* ?[kM]€(?: de projets)?\/an/g,
  /(?:inférieure? à|&gt;|>|\\u003e) 5 000 € HT/g,
  /\{[^{}]*lt_1k[^{}]*\}/g,
];

/** Un montant en euros : « 1 900 € », « 790 € HT », « 2 k€ », « 1 M€ », « €490 ». */
const MONTANT =
  /(?<![\d.,]|\d )\d[\d.,]*(?: \d[\d.,]*)* ?[kM]?(?:€|EUR\b|[Ee]uros?\b)|(?:€|EUR) ?\d|\\?"(?:price|lowPrice|highPrice|minPrice|maxPrice)\\?" ?: ?\\?"?(?!1490\b|0\b)\d|product:price:amount/g;

/**
 * EXCEPTION ÉTROITE ET JUSTIFIÉE — exemple de calcul (maquette v4 validée par Williams).
 * La phrase « Exemple type : 6 h de relances par semaine, à 35 € de l'heure, sur 45 semaines
 * travaillées, c'est 9 450 € de temps payé chaque année » (accueil, bloc « Exemple type » ;
 * Journée IA, carte des gains et bloc « Le calcul ») est un calcul de temps perdu côté
 * ENTREPRISE CLIENTE (6 h × 45 sem. × 35 €/h, cf. `EXEMPLE_TYPE` dans
 * `src/content/journee-ia-commun.ts`) : ce n'est le tarif d'aucune offre d'Axion-IA.
 * Ne sont exemptés que ces deux montants exacts, et seulement sur `/fr` et `/fr/journee-ia`
 * (« 9 450 € » seulement s'il est suivi, dans les 2 500 caractères, de « de temps payé » : le montant est dans un badge, la légende vient après le balisage). Tout autre montant reste interdit.
 */
const URLS_EXEMPLE_DE_CALCUL = new Set(["/fr", "/fr/journee-ia"]);
const EXEMPLE_DE_CALCUL = [
  /(?<![\d.,])35 € de l(?:’|'|&#x27;|&#39;|\\+u2019)heure/g,
  /(?<![\d.,])9 450 €/g,
];

function montantsInterdits(corps: string, url?: string): string[] {
  let t = normaliser(corps).replace(JOURNEE, "");
  for (const r of HORS_SUJET) t = t.replace(r, "");
  // « 9 450 € » n'est exempté que si la page porte bien la légende « de temps pay… » (le « é »
  // peut être échappé dans le flux RSC : on ne teste donc que le préfixe).
  if (url && URLS_EXEMPLE_DE_CALCUL.has(url) && /de temps pay/.test(t)) {
    for (const r of EXEMPLE_DE_CALCUL) t = t.replace(r, "");
  }
  return [...t.matchAll(MONTANT)].map((m) =>
    t.slice(Math.max(0, m.index - 60), m.index + m[0].length + 20).replace(/\s+/g, " "),
  );
}

test.describe("R7 — aucun prix public sauf la Journée IA", () => {
  // Budget de la suite > délai de chaque requête (60 s) : le délai de la requête peut expirer
  // et nommer l'URL lente, au lieu d'un dépassement de budget muet.
  test.describe.configure({ timeout: 90_000 });

  for (const url of URLS) {
    test(`${url} n'affiche aucun montant hors Journée IA`, async ({ request }) => {
      const res = await request.get(url, { maxRedirects: 5, timeout: 60_000 });
      expect(res.status(), url).toBeLessThan(400);
      // Une route supprimée qui redirige vers /fr passerait en vert sans rien vérifier.
      expect(new URL(res.url()).pathname, url).toBe(url);
      const corps = await res.text();
      expect(montantsInterdits(corps, url), url).toEqual([]);
    });
  }

  test("/fr/journee-ia affiche bien 1 490 € HT, et aucun autre montant", async ({ request }) => {
    const res = await request.get("/fr/journee-ia", { timeout: 60_000 });
    expect(res.status()).toBeLessThan(400);
    const corps = await res.text();
    expect(normaliser(corps)).toMatch(/(?<!\d ?)1 490 € HT/);
    expect(montantsInterdits(corps, "/fr/journee-ia")).toEqual([]);
  });
});
