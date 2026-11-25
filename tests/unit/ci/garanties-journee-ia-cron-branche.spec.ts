/**
 * Le passage quotidien des alertes de la garantie Journée IA est BRANCHÉ de bout en bout : type de
 * tâche, répétition à 06:50 UTC (avant le moteur d'alertes de 07:00), table des handlers. Un cron
 * écrit mais jamais branché est une fonctionnalité qui n'existe pas.
 */
import { readFileSync } from "node:fs";
import { join } from "node:path";
import { describe, expect, it } from "vitest";

const lire = (p: string) => readFileSync(join(process.cwd(), p), "utf8");
const queues = lire("src/server/queue/queues.ts");
const worker = lire("src/server/queue/workers/qualiopi-formation-crons-worker.ts");
const TYPE = "formation-crons.garanties-journee-ia";

describe("cron garanties-journee-ia", () => {
  it("est répété chaque jour à 06:50 UTC, avant le moteur d'alertes (07:00)", () => {
    expect(queues).toMatch(
      new RegExp(
        `type: "${TYPE}",\\s*pattern: "50 6 \\* \\* \\*",\\s*jobId: "formation-crons-garanties-journee-ia-cron"`,
      ),
    );
    expect(queues).toMatch(/type: "formation-crons\.alertes",\s*pattern: "0 7 \* \* \*"/);
  });
  it("est déclaré dans l'union des types et dans la table des handlers", () => {
    expect(worker).toContain(`| "${TYPE}"`);
    expect(worker).toContain(`"${TYPE}": handleGarantiesJourneeIa,`);
  });
  it("le handler ignore un build à base factice et délègue au passage", () => {
    const m = /async function handleGarantiesJourneeIa\(\)[\s\S]*?\n}\n/.exec(worker)?.[0] ?? "";
    expect(m).toContain("stub.invalid");
    expect(m).toContain("passerGarantiesJourneeIa()");
  });
});
