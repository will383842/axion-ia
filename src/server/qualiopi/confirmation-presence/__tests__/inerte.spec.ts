/**
 * QNC NC6, lot présence — qui peut appeler le dossier `confirmation-presence/`.
 *
 * Lot 1/3 : le socle était INERTE, aucun appelant. Lot 2/3 : trois appelants, et seulement
 * eux — le passage horaire du worker (envois), l'action publique (réponse) et la page de
 * réponse. Tout autre fichier de production qui l'importe doit d'abord être ajouté ICI, à
 * la main : c'est ce qui empêche un second chemin d'envoi de naître sans que le lot le sache.
 *
 * Le motif cherche `confirmation-presence` dans une INSTRUCTION d'import (alias `@/...`,
 * relatif `../confirmation-presence/...`, ou `import()` dynamique), pas seulement le chemin
 * complet `qualiopi/confirmation-presence` : un import relatif échappait à l'ancien motif.
 */

import { readdirSync, readFileSync, statSync } from "node:fs";
import { join } from "node:path";
import { describe, expect, it } from "vitest";

const RACINE = join(process.cwd(), "src");
const DOSSIER = join("src", "server", "qualiopi", "confirmation-presence");

function fichiers(dossier: string): string[] {
  const out: string[] = [];
  for (const e of readdirSync(dossier)) {
    const p = join(dossier, e);
    if (statSync(p).isDirectory()) {
      if (e === "node_modules" || e === ".next") continue;
      out.push(...fichiers(p));
    } else if (/\.(ts|tsx)$/.test(e)) out.push(p);
  }
  return out;
}

describe("confirmation de présence : qui l appelle", () => {
  const tous = fichiers(RACINE);

  it("lit bien un corpus non vide", () => {
    expect(tous.length).toBeGreaterThan(500);
  });

  /** Les SEULS fichiers de production hors du dossier qui l'importent (lot 2/3). */
  const AUTORISES = [
    "src/server/queue/workers/qualiopi-formation-crons-worker.ts",
    "src/server/actions/qualiopi/presence-public.ts",
    "src/app/[locale]/portail/presence/[token]/page.tsx",
  ];

  const IMPORT = /(?:from\s+|import\(\s*|import\s+)["'][^"']*confirmation-presence/;

  it("seuls le worker, l'action publique et la page importent le dossier", () => {
    const appelants = tous
      .filter((f) => !f.includes(DOSSIER))
      // Les tests importent ce qu'ils testent ; ils n'ajoutent aucun chemin d'envoi.
      .filter((f) => !/\.(spec|test)\.tsx?$/.test(f))
      .filter((f) => IMPORT.test(readFileSync(f, "utf8")))
      .map((f) => f.replace(/\\/g, "/").replace(`${process.cwd().replace(/\\/g, "/")}/`, ""))
      .sort();
    expect(appelants).toEqual([...AUTORISES].sort());
  });

  it("le motif voit un import relatif, alias ou dynamique", () => {
    expect(IMPORT.test('import { x } from "../confirmation-presence/envois";')).toBe(true);
    expect(IMPORT.test('import { x } from "@/server/qualiopi/confirmation-presence/envois";')).toBe(
      true,
    );
    expect(
      IMPORT.test('const m = await import("@/server/qualiopi/confirmation-presence/envois");'),
    ).toBe(true);
    expect(IMPORT.test('source: "server/qualiopi/confirmation-presence/envois.ts",')).toBe(false);
  });

  it("seuls envois.ts et reponse.ts écrivent ; le reste du dossier reste pur", () => {
    const ECRIVAINS = ["envois.ts", "reponse.ts"];
    const sources = tous
      .filter((f) => f.includes(DOSSIER) && !f.includes("__tests__"))
      .filter((f) => !ECRIVAINS.some((e) => f.replace(/\\/g, "/").endsWith(`/${e}`)))
      .map((f) => readFileSync(f, "utf8"));
    expect(sources.length).toBeGreaterThan(0);
    for (const s of sources) {
      expect(s).not.toMatch(/from\s+["']@\/lib\/prisma["']/);
      expect(s).not.toMatch(/enqueueEmail|\.create\(|\.update\(|\.upsert\(/);
    }
  });

  it("envois.ts n'importe rien de Next et charge enqueueEmail à la demande (atteint par le worker)", () => {
    const source = readFileSync(join(DOSSIER, "envois.ts"), "utf8");
    expect(source).not.toMatch(/from\s+["']next(\/|["'])/);
    expect(source).not.toMatch(/^import[^\n]*@\/server\/queue\/queues/m);
    expect(source).toMatch(/await import\(["']@\/server\/queue\/queues["']\)/);
  });
});
