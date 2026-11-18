/**
 * Garde : les graines `careers-gen/*.json` (texte des offres d'emploi, repoussé en base par
 * `seed-careers-offers.ts`) ne doivent plus contenir de mention de financement — sinon un seed
 * les remettrait en ligne. Garde aussi le générateur de blog (`careers-gen` n'est pas le seul
 * chemin : les motifs interdits du générateur sont dans `motifs-interdits-generateur.ts`).
 */
import fs from "node:fs";
import path from "node:path";
import { describe, expect, it } from "vitest";
import { estVisee } from "@/server/content-gen/retrait-financement/regles";
import { MOTIFS_INTERDITS_GENERATEUR } from "@/server/content-gen/retrait-financement/motifs-interdits-generateur";

const DOSSIER = path.join(process.cwd(), "careers-gen");
const fichiers = fs
  .readdirSync(DOSSIER)
  .filter((f) => f.endsWith(".json") && f !== "careers-images.json");

function chaines(v: unknown, sortie: string[] = []): string[] {
  if (typeof v === "string") sortie.push(v);
  else if (Array.isArray(v)) v.forEach((x) => chaines(x, sortie));
  else if (v && typeof v === "object") Object.values(v).forEach((x) => chaines(x, sortie));
  return sortie;
}

describe("careers-gen/*.json : aucun motif de financement", () => {
  it("le dossier n'est pas vide", () => expect(fichiers.length).toBeGreaterThan(30));
  it.each(fichiers)("%s", (f) => {
    const contenu = JSON.parse(fs.readFileSync(path.join(DOSSIER, f), "utf8")) as unknown;
    for (const texte of chaines(contenu)) {
      const plain = texte.replace(/<[^>]+>/g, " ");
      for (const phrase of plain.split(/(?<=[.!?…])\s+/))
        expect(estVisee(phrase), phrase).toBe(false);
      expect(plain).not.toMatch(MOTIFS_INTERDITS_GENERATEUR);
    }
  });
});

describe("les offres de financement ne reviennent pas par un seed", () => {
  it("seed-careers-offers.ts saute les slugs archivés", () => {
    const src = fs.readFileSync(
      path.join(process.cwd(), "scripts", "seed-careers-offers.ts"),
      "utf8",
    );
    expect(src).toContain("SLUGS_OFFRES_ARCHIVEES");
  });
  it("careers-offres-seed.yml ne les propose plus par défaut", () => {
    const yml = fs.readFileSync(
      path.join(process.cwd(), ".github", "workflows", "careers-offres-seed.yml"),
      "utf8",
    );
    for (const s of [
      "assistant-financements",
      "assistant-dossiers-financement-clients",
      "charge-subventions",
    ])
      expect(yml).not.toContain(s);
  });
});
