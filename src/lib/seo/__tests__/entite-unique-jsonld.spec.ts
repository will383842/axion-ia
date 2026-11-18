// @vitest-environment node
/**
 * V1-11 — UNE SEULE entité Organization dans le JSON-LD du site.
 *
 * Garde : (1) une seule définition COMPLÈTE de l'Organization (`seo.ts`) ; tout autre nœud
 * `Organization` d'Axion-IA ne fait que la citer par son `@id` ; (2) une seule liste `sameAs`
 * (`ORGANIZATION_SAME_AS`), reprise telle quelle partout, avec la chaîne YouTube et un seul
 * compte X ; (3) plus de commentaire « Grenoble » autour de F6S dans `seo.ts`.
 */
import { readFileSync, readdirSync, statSync } from "node:fs";
import { join, relative } from "node:path";
import { describe, expect, it } from "vitest";

import { buildOrganizationJsonLd, ORGANIZATION_SAME_AS } from "@/lib/seo";

const RACINE = process.cwd();

function fichiersSource(dossier: string, sortie: string[] = []): string[] {
  for (const nom of readdirSync(dossier)) {
    const chemin = join(dossier, nom);
    if (statSync(chemin).isDirectory()) {
      if (nom === "__tests__" || nom === "node_modules" || nom === "keywords") continue;
      fichiersSource(chemin, sortie);
    } else if (/\.(ts|tsx)$/.test(nom) && !/\.(spec|test)\.(ts|tsx)$/.test(nom)) {
      sortie.push(chemin);
    }
  }
  return sortie;
}

const SOURCES = fichiersSource(join(RACINE, "src")).map((f) => ({
  rel: relative(RACINE, f).replaceAll("\\", "/"),
  texte: readFileSync(f, "utf8"),
}));

/** Tiers décrits comme `Organization` (fournisseurs, détenteurs de droits) : pas Axion-IA. */
const TIERS_AUTORISES = new Set([
  "src/app/[locale]/sous-processeurs/page.tsx",
  "src/app/[locale]/stack-ia/page.tsx",
  "src/server/image-bank/services/image-seo.service.ts",
  "src/server/reviews/jsonld.ts", // `ItemReviewed.type` (libellé de type, pas un nœud)
  "src/components/knowledge/public/AuthorByline.tsx",
]);

describe("V1-11 — une seule fiche Organization", () => {
  it("tout nœud Organization d'Axion-IA porte l'@id unique, sauf les tiers connus", () => {
    const fautes: string[] = [];
    for (const { rel, texte } of SOURCES) {
      const lignes = texte.split("\n");
      lignes.forEach((l, i) => {
        if (!/["']@type["']:\s*["']Organization["']/.test(l)) return;
        const voisinage = lignes.slice(Math.max(0, i - 3), i + 4).join("\n");
        // Émetteur d'une certification / éditeur vidéo passé en paramètre : un tiers, pas Axion-IA.
        const tiers = /qualiopiCertification\.issuer|input\.publisherName/.test(voisinage);
        const porteId =
          tiers || /#organization|ORG_ID|organizationId|ORGANIZATION_ID/.test(voisinage);
        if (!porteId && !TIERS_AUTORISES.has(rel)) fautes.push(`${rel}:${i + 1}`);
      });
    }
    expect(fautes).toEqual([]);
  });

  it("une seule définition complète : `legalName` + `foundingDate` + `founder` dans seo.ts seul", () => {
    const completes = SOURCES.filter(
      ({ texte }) =>
        /"@type":\s*"Organization"/.test(texte) &&
        /legalName:/.test(texte) &&
        /foundingDate:/.test(texte) &&
        /founder:/.test(texte),
    ).map((s) => s.rel);
    expect(completes).toEqual(["src/lib/seo.ts"]);
  });

  it("les fiches qui citent l'Organization ne la redéfinissent pas sans @id (comparaisons, avis)", () => {
    const comparaisons = SOURCES.find((s) => s.rel.includes("comparaisons/[slug]/page.tsx"))!;
    expect(comparaisons.texte).not.toMatch(/publisher: \{ "@type": "Organization"/);
    const avis = SOURCES.find((s) => s.rel === "src/server/reviews/jsonld.ts")!;
    expect(avis.texte).not.toMatch(/provider: \{ "@type": "Organization"/);
  });
});

describe("V1-11 — des sameAs identiques partout", () => {
  it("la liste unique contient YouTube et UN seul compte X", () => {
    expect(ORGANIZATION_SAME_AS).toContain("https://www.youtube.com/@Axion-IA-com");
    const x = ORGANIZATION_SAME_AS.filter((u) => /(^https:\/\/(x|twitter)\.com\/)/.test(u));
    expect(x).toEqual(["https://x.com/AxionIAFrance"]);
    expect(new Set(ORGANIZATION_SAME_AS).size).toBe(ORGANIZATION_SAME_AS.length);
  });

  it("le nœud Organization du layout reprend la liste telle quelle", () => {
    const org = buildOrganizationJsonLd({ locale: "fr" }) as unknown as { sameAs: string[] };
    for (const url of ORGANIZATION_SAME_AS) expect(org.sameAs).toContain(url);
  });

  it("aucun autre compte X ni liste sameAs divergente dans les sources", () => {
    const fautes: string[] = [];
    for (const { rel, texte } of SOURCES) {
      if (/x\.com\/AxionIA(?!France)/.test(texte)) fautes.push(`${rel} : compte X divergent`);
      if (rel !== "src/lib/seo.ts" && /youtube\.com\/@Axion-IA-com/.test(texte)) {
        if (!/ORGANIZATION_SAME_AS/.test(texte) && /sameAs/.test(texte))
          fautes.push(`${rel} : YouTube en dur dans un sameAs`);
      }
    }
    expect(fautes).toEqual([]);
  });

  it("JSON-LD de l'image-bank, des offres d'emploi et de la presse utilisent la liste unique", () => {
    for (const rel of [
      "src/server/image-bank/services/image-jsonld-graph.service.ts",
      "src/lib/seo/job-posting.ts",
      "src/app/[locale]/presse/page.tsx",
    ]) {
      const { texte } = SOURCES.find((s) => s.rel === rel)!;
      expect(texte, rel).toContain("ORGANIZATION_SAME_AS");
    }
  });
});

describe("V1-11 — seo.ts", () => {
  it("ne mentionne plus Grenoble autour de F6S", () => {
    const seo = SOURCES.find((s) => s.rel === "src/lib/seo.ts")!.texte;
    const debut = seo.indexOf("export const ORGANIZATION_SAME_AS");
    const bloc = seo.slice(Math.max(0, debut - 500), debut + 600);
    expect(bloc).toContain("F6S");
    expect(bloc).not.toMatch(/Grenoble/i);
    expect(seo).not.toMatch(/localisation Grenoble/i);
  });
});
