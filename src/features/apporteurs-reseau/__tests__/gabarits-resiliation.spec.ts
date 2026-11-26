// Lot L1a : les deux gabarits de résiliation sont enregistrés (leur émetteur arrive en L1b ; la garde
// de non-émission a été retirée avec lui).
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
});
