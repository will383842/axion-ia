/**
 * Boilerplate presse — le document que la presse republie tel quel.
 *
 * Défaut corrigé, et verrouillé ici : `public/press/axion-ia-boilerplate-fr-en.txt`
 * était une recopie manuelle du pitch. Les deux avaient divergé — le TXT servait
 * « Axion-IA … fondé en 2024 » alors que le JSON-LD Organization publie
 * `foundingDate: "2026"` et que la société est immatriculée depuis le 30/07/2026.
 * Un journaliste qui copie-colle ne recoupe pas : la divergence sortait en article.
 *
 * Le texte vient désormais de `PRESS_PITCH` et l'identité de `resolveLegalIdentity()`.
 * Ces tests interdisent le retour des deux causes : une année de fondation dans le
 * document, et une identité légale absente alors qu'elle est renseignée.
 */

import { existsSync } from "node:fs";
import { join } from "node:path";

import { describe, it, expect, vi } from "vitest";

vi.mock("@/lib/legal-identity", () => ({
  resolveLegalIdentity: vi.fn(async () => ({
    legalName: "AXION IA SAS",
    rcsVille: "Grenoble",
    siren: "108018631",
    addressSiege: "11 Avenue Paul Verlaine, 38100 Grenoble",
    directorName: "Williams Jullin",
    directorTitle: "Président",
  })),
}));

import { GET } from "./route";
import { PRESS_PITCH } from "@/content/press";

async function body(): Promise<string> {
  const res = await GET();
  expect(res.status).toBe(200);
  return await res.text();
}

describe("GET /api/presse/boilerplate", () => {
  it("sert le pitch FR et EN mot pour mot depuis la SSOT éditoriale", async () => {
    const txt = await body();
    // Le wrap à 78 colonnes casse les lignes : on compare sur les espaces normalisés.
    const flat = txt.replace(/\s+/g, " ");
    expect(flat).toContain(PRESS_PITCH.fr.boilerplate.replace(/\s+/g, " "));
    expect(flat).toContain(PRESS_PITCH.en.boilerplate.replace(/\s+/g, " "));
  });

  it("🔴 n'annonce AUCUNE année de fondation (c'était la valeur fausse publiée)", async () => {
    const txt = await body();
    expect(txt).not.toMatch(/fond[ée]e? en \d{4}/i);
    expect(txt).not.toMatch(/founded in \d{4}/i);
  });

  it("porte l'identité légale réelle (raison sociale, RCS, SIREN, direction)", async () => {
    const txt = await body();
    expect(txt).toContain("AXION IA SAS");
    expect(txt).toContain("RCS Grenoble");
    expect(txt).toContain("SIREN 108018631");
    expect(txt).toContain("Williams Jullin, Président");
  });

  it("se télécharge sous un nom de fichier stable", async () => {
    const res = await GET();
    expect(res.headers.get("Content-Type")).toMatch(/text\/plain/);
    expect(res.headers.get("Content-Disposition")).toContain(
      'filename="axion-ia-boilerplate-fr-en.txt"',
    );
  });

  it("🔴 aucun boilerplate FIGÉ ne subsiste dans /public (la cause de la divergence)", () => {
    // Tant qu'un TXT statique existe, quelqu'un le re-liera un jour et la
    // divergence recommencera. La seule source servie doit être générée.
    expect(existsSync(join(process.cwd(), "public", "press"))).toBe(false);
  });
});
