// FAC-1 — Les clés du registre « texte validé » ne s'écrivent que par leur acte :
// l'éditeur générique des réglages les refuse.
import { describe, expect, it } from "vitest";

import { estCleProtegee } from "../interrupteurs";
import { cleTexteValide } from "@/server/email/textes-valides";

describe("les clés du registre échappent à l'éditeur générique des réglages", () => {
  it("estCleProtegee couvre le préfixe, casse ignorée", () => {
    expect(estCleProtegee(cleTexteValide("g-un"))).toBe(true);
    expect(estCleProtegee(cleTexteValide("g-un", "freelance").toUpperCase())).toBe(true);
  });
});
