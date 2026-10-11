// FAC-6 — Le dépôt des apporteurs passe par le dépôt contrôlé commun : une seule source pour
// la taille maximale et pour l'enveloppe de chiffrement.
import { describe, expect, it, vi } from "vitest";

vi.mock("server-only", () => ({}));

import { TAILLE_MAX_PIECE, chiffrerPieceAuRepos } from "@/server/pieces/depot-controle";
import * as donnees from "../donnees";
import { chiffrerContenuPiece } from "../pieces-chiffrement";

describe("une seule source", () => {
  it("la taille maximale des apporteurs est celle du dépôt commun", () => {
    expect(donnees.TAILLE_MAX_PIECE).toBe(TAILLE_MAX_PIECE);
  });
  it("même enveloppe de chiffrement", () => {
    vi.stubEnv("PII_ENCRYPTION_KEY", "a".repeat(64));
    const clair = new Uint8Array([1, 2, 3]);
    const a = chiffrerContenuPiece(clair);
    expect(a.subarray(0, 4)).toEqual(chiffrerPieceAuRepos(clair).subarray(0, 4));
    vi.unstubAllEnvs();
  });
});
