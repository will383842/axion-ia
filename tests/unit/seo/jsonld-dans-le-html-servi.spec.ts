// @vitest-environment node
/**
 * Verrou I1 (audit SEO indépendant du 2026-11-11) — les données structurées
 * doivent être DANS le HTML servi.
 *
 * ## Le défaut mesuré
 *
 * 42 appels `<JsonLd strategy="afterInteractive">` (audit, secteurs, centre
 * d'aide, stack IA, implémentation…) passaient par `next/script` : le
 * `<script type="application/ld+json">` n'était injecté qu'APRÈS l'hydratation.
 * Le HTML reçu par un robot qui n'exécute pas le JavaScript (GPTBot, ClaudeBot,
 * PerplexityBot, et Googlebot à sa première passe) ne contenait donc pas les
 * FAQPage, ItemList, QAPage, HowTo… que la page croyait déclarer.
 *
 * Le gain qui justifiait ce report (« −100 à −200 ms de TBT ») ne tient pas : un
 * `<script type="application/ld+json">` n'est ni analysé ni exécuté par le
 * navigateur, il ne coûte que ses octets de HTML.
 *
 * ## Ce que le verrou interdit
 *
 * Toute stratégie différée (`afterInteractive`, `lazyOnload`) sur `<JsonLd>`,
 * `<JsonLdGraph>` ou un `<Script type="application/ld+json">`, partout dans
 * `src/`, hors des exceptions listées ci-dessous.
 */

import { readFileSync, readdirSync, statSync } from "node:fs";
import { join, relative, sep } from "node:path";
import { describe, expect, it } from "vitest";

const RACINE = join(__dirname, "..", "..", "..");
const SRC = join(RACINE, "src");

/**
 * Exceptions — chantiers tenus par d'AUTRES sessions, à ne pas éditer ici.
 * Chacune doit disparaître quand son chantier aura repassé ses JSON-LD en ligne.
 */
const EXCEPTIONS: ReadonlyArray<{ prefixe: string; raison: string }> = [
  { prefixe: "src/app/[locale]/implantations/", raison: "chantier villes/régions" },
  { prefixe: "src/components/ville/", raison: "chantier villes/régions" },
  {
    prefixe: "src/components/sections/VilleServicePageTemplate.tsx",
    raison: "gabarit des pages ville × service (chantier villes/régions)",
  },
  { prefixe: "src/app/[locale]/audit/", raison: "chantier audit/formations/tarifs" },
  { prefixe: "src/components/services/audit/", raison: "chantier audit/formations/tarifs" },
];

const STRATEGIE_DIFFEREE = /strategy\s*=\s*(?:"|'|\{\s*["'])(afterInteractive|lazyOnload)/;

function fichiersSources(dossier: string): string[] {
  const sortie: string[] = [];
  for (const nom of readdirSync(dossier)) {
    const chemin = join(dossier, nom);
    if (statSync(chemin).isDirectory()) {
      if (nom === "node_modules" || nom === "generated") continue;
      sortie.push(...fichiersSources(chemin));
    } else if (/\.(tsx?|jsx?)$/.test(nom) && !/\.(test|spec)\.[jt]sx?$/.test(nom)) {
      sortie.push(chemin);
    }
  }
  return sortie;
}

/** Les balises JSON-LD d'un fichier qui portent une stratégie différée. */
function balisesJsonLdDifferees(brut: string): string[] {
  // Commentaires retirés (blocs, JSX `{/* */}`, lignes `//` et ` * `) : la doc
  // des composants cite `<Script>` et `afterInteractive` sans en émettre.
  const source = brut
    .replace(/\/\*[\s\S]*?\*\//g, "")
    .replace(/^\s*\/\/.*$/gm, "")
    .replace(/^\s*\*.*$/gm, "");
  const fautives: string[] = [];
  const motifs = [/<JsonLd(?:Graph)?\b[\s\S]*?\/>/g, /<Script\b[\s\S]*?(?:\/>|<\/Script>)/g];
  for (const motif of motifs) {
    for (const m of source.matchAll(motif)) {
      const balise = m[0];
      const estJsonLd = balise.startsWith("<JsonLd") || balise.includes("application/ld+json");
      if (estJsonLd && STRATEGIE_DIFFEREE.test(balise)) fautives.push(balise.slice(0, 80));
    }
  }
  return fautives;
}

function cheminRelatif(absolu: string): string {
  return relative(RACINE, absolu).split(sep).join("/");
}

describe("JSON-LD rendu dans le HTML servi (audit SEO 2026-11-11, I1)", () => {
  it("le détecteur reconnaît une balise différée (témoin positif)", () => {
    expect(
      balisesJsonLdDifferees(`<JsonLd data={x} strategy="afterInteractive" scriptId="a" />`),
    ).toHaveLength(1);
    expect(
      balisesJsonLdDifferees(
        `<Script id="x" type="application/ld+json" strategy="lazyOnload" dangerouslySetInnerHTML={{ __html: j }} />`,
      ),
    ).toHaveLength(1);
    expect(
      balisesJsonLdDifferees(`<JsonLdGraph schemas={[a]}\n  strategy={"afterInteractive"}\n/>`),
    ).toHaveLength(1);
  });

  it("le détecteur ignore les scripts tiers et le JSON-LD en ligne (témoin négatif)", () => {
    expect(balisesJsonLdDifferees(`<Script src="/p.js" strategy="afterInteractive" />`)).toEqual(
      [],
    );
    expect(balisesJsonLdDifferees(`<JsonLd data={x} scriptId="a" />`)).toEqual([]);
  });

  it("aucun JSON-LD différé dans src/ hors exceptions listées", () => {
    const fautes: string[] = [];
    for (const fichier of fichiersSources(SRC)) {
      const rel = cheminRelatif(fichier);
      if (EXCEPTIONS.some((e) => rel.startsWith(e.prefixe))) continue;
      const source = readFileSync(fichier, "utf8");
      if (!source.includes("afterInteractive") && !source.includes("lazyOnload")) continue;
      for (const balise of balisesJsonLdDifferees(source)) fautes.push(`${rel} → ${balise}`);
    }
    expect(fautes, fautes.join("\n")).toEqual([]);
  });
});
