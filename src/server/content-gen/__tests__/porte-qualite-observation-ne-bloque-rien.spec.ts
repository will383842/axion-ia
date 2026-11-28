/**
 * Porte qualité, observation (Q7/Q8) : le branchement ne décide de rien, l'interrupteur est
 * éteint par défaut, l'écran est en lecture seule, et aucun drapeau d'écran n'est sans effet.
 */
import { readFileSync } from "node:fs";
import { describe, expect, it } from "vitest";

const lire = (p: string): string => readFileSync(p, "utf8");
const WORKER = lire("src/server/queue/workers/content-gen-worker.ts");
const PAGE = lire("src/app/[locale]/(admin)/[adminPrefix]/content-gen/porte-qualite/page.tsx");
const ACTION = lire("src/server/actions/content-gen/porte-qualite.ts");
const IO = lire("src/server/content-gen/porte-qualite-io.ts");

describe("observation de la porte qualité", () => {
  it("le worker appelle l'observation sans en lire le résultat (aucune décision)", () => {
    const appels = WORKER.match(/observerJobPorte\(/g) ?? [];
    expect(appels).toHaveLength(1);
    expect(WORKER).toMatch(
      /^\s+await observerJobPorte\(contentGenJobId, contentType, persistedOutput\);$/m,
    );
    expect(WORKER).not.toMatch(/=\s*await observerJobPorte|if\s*\(.*observerJobPorte/);
  });

  it("le drapeau est déclaré dans env.ts, en « true » exact, et lu par le back-end", () => {
    const env = lire("src/env.ts");
    expect(env).toMatch(/CONTENT_PORTE_OBSERVATION: z\.enum\(\["true", "false"\]\)\.optional\(\)/);
    expect(env).toMatch(/CONTENT_PORTE_OBSERVATION: process\.env\.CONTENT_PORTE_OBSERVATION/);
    expect(lire("src/server/content-gen/porte-qualite/observation.ts")).toMatch(
      /env\[DRAPEAU_OBSERVATION\] === "true"/,
    );
  });

  it("aucun drapeau de l'écran : l'écran ne lit aucune variable d'environnement", () => {
    expect(PAGE).not.toMatch(/process\.env/);
  });

  it("l'écran et l'action sont en lecture seule et gardés", () => {
    expect(ACTION).toMatch(/await requireAdmin\(\)/);
    for (const src of [PAGE, ACTION]) {
      expect(src).not.toMatch(/\.(create|update|upsert|delete|deleteMany|updateMany)\(/);
      expect(src).not.toMatch(/onClick|"use client"/);
    }
    // Q14 : le seul formulaire est celui des réglages, et la seule écriture passe par le
    // chokepoint audité ; l'écran ne touche jamais la liste des interdits.
    expect(PAGE.match(/<form/g)).toHaveLength(1);
    expect(PAGE).not.toMatch(/import[^;]*interdits-publication|MOTIFS_INTERDITS/);
    expect(ACTION.match(/writeContentGenConfig\(/g)).toHaveLength(1);
    expect(ACTION).not.toMatch(/import[^;]*interdits-publication|MOTIFS_INTERDITS/);
    // La seule écriture de l'accès base est la ligne de verdict.
    expect(IO.match(/\.(create|update|upsert|delete|deleteMany|updateMany)\(/g)).toEqual([
      ".create(",
    ]);
    expect(IO).toMatch(/contentQualityVerdict\.create/);
  });

  it("ne touche ni statut de job ni file de revue ni énumération", () => {
    expect(IO).not.toMatch(/contentGenJob|reviewQueue|\bArticle\b|status/);
  });
});
