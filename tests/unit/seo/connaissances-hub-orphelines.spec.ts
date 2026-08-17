// @vitest-environment node
//
// Environnement `node` : lecture de fichiers du dépôt.

/**
 * Verrou GEO-088 — le hub `/connaissances` était orphelin de 459 fiches.
 *
 * ## Ce qui a été mesuré en production le 2026-08-16, à l'unité
 *
 *   sitemap-knowledge.xml                        → 507 URLs
 *   curl /fr/connaissances | grep href=".../…"   →  48 liens
 *
 * Le hub listait `take: 48`. Les 459 autres fiches étaient **déclarées à Google
 * sans qu'aucun lien interne n'y mène**.
 *
 * C'est le pire des deux mondes : le sitemap dit « ces pages comptent »,
 * l'architecture du site dit le contraire. Le moteur les met en file et n'y
 * trouve aucun signal d'importance.
 *
 * ## Les trois pièces indissociables
 *
 * Paginer ne suffit pas — et paginer MAL est pire que ne rien faire :
 *
 *   1. **Le pré-rendu.** Un segment dynamique absent du manifeste n'est pas
 *      servi en ISR mais entièrement dynamiquement (`private, no-store`,
 *      `cf BYPASS`) : chaque passage de robot traverse l'origine. Mesuré sur
 *      `/blog/page/2` le 2026-08-16 (GEO-061).
 *   2. **L'exception de build.** Le build tourne sous les URLs stub : la base
 *      rend 0, `totalPages` vaut 1, et chaque page ≥ 2 partirait en
 *      `notFound()`. On figerait des **404 statiques** là où il y avait des 200
 *      dynamiques.
 *   3. **La chauffe.** Sans elle, les coquilles pré-rendues restent vides une
 *      heure après chaque déploiement.
 *
 * Cette garde vérifie les trois, plus le plafond Cloudflare qui borne la
 * troisième.
 */

import { readFileSync } from "node:fs";
import { join } from "node:path";

import { describe, expect, it } from "vitest";

const RACINE = process.cwd();
const lire = (r: string): string => readFileSync(join(RACINE, r), "utf8");

const PAGE = lire("src/app/[locale]/connaissances/page/[num]/page.tsx");
const VUE = lire("src/app/[locale]/connaissances/_views/KbListingView.tsx");
const LECTEUR = lire("src/lib/knowledge/public-fetch.ts");
const WORKFLOW = lire(".github/workflows/deploy-coolify.yml");

/** Extrait une affectation shell `NOM='[…]'` du workflow. */
function listeShell(nom: string): string[] {
  const m = new RegExp(`\\s${nom}='(\\[[^']*\\])'`).exec(WORKFLOW);
  if (!m?.[1]) throw new Error(`affectation ${nom} introuvable`);
  return JSON.parse(m[1]) as string[];
}

/** Les numéros de pages pré-rendues, lus dans le code et non recopiés ici. */
function pagesPrerendues(): string[] {
  const m = /PAGES_PRERENDUES\s*=\s*\[([^\]]*)\]/.exec(PAGE);
  return (m?.[1] ?? "")
    .split(",")
    .map((x) => x.trim())
    .filter(Boolean);
}

describe("GEO-088 — les fiches KB cessent d'être orphelines du hub", () => {
  it("le lecteur sait paginer, et compter ce qu'il pagine", () => {
    // Un compte qui ne compterait pas exactement ce que la liste montre
    // produirait une page manquante — donc des fiches de nouveau orphelines.
    expect(LECTEUR).toContain("export async function countPublicKbEntries");
    expect(LECTEUR).toMatch(/skip\?:\s*number/);
    // Le compte doit passer par le MÊME prédicat anti-fuite que la liste.
    const corps = LECTEUR.slice(LECTEUR.indexOf("countPublicKbEntries"));
    expect(corps).toContain("publicEntryFilter");
  });

  it("🔴 l'ordre de tri est TOTAL — sinon la pagination perd des fiches", () => {
    // `skip`/`take` sur un tri à égalités fait glisser les lignes d'une page à
    // l'autre entre deux requêtes : des fiches disparaissent du maillage sans
    // que rien ne le signale. `id` départage, il est unique.
    expect(LECTEUR).toMatch(/orderBy:\s*\[[^\]]*id:\s*"desc"/s);
  });

  it("la vue chaîne les pages par `prev`/`next`", () => {
    // C'est cette chaîne qui rend les 507 fiches atteignables depuis le hub.
    expect(VUE).toContain('rel="prev"');
    expect(VUE).toContain('rel="next"');
  });

  it("les positions du JSON-LD sont ABSOLUES dans la collection", () => {
    // Repartir de 1 à chaque page dirait au moteur que la fiche 49 est la
    // première de la base.
    expect(VUE).toMatch(/position:\s*\(page - 1\) \* KB_PAR_PAGE \+ i \+ 1/);
  });
});

describe("🔴 le pré-rendu — un segment dynamique n'est pas servi en ISR", () => {
  it("`generateStaticParams` existe et rend un plancher de pages", () => {
    expect(PAGE).toContain("export function generateStaticParams");
    expect(pagesPrerendues().length).toBeGreaterThan(0);
  });

  it("il ne lit PAS la base — le build tourne sous URLs stub", () => {
    const corps = PAGE.slice(PAGE.indexOf("export function generateStaticParams"));
    expect(corps).not.toMatch(/prisma|await\s+count|await\s+fetch/);
  });
});

describe("🔴 l'exception de build — sans elle on figerait des 404 statiques", () => {
  it("la vue ne 404 pas quand la base est stubée", () => {
    expect(VUE).toContain("stub.invalid");
    expect(
      VUE,
      "le `notFound()` hors bornes doit être désarmé au build, sinon les pages " +
        "pré-rendues deviennent des 404 STATIQUES — pire que le défaut corrigé",
    ).toMatch(/page > totalPages && !auBuildStub/);
  });

  it("hors build, une page hors bornes reste un 404 franc", () => {
    // On ne relâche pas la règle en production : une URL hors bornes ne doit
    // pas créer d'alias indexable de la dernière page.
    expect(VUE).toContain("notFound()");
  });

  it("`page/1` redirige en 308 vers le hub, il ne se dédouble pas", () => {
    expect(PAGE).toContain("permanentRedirect");
  });
});

describe("🔴 la chauffe post-déploiement repeuple les coquilles", () => {
  it("chaque page pré-rendue est revalidée ET purgée", () => {
    // Si quelqu'un étend le plancher sans étendre la chauffe, les pages
    // ajoutées serviront une coquille vide une heure après chaque déploiement.
    const paths = listeShell("PATHS");
    const files = listeShell("FILES");
    for (const n of pagesPrerendues()) {
      const chemin = `/fr/connaissances/page/${n}`;
      expect(paths, `page ${n} pré-rendue mais jamais revalidée`).toContain(chemin);
      expect(files, `page ${n} revalidée mais jamais purgée`).toContain(
        `https://axion-ia.com${chemin}`,
      );
    }
  });

  it("🔴 les deux listes restent sous le plafond Cloudflare de 30", () => {
    // Ce n'est pas un confort : au-delà de 30 URLs, Cloudflare rejette l'appel
    // ENTIER. Plus une seule page purgée, sur tout le site — et sans lire le
    // corps de la réponse, ça ressemble à un succès.
    expect(listeShell("PATHS").length).toBeLessThanOrEqual(30);
    expect(listeShell("FILES").length).toBeLessThanOrEqual(30);
  });
});
