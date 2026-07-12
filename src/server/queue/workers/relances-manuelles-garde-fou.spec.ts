/**
 * GARDE-FOU (Phase 4) — les relances clients sont 100 % MANUELLES.
 *
 * Règle produit de Will (2026-07-12) : les crons DÉTECTENT (statuts, relances
 * proposées) mais n'ENVOIENT JAMAIS d'email client. Ce test lit la SOURCE des
 * handlers de détection et échoue si un envoi client y réapparaît — pour que
 * la règle survive aux refontes futures.
 */

import { describe, it, expect } from "vitest";
import { readFileSync } from "node:fs";
import { join } from "node:path";

const WORKERS_DIR = join(process.cwd(), "src", "server", "queue", "workers");

/** Extrait le corps d'une fonction nommée (jusqu'à la fonction suivante). */
function extraireFonction(source: string, nom: string): string {
  const start = source.indexOf(`async function ${nom}(`);
  expect(start, `fonction ${nom} introuvable`).toBeGreaterThan(-1);
  const nextFn = source.indexOf("\nasync function ", start + 1);
  const nextConst = source.indexOf("\nconst HANDLERS", start + 1);
  const candidates = [nextFn, nextConst].filter((i) => i > start);
  const end = candidates.length > 0 ? Math.min(...candidates) : source.length;
  return source.slice(start, end);
}

describe("relances manuelles — garde-fou anti-envoi automatique", () => {
  it("booking-crons : handlePaymentOverdueScan n'envoie AUCUN email client", () => {
    const src = readFileSync(join(WORKERS_DIR, "booking-crons-worker.ts"), "utf8");
    const corps = extraireFonction(src, "handlePaymentOverdueScan");
    expect(corps).not.toContain("enqueueClientEmail");
    expect(corps).not.toContain("enqueueEmail(");
    expect(corps).toContain("relanceProposee");
  });

  it("booking-crons : handleQuotePendingReminder n'envoie AUCUN email client", () => {
    const src = readFileSync(join(WORKERS_DIR, "booking-crons-worker.ts"), "utf8");
    const corps = extraireFonction(src, "handleQuotePendingReminder");
    expect(corps).not.toContain("enqueueClientEmail");
    expect(corps).not.toContain("enqueueEmail(");
    expect(corps).toContain("relanceProposee");
  });

  it("formation-crons : handleFacturesRetard n'envoie AUCUN email client", () => {
    const src = readFileSync(join(WORKERS_DIR, "qualiopi-formation-crons-worker.ts"), "utf8");
    const corps = extraireFonction(src, "handleFacturesRetard");
    expect(corps).not.toContain("enqueueClientEmail");
    expect(corps).not.toContain("enqueueEmail(");
    expect(corps).not.toContain("envoyerFactureEmail");
    expect(corps).toContain("relanceProposee");
  });
});
