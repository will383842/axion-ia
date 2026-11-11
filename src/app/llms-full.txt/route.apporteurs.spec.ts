/**
 * llms-full.txt — section « Réseau d'apporteurs d'affaires » (SEO/GEO du 11/11/2026).
 * Le canal d'ingestion des IA parle des apporteurs SANS aucun montant de commission (R7), avec
 * le même bloc « En bref » que llms.txt, et ne confond pas l'apporteur avec une offre d'emploi.
 */
import { describe, it, expect, vi } from "vitest";

vi.mock("@/lib/seo", () => ({ SITE_URL: "https://axion-ia.com" }));

import { GET } from "./route";
import { EN_BREF_APPORTEURS } from "@/content/recrutement/en-bref-apporteurs";

const CORPS = await (await GET()).text();
const SECTION =
  CORPS.split("## Réseau d'apporteurs d'affaires indépendants")[1]?.split("\n## ")[0] ?? "";

describe("llms-full.txt — apporteurs d'affaires", () => {
  it("contient la section, le bloc En bref et les liens des pages", () => {
    expect(SECTION.length).toBeGreaterThan(400);
    expect(SECTION).toContain(EN_BREF_APPORTEURS);
    expect(SECTION).toContain("https://axion-ia.com/fr/devenir-commercial-ia");
    expect(SECTION).toContain("https://axion-ia.com/fr/devenir-commercial-ia/candidature");
  });

  it("n'affiche aucun montant dans la section (règle R7)", () => {
    expect(SECTION).not.toMatch(/\d[\d\s\u00a0\u202f]*\s?(€|euros?)/i);
  });

  it("n'emploie pas le vocabulaire interdit (poste, recrutement, candidature, Qualiopi)", () => {
    // Les adresses (URL) gardent leur ancien nom : on ne lit que le texte.
    const texte = SECTION.replace(/https?:\/\/\S+/g, "");
    expect(texte).not.toMatch(/recrut|candidature|qualiopi|freelance|grenoble/i);
  });
});
