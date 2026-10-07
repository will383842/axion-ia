/**
 * `D5-5-04` + `D5-5-05` — une preuve ne doit pas mourir avant ce qu'elle prouve.
 *
 * ## Historique
 *
 * **`D5-5-04`** — les `EmailLog` transactionnels étaient purgés à 36 mois,
 * alors que la pièce dont ils sont la preuve d'envoi est conservée 5 ans ; la
 * durée avait été alignée sur 5 ans.
 *
 * **`D5-5-05`** — la purge des `activity_logs` à 12 mois emportait les traces
 * `gdpr.erase.completed` / `gdpr.export.delivered` ; elle avait été corrigée
 * pour les épargner.
 *
 * ## Depuis le 2026-10-07
 *
 * Will : « coupe tous les effacements ». Le journal des e-mails, sa corbeille,
 * ses copies et le journal d'activité (traces RGPD comprises) ne sont PLUS
 * purgés du tout : une preuve ne peut donc plus mourir avant ce qu'elle
 * prouve. Ce fichier verrouille cette absence ; la garde générale est
 * `aucun-effacement-automatique-de-personnes.spec.ts`.
 */

import { readFileSync } from "node:fs";
import { join } from "node:path";

import { describe, expect, it } from "vitest";

const SOURCE = join(process.cwd(), "src/server/queue/workers/retention-purge-worker.ts");

function code(): string {
  return readFileSync(SOURCE, "utf8")
    .replace(/\/\*[\s\S]*?\*\//g, (bloc) => bloc.replace(/[^\n]/g, ""))
    .replace(/^[ \t]*\/\/.*$/gm, "");
}

describe("purge — la preuve d'envoi et les traces RGPD ne sont plus jamais purgées", () => {
  it("témoin : le worker est bien lu", () => {
    expect(code()).toContain("executerPurgeRetention");
  });

  it("🔴 aucune suppression dans le journal des e-mails ni dans sa corbeille", () => {
    expect(code()).not.toMatch(/\.emailLog\s*\.\s*delete/);
    expect(code()).not.toMatch(/\.emailOutbox\s*\.\s*delete/);
  });

  it("🔴 aucune suppression dans le journal d'activité, traces `gdpr.*` comprises", () => {
    expect(code()).not.toMatch(/\.activityLog\s*\.\s*delete/);
  });
});
