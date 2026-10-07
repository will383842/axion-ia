// @vitest-environment node

/**
 * Verrou — la confirmation d'un rendez-vous part à la minute, pas aux 5 minutes.
 *
 * Mesure du 2026-10-06 en prod : réservation à 14:35, e-mail à 14:40. La
 * confirmation est envoyée par le passage `rappel-h1`, alors planifié toutes
 * les 5 minutes. Les pages promettaient « dans la minute ».
 *
 * On lit la source (la file ne se rend pas ici) : il doit y avoir UNE SEULE
 * entrée `rappel-h1`, à la minute. Deux entrées doubleraient les lectures en
 * base ; une entrée à 5 minutes ramènerait l'attente d'avant. L'ancienne
 * entrée à 5 minutes déjà dans Redis est retirée par la purge exhaustive, que
 * ce test vérifie aussi.
 */

import { readFileSync } from "node:fs";
import { join } from "node:path";
import { describe, expect, it } from "vitest";

const queues = readFileSync(join(process.cwd(), "src/server/queue/queues.ts"), "utf8");

describe("rappel-h1 : une seule entrée, à la minute", () => {
  const entrees = [...queues.matchAll(/type:\s*"rappel-h1"\s*,\s*pattern:\s*"([^"]+)"/g)];

  it("il n'existe qu'une entrée rappel-h1", () => {
    expect(entrees).toHaveLength(1);
  });

  it("elle tourne à la minute", () => {
    expect(entrees[0]?.[1]).toBe("* * * * *");
  });

  it("la purge retire toute entrée répétable qui n'est plus au programme", () => {
    expect(queues).toMatch(/calendlyPollQueue\.getRepeatableJobs\(\)/);
    expect(queues).toMatch(/wanted\.has\(`\$\{existing\.name\}\|\$\{existing\.pattern\}`\)/);
    expect(queues).toMatch(/calendlyPollQueue\.removeRepeatableByKey\(existing\.key\)/);
  });
});

describe("les pages /appel ne promettent plus « dans la minute » pour l'e-mail", () => {
  for (const f of [
    "src/app/[locale]/appel/confirme/page.tsx",
    "src/components/booking/FormulaireReservation.tsx",
  ]) {
    it(f, () => {
      const src = readFileSync(join(process.cwd(), f), "utf8");
      expect(src).not.toMatch(/(arrive|part|reçoit) dans la minute/);
    });
  }
});
