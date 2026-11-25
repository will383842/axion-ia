// Lot L1a : les deux gabarits de résiliation sont enregistrés, mais AUCUN émetteur n'existe encore.
import { readdirSync, readFileSync, statSync } from "node:fs";
import { join, relative } from "node:path";

import { describe, expect, it } from "vitest";

import { PAYLOAD_EXEMPLE } from "@/server/email/apercu/payloads-exemple";
import { CATALOGUE } from "@/server/email/apercu/catalogue";

import { GABARITS_APPORTEUR } from "../envois";
import { GABARITS_ARGENT } from "../retrait";

const NOMS = ["apporteur-resiliation-notifiee", "apporteur-resiliation-effective"] as const;

describe("gabarits de résiliation (L1a)", () => {
  it("sont dans GABARITS_APPORTEUR", () => {
    for (const n of NOMS) expect(GABARITS_APPORTEUR).toContain(n);
  });
  it("sont dans GABARITS_ARGENT : un apporteur retiré reçoit sa propre résiliation", () => {
    for (const n of NOMS) expect(GABARITS_ARGENT.has(n)).toBe(true);
  });
  it("sont dans le catalogue d'aperçu", () => {
    for (const n of NOMS) expect(Object.keys(CATALOGUE)).toContain(n);
  });
  it("le jeu d'exemple porte les champs de la notification", () => {
    for (const c of ["fondement", "notifieeLe", "effetLe"])
      expect(PAYLOAD_EXEMPLE[c]).toBeDefined();
  });

  it("garde de non-émission : aucun fichier hors liste ne cite le nom (retirée par L1b)", () => {
    const racine = join(process.cwd(), "src");
    const permis = [
      "lib/email/templates/",
      "server/email/apercu/catalogue.ts",
      "server/queue/types.ts",
      "server/email/outbox-policy.ts",
      "features/apporteurs-reseau/envois.ts",
      "features/apporteurs-reseau/retrait.ts",
      "features/apporteurs-reseau/__tests__/gabarits-resiliation.spec.ts",
      "lib/email/templates/__tests__/",
      // Gardes qui NOMMENT les gabarits (listes figées), sans les émettre.
      "content/__tests__/remuneration-indicative.spec.ts",
      "server/email/apercu/catalogue.spec.ts",
      "server/email/apercu/payloads-exemple.spec.ts",
      "lib/email/templates/aucun-gabarit-orphelin.spec.ts",
    ];
    const fautifs: string[] = [];
    const parcourir = (d: string) => {
      for (const f of readdirSync(d)) {
        const p = join(d, f);
        if (statSync(p).isDirectory()) {
          if (f === "node_modules" || f === "generated") continue;
          parcourir(p);
        } else if (/\.(ts|tsx)$/.test(f)) {
          const rel = relative(racine, p).replace(/\\/g, "/");
          if (permis.some((x) => rel.startsWith(x))) continue;
          if (readFileSync(p, "utf8").includes("apporteur-resiliation-")) fautifs.push(rel);
        }
      }
    };
    parcourir(racine);
    expect(fautifs).toEqual([]);
  });
});
