// @vitest-environment node
// Environnement `node` requis : `buildOrganizationJsonLd` lit des env vars
// SERVEUR (t3-env), dont l'accès lève sous jsdom (« server var on client »).
/**
 * Garde-fou CI « le JSON-LD doit matcher le registre » — vérifié sur pièces le
 * 02/08/2026 (Kbis RCS Grenoble à jour au 30/07/2026, n° de gestion 2026B01964,
 * + avis de situation SIRENE du 02/08/2026, qui concordent).
 *
 * Pourquoi ce test existe : `legalName` et `address` sont les deux champs que
 * Google rapproche des registres publics (SIRENE / INPI) pour décider si
 * l'entité du site EST l'entreprise immatriculée. Un écart d'un caractère
 * (« Axion-IA SAS » au lieu de « AXION IA SAS », complément de domiciliation
 * omis) casse ce rapprochement et coûte le Knowledge Panel — sans jamais faire
 * échouer un build. D'où l'enforcement permanent ici.
 *
 * Trois invariants, correspondant aux trois écarts constatés le 02/08/2026 :
 *   1. la raison sociale est celle du Kbis (sans trait d'union) ;
 *   2. plus AUCUNE duplication littérale de la raison sociale sous `src/` —
 *      elle dérivait de 7 copies divergentes de la SSOT `BRAND` ;
 *   3. l'adresse émise porte le complément de domiciliation, et l'identifiant
 *      légal est étiqueté d'après sa forme réelle (un SIRET n'est pas un RCS).
 */
import { describe, it, expect } from "vitest";
import { readdirSync, readFileSync, statSync } from "node:fs";
import path from "node:path";

import { BRAND } from "@/lib/brand";
import { buildOrganizationJsonLd } from "@/lib/seo";

const SRC = path.resolve(process.cwd(), "src");

/** Le fichier SSOT lui-même est le seul endroit qui a le droit de l'écrire. */
const SSOT_FILE = path.join("src", "lib", "brand.ts");

const SCANNED_EXT = new Set([".ts", ".tsx"]);

/** Les fixtures de test posent des identités arbitraires — c'est leur métier. */
const IS_TEST_FILE = /\.(spec|test)\.tsx?$/;

function walk(dir: string, out: string[] = []): string[] {
  for (const entry of readdirSync(dir)) {
    const full = path.join(dir, entry);
    if (statSync(full).isDirectory()) {
      if (entry === "node_modules" || entry === "generated") continue;
      walk(full, out);
      continue;
    }
    if (SCANNED_EXT.has(path.extname(entry))) out.push(full);
  }
  return out;
}

describe("identité légale — le JSON-LD doit matcher le registre", () => {
  it("1. `BRAND.legalName` est la dénomination immatriculée, sans trait d'union", () => {
    // Kbis : « Dénomination ou raison sociale : AXION IA ». Le tiret appartient
    // à la marque commerciale (`BRAND.name`), pas à la personne morale.
    expect(BRAND.legalName).toBe("AXION IA SAS");
    expect(BRAND.legalName).not.toContain("-");
    // La marque, elle, garde son tiret — les deux ne doivent pas fusionner.
    expect(BRAND.name).toBe("Axion-IA");
  });

  it("2. aucune raison sociale dupliquée en dur hors de la SSOT", () => {
    // Attrape les deux orthographes : l'ancienne (avec tiret, celle qui a
    // divergé) et la nouvelle — toute copie littérale re-divergera un jour.
    const FORBIDDEN = /legalName:\s*"(Axion-IA SAS|AXION IA SAS)"/;

    const offenders = walk(SRC)
      .filter((file) => !file.endsWith(SSOT_FILE) && !IS_TEST_FILE.test(file))
      .filter((file) => FORBIDDEN.test(readFileSync(file, "utf8")))
      .map((file) => path.relative(process.cwd(), file));

    expect(offenders, "dériver de `BRAND.legalName` au lieu de recopier").toEqual([]);
  });

  it("3a. l'adresse émise porte le complément de domiciliation du Kbis", () => {
    const org = buildOrganizationJsonLd({ locale: "fr" }) as {
      legalName: string;
      address: { streetAddress: string; postalCode: string; addressLocality: string };
      foundingLocation: { address: { streetAddress: string } };
    };

    expect(org.legalName).toBe(BRAND.legalName);
    expect(org.address.streetAddress).toContain("11 Avenue Paul Verlaine");
    // Le complément fait partie de l'adresse immatriculée (SIRENE le porte sur
    // sa propre ligne) : l'omettre casse l'exact-match NAP.
    expect(org.address.streetAddress).toContain("ELITE BUREAUX");
    expect(org.address.postalCode).toBe("38100");
    expect(org.address.addressLocality).toBe("Grenoble");
    // Siège et lieu de fondation ne doivent jamais diverger.
    expect(org.foundingLocation.address.streetAddress).toBe(org.address.streetAddress);
  });

  it("3a-bis. l'adresse du siège ne dépend d'AUCUNE env var", () => {
    // Constaté en prod le 02/08/2026 : `COMPANY_ADDRESS` était absente au SSG
    // (pas un build-arg) mais présente au runtime, avec une valeur SANS le
    // complément de domiciliation. Le même nœud `#organization` déclarait donc
    // deux `streetAddress` différentes selon que la page était figée au build
    // ou rendue à la volée. Une adresse de siège est publique et figée au Kbis :
    // la rendre configurable garantit qu'elle re-divergera.
    const source = readFileSync(path.join(SRC, "lib", "seo.ts"), "utf8");
    const builder = source.slice(
      source.indexOf("function buildSiegePostalAddress"),
      source.indexOf("function describeRegistrationNumber"),
    );

    expect(builder, "le builder d'adresse doit être présent").not.toBe("");
    expect(builder).not.toContain("COMPANY_ADDRESS");
    expect(builder).not.toContain("env.");
  });

  it("3b. l'identifiant légal est étiqueté d'après sa forme, pas supposé", () => {
    // Le champ était étiqueté « immatriculation RCS » en dur alors que l'env
    // var porte un SIRET — le pied de page des emails, lui, disait « SIRET ».
    const label = (registrationNumber: string) =>
      (
        buildOrganizationJsonLd({ locale: "fr", registrationNumber }) as {
          identifier: { propertyID: string; value: string };
        }
      ).identifier.propertyID;

    expect(label("12345678901234")).toBe("SIRET");
    expect(label("123 456 789 01234")).toBe("SIRET");
    expect(label("123456789")).toBe("SIREN");
    expect(label("123 456 789")).toBe("SIREN");
    // Forme libre (« RCS Grenoble 123 456 789 ») → libellé générique.
    expect(label("RCS Grenoble 123 456 789")).toBe("immatriculation RCS");
  });

  it("3c. identifiant absent ⇒ champ omis, jamais de valeur vide", () => {
    const org = buildOrganizationJsonLd({ locale: "fr" }) as Record<string, unknown>;
    expect(org).not.toHaveProperty("identifier");
  });
});
