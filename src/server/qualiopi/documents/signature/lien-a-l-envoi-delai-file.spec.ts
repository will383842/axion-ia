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
  it("somme RÉELLE du pire cas (sondes, retrait, journal, ajout ≥ 10 s, relecture, marge) < délai de la transaction, lue dans le source", () => {
    const m = /TIMEOUT_TRANSACTION_ENVOI_MS\s*=\s*([\d_]+)/.exec(source);
    expect(m).not.toBeNull();
    const timeout = Number((m as RegExpExecArray)[1]!.replace(/_/g, ""));
    const sondeExterne = DELAI_CONNEXION_FILE_MS + DELAI_LECTURE_FILE_MS;
    const sondeInterne = DELAI_CONNEXION_FILE_MS + DELAI_LECTURE_FILE_MS;
    const retrait = DELAI_LECTURE_FILE_MS;
    const journal = 5_000;
    const ajoutMin = DELAI_MISE_EN_FILE_OUTBOX_MS - DELAI_CONNEXION_FILE_MS - DELAI_LECTURE_FILE_MS;
    const relectureApresAjout = DELAI_LECTURE_FILE_MS;
    const marge = 5_000;
    const somme =
      sondeExterne + sondeInterne + retrait + journal + ajoutMin + relectureApresAjout + marge;
    expect(sondeExterne).toBe(10_000);
    expect(sondeInterne).toBe(10_000);
    expect(ajoutMin).toBe(10_000);
    expect(somme).toBe(50_000);
    expect(somme).toBeLessThan(timeout);
    // Le source porte bien ces sept termes dans la somme qu'il garde (sinon celle-ci serait fictive).
    const garde = /const BUDGET_ENVOI_REEL_MS =([^;]+);/.exec(source);
    expect(garde).not.toBeNull();
    const corps = (garde as RegExpExecArray)[1]!;
    expect(corps.match(/DELAI_CONNEXION_FILE_MS/g)).toHaveLength(3);
    expect(corps.match(/DELAI_LECTURE_FILE_MS/g)).toHaveLength(5);
    expect(corps).toContain("DELAI_MISE_EN_FILE_OUTBOX_MS");
    expect(corps.match(/5_000/g)).toHaveLength(2);
    expect(source).toMatch(/BUDGET_ENVOI_REEL_MS\s*>=\s*TIMEOUT_TRANSACTION_ENVOI_MS/);
  });

  it("les deux transactions d'envoi utilisent cette constante, aucun délai écrit en dur", () => {
    expect(source).not.toMatch(/timeout:\s*\d/);
    expect(source.match(/timeout: TIMEOUT_TRANSACTION_ENVOI_MS/g)).toHaveLength(2);
  });
});
