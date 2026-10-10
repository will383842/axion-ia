/**
 * Le banc `@formateurs` a SON job, et ce job ne peut rien faire sortir.
 *
 * Lot X1-bis (2026-10-10). Le banc a besoin d'une file BullMQ allumée, d'un
 * worker et d'un puits SMTP — tout ce que Gate B n'a pas, et ne doit pas avoir.
 * Ce cliquet relie les quatre faits qui rendent ce partage juste :
 *
 *   · Gate B n'exécute plus `@formateurs` (sinon les envois y seraient
 *     « prouvés » sur une file absente) ;
 *   · le job du banc ALLUME la file (aucun `BULLMQ_DISABLED`) et lance le tag ;
 *   · il n'a aucun moyen d'atteindre un vrai service : aucun `secrets.*`,
 *     aucune clé de relais, permissions en lecture, pas de
 *     `pull_request_target` ;
 *   · la nuit l'appelle, et l'alerte nocturne l'attend.
 */
import { describe, expect, it } from "vitest";

import { codeYaml, corpsDuJob } from "./lire-un-workflow";

const BANC = codeYaml(".github/workflows/banc-formateurs.yml");
const CI = codeYaml(".github/workflows/ci.yml");
const NUIT = codeYaml(".github/workflows/nightly.yml");

describe("le banc @formateurs a son job", () => {
  it("Gate B exclut le tag @formateurs", () => {
    const gateB = corpsDuJob(CI, "gate-b") ?? "";
    const ligne = gateB.split("\n").find((l) => /^\s+run:\s+pnpm test:e2e\b/.test(l)) ?? "";
    expect(ligne).toMatch(/--grep-invert\s+"[^"]*@formateurs[^"]*"/);
  });

  it("le job du banc allume la file et lance le tag, sans relance", () => {
    expect(BANC).not.toMatch(/BULLMQ_DISABLED/);
    expect(BANC).toMatch(/pnpm worker/);
    expect(BANC).toMatch(/playwright test [^\n]*--grep "@formateurs"[^\n]*--retries=0/);
    expect(BANC).toMatch(/image: axllent\/mailpit:/);
    expect(BANC).toMatch(/SMTP_PORT: "1025"/);
  });

  it("rien ne peut sortir du job du banc", () => {
    expect(BANC).not.toMatch(/secrets\./);
    expect(BANC).not.toMatch(/pull_request_target/);
    expect(BANC).not.toMatch(/SMTP_USER|SMTP_PASS|ZEPTOMAIL|CALENDLY_API_TOKEN/);
    expect(BANC).toMatch(/permissions:\n\s+contents: read\n/);
    expect(BANC).not.toMatch(/write/);
  });

  it("la nuit appelle le banc, et l'alerte nocturne l'attend", () => {
    expect(corpsDuJob(NUIT, "banc-formateurs") ?? "").toMatch(
      /uses: \.\/\.github\/workflows\/banc-formateurs\.yml/,
    );
    expect(corpsDuJob(NUIT, "notify-failure") ?? "").toMatch(/banc-formateurs/);
  });
});
