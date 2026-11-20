// @vitest-environment node

/**
 * V2-10 PR-4 — la phrase inexacte « 100 % anonyme / aucune donnée personnelle collectée »
 * est retirée, et la politique de confidentialité porte la section « Observatoire de l'IA »
 * (responsable, finalité, base légale, durée, droit de retrait par le code, CNIL).
 */
import { readFileSync } from "node:fs";
import path from "node:path";
import { describe, expect, it } from "vitest";

import { LEGAL_PAGES } from "../legal";
import { DUREE_CONSERVATION_ANS, N_MIN_STATISTIQUE } from "@/lib/score-ia-pme/constantes";

const RACINE = path.resolve(__dirname, "../../..");
const lire = (p: string) => readFileSync(path.join(RACINE, p), "utf8");

const INTERDITS = [
  /qualiopi/i,
  /opco/i,
  /\bCPF\b/,
  /france travail/i,
  /financement/i,
  /prise en charge/i,
  /grenoble/i,
  /aucun gain garanti/i,
  /appel de cadrage/i,
];

function section(locale: "fr" | "en") {
  const page = LEGAL_PAGES.find((p) => p.slug === "politique-confidentialite");
  const s = page?.[locale].sections.find((x) => x.anchor === "observatoire-ia");
  expect(s, `section « Observatoire » introuvable (${locale})`).toBeTruthy();
  return s!;
}

describe("la phrase « 100 % anonyme » est retirée", () => {
  const FICHIERS = [
    "src/app/[locale]/observatoire-ia/participer/page.tsx",
    "src/server/actions/observatoire/public.ts",
  ];
  it.each(FICHIERS)("%s", (f) => {
    const src = lire(f);
    expect(src).not.toMatch(/100\s?%\s?anonym/i);
    expect(src).not.toMatch(/aucune donn[ée]e personnelle collect/i);
    expect(src).not.toMatch(/No personal data collected/i);
    expect(src).not.toMatch(/strictement anonymes/i);
    expect(src).not.toMatch(/Aucune PII/i);
  });
  it("la formule de remplacement est « Sans nom ni e-mail »", () => {
    expect(lire(FICHIERS[0]!)).toContain("Sans nom ni e-mail");
  });
});

describe("politique de confidentialité : section Observatoire de l'IA", () => {
  it("FR : responsable, finalité, base légale, durée, retrait par le code, CNIL", () => {
    const s = section("fr");
    expect(s.title).toMatch(/Observatoire de l'IA/);
    for (const m of [
      "Axion-IA",
      "contact@axion-ia.com",
      "statistiques d'ensemble",
      "consentement",
      "art. 6.1.a",
      `${DUREE_CONSERVATION_ANS} ans`,
      `moins de ${N_MIN_STATISTIQUE}`,
      "code de retrait",
      "CNIL",
      "pseudonyme",
      "Cloudflare",
    ]) {
      expect(s.body, `« ${m} » absent`).toContain(m);
    }
    expect(s.body).toMatch(/ni votre adresse IP/);
  });
  it("EN : controller, purpose, legal basis, retention, withdrawal code, CNIL", () => {
    const s = section("en");
    for (const m of [
      "Axion-IA",
      "contact@axion-ia.com",
      "consent",
      "art. 6.1.a",
      `${DUREE_CONSERVATION_ANS} years`,
      "withdrawal code",
      "CNIL",
    ]) {
      expect(s.body, `« ${m} » absent`).toContain(m);
    }
  });
  it("aucun mot interdit dans la section", () => {
    for (const l of ["fr", "en"] as const) {
      for (const re of INTERDITS) expect(section(l).body).not.toMatch(re);
    }
  });
  it("la page de la politique est datée du jour de la révision", () => {
    expect(lire("src/app/[locale]/politique-confidentialite/page.tsx")).toContain(
      'LAST_UPDATED_ISO = "2026-11-20"',
    );
  });
});
