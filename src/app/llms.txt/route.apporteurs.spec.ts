/**
 * llms.txt — section « Réseau d'apporteurs d'affaires indépendants » (SEO/GEO, lot 1 visibilité).
 * Le canal d'ingestion des IA parle des apporteurs SANS aucun montant de commission (R7), avec
 * le même bloc « En bref » que llms-full.txt, hors de la section « Optional ».
 */
import { describe, it, expect, vi } from "vitest";

vi.mock("@/lib/seo", () => ({ SITE_URL: "https://axion-ia.com" }));

import { GET } from "./route";
import { EN_BREF_APPORTEURS } from "@/content/recrutement/en-bref-apporteurs";

const CORPS = await (await GET()).text();
const SECTION =
  CORPS.split("## Réseau d'apporteurs d'affaires indépendants")[1]?.split("\n## ")[0] ?? "";

describe("llms.txt — apporteurs d'affaires", () => {
  it("a sa propre section, avec le bloc En bref et les liens du hub et du dossier", () => {
    expect(SECTION.length).toBeGreaterThan(300);
    expect(SECTION).toContain(EN_BREF_APPORTEURS);
    expect(SECTION).toContain("https://axion-ia.com/fr/devenir-commercial-ia)");
    expect(SECTION).toContain("https://axion-ia.com/fr/devenir-commercial-ia/candidature");
  });

  it("n'est plus rangée sous « Optional »", () => {
    const optional = CORPS.split("\n## Optional")[1] ?? "";
    expect(optional.length).toBeGreaterThan(0);
    expect(optional).not.toContain("devenir-commercial-ia");
  });

  it("n'affiche aucun montant dans la section (règle R7)", () => {
    expect(SECTION).not.toMatch(/\d[\d\s  ]*\s?(€|euros?)/i);
  });

  it("n'emploie pas le vocabulaire interdit", () => {
    const texte = SECTION.replace(/https?:\/\/\S+/g, "");
    expect(texte).not.toMatch(
      /recrut|candidature|qualiopi|freelance|grenoble|salari[ée]s? d'Axion/i,
    );
  });
});
