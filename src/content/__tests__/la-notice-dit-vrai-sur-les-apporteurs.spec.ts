// @vitest-environment node

/**
 * Verrou — la politique de confidentialité décrit le tunnel des apporteurs
 * d'affaires, et dit ce que le code fait (2026-09-19).
 *
 * Jusqu'à cette date, `src/content/legal.ts` ne disait RIEN du réseau
 * d'apporteurs : ni les pages qui collectent, ni les e-mails automatiques
 * (kit à 30 minutes, relances à J+2 et J+7), ni la durée de conservation. Or
 * l'invitation envoyée à une personne recommandée renvoie désormais vers cette
 * section : le lien ne peut pas pointer sur un texte absent.
 *
 * Même méthode que `la-notice-dit-vrai-sur-les-candidatures.spec.ts` : la durée
 * publiée est lue dans le texte ET dans les défauts de la purge, et les deux
 * doivent être égales. Garde de forme, pas de rédaction.
 */

import { readFileSync } from "node:fs";
import { join } from "node:path";

import { describe, expect, it } from "vitest";

import { LEGAL_PAGES } from "../legal";

const WORKER = join(process.cwd(), "src/server/queue/workers/retention-purge-worker.ts");

function section(locale: "fr" | "en", titre: RegExp): string | undefined {
  const page = LEGAL_PAGES.find((p) => p.slug === "politique-confidentialite");
  return page?.[locale].sections.find((s) => titre.test(s.title))?.body;
}

const FR = () => section("fr", /^Réseau d'apporteurs d'affaires$/);
const EN = () => section("en", /^Business introducer network$/);

/** Durée réellement appliquée aux dossiers classés (status `archived`). */
function dureeAppliquee(): number {
  const m = /submissionsArchived:\s*(\d+)/.exec(readFileSync(WORKER, "utf8"));
  return Number(m?.[1]);
}

describe("la notice dit vrai sur le réseau d'apporteurs", () => {
  it("🔴 la section existe en français ET en anglais", () => {
    expect(FR(), "section FR « Réseau d'apporteurs d'affaires » absente").toBeDefined();
    expect(EN(), "section EN « Business introducer network » absente").toBeDefined();
  });

  it("🔴 la durée publiée est EXACTEMENT celle que la purge applique aux dossiers classés", () => {
    const mois = dureeAppliquee();
    expect(mois, "`DEFAULTS.submissionsArchived` introuvable").toBeGreaterThan(0);
    expect(FR()).toContain(`${mois} mois`);
    expect(EN()).toContain(`${mois} months`);
  });

  it("annonce les relances automatiques à J+2 et J+7, et le kit à 30 minutes", () => {
    expect(FR()).toContain("J+2");
    expect(FR()).toContain("J+7");
    expect(FR()).toContain("30 minutes");
    expect(EN()).toMatch(/2 days/);
    expect(EN()).toMatch(/7 days/);
    expect(EN()).toContain("30 minutes");
  });

  it("ne promet pas « jamais transmises » : des destinataires existent, ils sont nommés", () => {
    expect(FR()).not.toMatch(/jamais transmises/i);
    expect(FR()).toContain("ZeptoMail");
    expect(FR()).toContain("Telegram");
    expect(FR()).toMatch(/ni vendues ni cédées/);
  });

  it("vouvoie : aucun tutoiement dans une page légale", () => {
    const texte = ` ${FR() ?? ""} `;
    expect(texte).not.toMatch(/[\s(«'’](tu|ta|ton|tes|te|toi)[\s,.;:)»]/i);
  });
});
