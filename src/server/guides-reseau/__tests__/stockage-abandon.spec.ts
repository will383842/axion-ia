// @vitest-environment node
// (a) Le dépôt sur le volume n'écrit RIEN une fois le rendu abandonné (délai de 60 s dépassé). Disque temporaire, aucun réseau.
import { describe, it, expect, beforeEach, afterEach } from "vitest";
import { mkdtemp, rm, readdir, stat } from "node:fs/promises";
import os from "node:os";
import path from "node:path";
import { ouvrirStockage } from "../stockage-guides";

let racine = "";
beforeEach(async () => {
  racine = await mkdtemp(path.join(os.tmpdir(), "guides-abandon-"));
});
afterEach(async () => {
  await rm(racine, { recursive: true, force: true });
});
const env = () => ({ GUIDES_RESEAU_STOCKAGE: "volume", GUIDES_RESEAU_VOLUME: racine });

async function fichiers(dir: string): Promise<string[]> {
  const sortie: string[] = [];
  for (const e of await readdir(dir, { withFileTypes: true }).catch(() => [])) {
    const chemin = path.join(dir, e.name);
    if (e.isDirectory()) sortie.push(...(await fichiers(chemin)));
    else sortie.push(chemin);
  }
  return sortie;
}

describe("stockage volume — abandon", () => {
  it("abandonné AVANT le dépôt : aucun fichier, aucun temporaire", async () => {
    const st = ouvrirStockage(env());
    expect(st?.mode).toBe("volume");
    await st!.deposer("gde-essai-01/v1.pdf", Buffer.from("%PDF-"), () => true);
    expect(await fichiers(racine)).toEqual([]);
  });
  it("sans abandon : le fichier est bien rangé", async () => {
    const st = ouvrirStockage(env());
    await st!.deposer("gde-essai-01/v1.pdf", Buffer.from("%PDF-"), () => false);
    expect((await stat(path.join(racine, "gde-essai-01/v1.pdf"))).size).toBe(5);
  });
});
