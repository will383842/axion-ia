// @vitest-environment node
/**
 * OUT-1 — la mise en file d'un envoi approuvé doit finir (ou déclarer son issue inconnue) AVANT que la
 * transaction qui enfile ne soit fermée par Prisma. Sinon le verrou consultatif tombe alors que l'ajout
 * est encore en vol, et une 2e approbation peut passer.
 */
import { readFileSync } from "node:fs";
import { join } from "node:path";
import { describe, expect, it } from "vitest";
import {
  DELAI_CONNEXION_FILE_MS,
  DELAI_LECTURE_FILE_MS,
  DELAI_MISE_EN_FILE_OUTBOX_MS,
} from "@/server/email/outbox-en-cours";

const source = readFileSync(join(__dirname, "lien-a-l-envoi.ts"), "utf8");

describe("lien-a-l-envoi — marge entre la mise en file et la transaction", () => {
  it("connexion + lecture + mise en file + 5 s (= 35 s) < délai de la transaction (lu dans le source)", () => {
    const m = /TIMEOUT_TRANSACTION_ENVOI_MS\s*=\s*([\d_]+)/.exec(source);
    expect(m).not.toBeNull();
    const timeout = Number((m as RegExpExecArray)[1]!.replace(/_/g, ""));
    const somme =
      DELAI_CONNEXION_FILE_MS + DELAI_LECTURE_FILE_MS + DELAI_MISE_EN_FILE_OUTBOX_MS + 5_000;
    expect(somme).toBe(35_000);
    expect(somme).toBeLessThan(timeout);
    // La garde du source porte bien les trois termes (sinon la somme lue ici serait fictive).
    expect(source).toMatch(
      /DELAI_CONNEXION_FILE_MS\s*\+\s*DELAI_LECTURE_FILE_MS\s*\+\s*DELAI_MISE_EN_FILE_OUTBOX_MS\s*\+\s*5_000\s*>=\s*TIMEOUT_TRANSACTION_ENVOI_MS/,
    );
  });

  it("les deux transactions d'envoi utilisent cette constante, aucun délai écrit en dur", () => {
    expect(source).not.toMatch(/timeout:\s*\d/);
    expect(source.match(/timeout: TIMEOUT_TRANSACTION_ENVOI_MS/g)).toHaveLength(2);
  });
});
