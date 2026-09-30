// @vitest-environment node
/**
 * ⛔ UN SEUL PORT AUDIO, ET IL GARDE LE PRÉFIXE `visio-audio/`.
 *
 * Le circuit du compte rendu avait son propre adaptateur R2
 * (`stockageLectureR2`), à côté de `stockageR2` (PR 5) — et son `supprimer`
 * n'avait PAS la garde du préfixe : une clé fautive en base aurait fait
 * supprimer n'importe quel objet du seau. Il n'y a plus qu'un port,
 * `StockageAudio`, complété par `lire` et `existe`, et chaque accès exige le
 * préfixe.
 *
 * Mutations qui rougissent : retirer `exigerPrefixe` d'une méthode de
 * `stockageR2` ; redonner à `depot-donnees.ts` un accès direct à R2.
 * Contre-témoin : une clé du dépôt audio passe.
 */

import { readFileSync } from "node:fs";
import path from "node:path";
import { describe, expect, it, vi } from "vitest";

const appels: string[] = [];
vi.mock("@/lib/r2-storage", () => ({
  isR2Configured: () => true,
  uploadToR2: async (k: string) => void appels.push(`depot:${k}`),
  deleteFromR2: async (k: string) => void appels.push(`suppression:${k}`),
  getObjectBufferR2: async (k: string) => (appels.push(`lecture:${k}`), Buffer.from("x")),
  existsInR2: async (k: string) => (appels.push(`existe:${k}`), false),
}));

import { PREFIXE_AUDIO, stockageR2 } from "../stockage-audio";

describe("un seul port audio garde le préfixe", () => {
  it("aucune méthode n'atteint R2 hors du préfixe `visio-audio/`", async () => {
    appels.length = 0;
    const cle = "uploads/facture-2026.pdf";
    await expect(stockageR2.supprimer(cle)).rejects.toThrow(/préfixe/);
    await expect(stockageR2.lire(cle)).rejects.toThrow(/préfixe/);
    await expect(stockageR2.existe(cle)).rejects.toThrow(/préfixe/);
    await expect(stockageR2.deposer(cle, Buffer.from("x"))).rejects.toThrow(/préfixe/);
    expect(appels).toEqual([]);
  });

  it("contre-témoin : une clé du dépôt audio passe", async () => {
    appels.length = 0;
    const cle = `${PREFIXE_AUDIO}abc/client/0000/00000.bin`;
    await stockageR2.supprimer(cle);
    expect(await stockageR2.existe(cle)).toBe(false);
    expect(appels).toEqual([`suppression:${cle}`, `existe:${cle}`]);
  });

  it("le circuit n'a pas d'accès R2 à lui : il passe par ce port", () => {
    for (const f of ["../depot-donnees.ts", "../circuit.ts", "../purge-audio.ts"]) {
      const src = readFileSync(path.resolve(__dirname, f), "utf8");
      expect(src, f).not.toMatch(/@\/lib\/r2-storage/);
    }
    expect(readFileSync(path.resolve(__dirname, "../depot-donnees.ts"), "utf8")).toMatch(
      /stockage: LectureAudio = stockageR2/,
    );
  });
});
