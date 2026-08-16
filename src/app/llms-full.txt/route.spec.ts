/**
 * Tests — `llms-full.txt` (audit GEO/AEO 2026-08-15, LOT 4).
 *
 * Findings couverts : GEO-002 (le fichier servait des gabarits `{{price:…}}`
 * NON RÉSOLUS aux moteurs de réponse — or le prix est la requête n°1 posée aux
 * assistants) et GEO-132 (cadence de publication « hebdomadaire » annoncée alors
 * que le pipeline est à l'arrêt depuis le 2026-07-20).
 *
 * ⚠️ Décision actée Will (LOT 4) : le mode `|flat` NE DOIT PAS être converti en
 * `|from`. La prose porte déjà « à partir de » autour du token ; basculer le
 * mode produirait « à partir de à partir de ». Le test correspondant ci-dessous
 * verrouille ce comportement — s'il rougit, c'est le patch qui a tort.
 */

import { describe, it, expect, vi } from "vitest";

vi.mock("@/lib/seo", () => ({ SITE_URL: "https://axion-ia.com" }));

import { GET } from "./route";

const CORPS = await GET().text();

describe("llms-full.txt — le canal d'ingestion sert des prix, pas des gabarits", () => {
  it("ne contient AUCUN token de prix brut", () => {
    // Mesuré au 2026-08-14 : 26 tokens `{{price:…}}` servis en clair.
    expect(CORPS).not.toContain("{{price:");
    expect(CORPS).not.toContain("{{label:");
  });

  it("sert bien des montants en euros dans le bloc FAQ", () => {
    // Garde anti-test-vide : sans montant résolu, l'assertion ci-dessus
    // passerait aussi sur un fichier dont on aurait simplement retiré la FAQ.
    const faq = CORPS.split("## FAQ")[1] ?? "";
    expect(faq.length).toBeGreaterThan(500);
    expect(faq).toMatch(/\d[  \s]?\d{3}\s?€/);
  });

  it("ne produit jamais « à partir de à partir de »", () => {
    // Décision actée : la prose porte l'amorce, le token reste en `|flat`.
    // `collapsePriceProseDuplicates` rattrape les cas résiduels.
    expect(CORPS.toLowerCase()).not.toMatch(/à\s+partir\s+de\s+à\s+partir\s+de/);
    expect(CORPS).not.toMatch(/à\s+À\s+partir\s+de/);
  });
});

describe("llms-full.txt — promesses tenables", () => {
  it("n'annonce plus de cadence de publication hebdomadaire", () => {
    // GEO-132 : le flux d'actualités est gelé depuis le 2026-07-20 (kill switch
    // OpenAI). Annoncer une cadence qu'on ne tient pas dégrade la confiance des
    // moteurs de réponse, qui datent et recoupent ce qu'on leur déclare.
    //
    // ⚠️ On cible la SECTION Actualités, pas le mot « hebdomadaire » partout :
    // il apparaît légitimement dans une réponse FAQ (« reporting hebdomadaire »)
    // qui ne promet aucune cadence éditoriale.
    const section = CORPS.split(/^## Actualités IA/m)[1] ?? "";
    expect(section.length, "section Actualités IA introuvable").toBeGreaterThan(200);
    const avantSectionSuivante = (section.split(/^## /m)[0] ?? "").toLowerCase();
    expect(avantSectionSuivante).not.toContain("hebdomadaire");
    expect(avantSectionSuivante).not.toContain("chaque semaine");
  });
});
