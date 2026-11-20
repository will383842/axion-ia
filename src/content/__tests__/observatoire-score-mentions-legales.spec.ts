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
import { IDENTITE_LEGALE } from "@/lib/identite-legale-ssot";
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

describe("audit PR-4 : transfert de l'IP, responsable, droits, promesse de comparaison", () => {
  it("FR et EN : Cloudflare contacté dès la case cochée, IP, empreinte 10 minutes (art. 13.1.f)", () => {
    const fr = section("fr").body;
    const en = section("en").body;
    expect(fr).toContain("Dès que vous cochez la case");
    expect(fr).not.toContain("uniquement au moment de l'envoi");
    expect(fr).toMatch(/adresse IP et des informations techniques sur votre navigateur/);
    expect(fr).toMatch(/Cloudflare \(États-Unis/);
    expect(fr).toContain("Il en va de même lorsque vous ouvrez le formulaire de retrait");
    expect(fr).toContain("10 minutes après votre dernière tentative");
    expect(en).toContain("As soon as you tick the box");
    expect(en).not.toContain("only at submission");
    expect(en).toMatch(/IP address and technical information about your browser/);
    expect(en).toMatch(/Cloudflare \(United States/);
    expect(en).toContain("The same applies when you open the withdrawal form");
    expect(en).toContain("10 minutes after your last attempt");
  });
  it("données : langue de la page et empreinte du code de retrait (jamais le code)", () => {
    expect(section("fr").body).toContain(
      "la langue de la page et une empreinte de votre code de retrait (jamais le code lui-même)",
    );
    expect(section("en").body).toContain(
      "the page language and a fingerprint of your withdrawal code (never the code itself)",
    );
  });
  it("D-B : les anciennes réponses ne servent pas à la comparaison ; ancien canal : IP et jour", () => {
    expect(section("fr").body).toContain("ne sont pas utilisées pour la comparaison du Score");
    expect(section("en").body).toContain("are not used for the Score comparison");
    expect(section("fr").body).toContain("l'adresse IP utilisée et le jour de la réponse");
    expect(section("en").body).toContain("the IP address used and the day");
  });
  it("le responsable porte la raison sociale lue de la source unique", () => {
    for (const l of ["fr", "en"] as const) {
      expect(section(l).body).toContain(`Axion-IA (${IDENTITE_LEGALE.legalName})`);
    }
  });
  it("droits : retrait du consentement et portabilité", () => {
    expect(section("fr").body).toMatch(/retirer votre consentement.*portabilité/);
    expect(section("en").body).toMatch(/withdraw your consent.*portability/);
  });
  it("le bouton de l'Observatoire ne promet plus de comparaison aux dirigeants interrogés", () => {
    for (const f of ["src/messages/fr.json", "src/messages/en.json"]) {
      const j = JSON.parse(lire(f)) as { observatoire: { form: { subhook: string } } };
      expect(j.observatoire.form.subhook).not.toMatch(
        /dirigeants d[ée]j[àa] interrog|executives already/i,
      );
      // Aucune promesse de comparaison, quelle que soit la formulation (D-B).
      expect(j.observatoire.form.subhook).not.toMatch(/compar/i);
    }
  });
});
