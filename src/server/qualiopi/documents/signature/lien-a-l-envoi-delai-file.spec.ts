// @vitest-environment node
/**
 * OUT-1 — la mise en file d'un envoi approuvé doit finir (ou déclarer son issue inconnue) AVANT que la
 * transaction qui enfile ne soit fermée par Prisma. Sinon le verrou consultatif tombe alors que l'ajout
 * est encore en vol, et une 2e approbation peut passer.
 */
import { readFileSync } from "node:fs";
import { join } from "node:path";
import { describe, expect, it, vi } from "vitest";

// Le module est chargé pour de bon (sa garde au chargement lève si la somme dépasse la transaction) ;
// ses dépendances lourdes sont neutralisées.
vi.mock("@/lib/prisma", () => ({ prisma: {} }));
vi.mock("@sentry/nextjs", () => ({ captureException: vi.fn(), captureMessage: vi.fn() }));
vi.mock("@/lib/telegram", () => ({ sendTelegram: vi.fn() }));
vi.mock("@/server/actions/qualiopi/_guards", () => ({ logQualiopiActivity: vi.fn() }));

import { BUDGET_ENVOI_REEL_MS, TIMEOUT_TRANSACTION_ENVOI_MS } from "./lien-a-l-envoi";

const source = readFileSync(join(__dirname, "lien-a-l-envoi.ts"), "utf8");

describe("lien-a-l-envoi — marge entre la mise en file et la transaction", () => {
  it("la somme RÉELLE du pire cas (constante exportée) est inférieure au délai de la transaction, lu dans le source", () => {
    const m = /export const TIMEOUT_TRANSACTION_ENVOI_MS\s*=\s*([\d_]+)/.exec(source);
    expect(m).not.toBeNull();
    const timeoutDuSource = Number((m as RegExpExecArray)[1]!.replace(/_/g, ""));
    // Le test ne refait AUCUNE somme : il lit celle que le module garde.
    expect(TIMEOUT_TRANSACTION_ENVOI_MS).toBe(timeoutDuSource);
    expect(BUDGET_ENVOI_REEL_MS).toBeLessThan(timeoutDuSource);
    // Et la limite annoncée : rester sous 60 s.
    expect(BUDGET_ENVOI_REEL_MS).toBeLessThan(60_000);
    expect(source).toMatch(/BUDGET_ENVOI_REEL_MS\s*>=\s*TIMEOUT_TRANSACTION_ENVOI_MS/);
  });

  it("les deux transactions d'envoi utilisent cette constante, aucun délai écrit en dur", () => {
    expect(source).not.toMatch(/timeout:\s*\d/);
    expect(source.match(/timeout: TIMEOUT_TRANSACTION_ENVOI_MS/g)).toHaveLength(2);
  });
});
