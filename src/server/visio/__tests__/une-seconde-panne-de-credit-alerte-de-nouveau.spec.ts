/**
 * ⛔ UNE SECONDE PANNE DE CRÉDIT ALERTE DE NOUVEAU (V2, M4).
 *
 * Pour un code sans résolution automatique (tous les `visio.*`),
 * `creerOuDedup` ne recrée pas une alerte FERMÉE qui porte le même message.
 * Les messages du circuit étaient fixes (« Rechargez le crédit OpenAI… ») :
 * en novembre l'alerte part, Will recharge et la ferme ; en février le crédit
 * s'épuise de nouveau, TOUT le circuit se suspend… et rien ne le dit. Même
 * chose pour « un compte rendu attend votre validation », fermée à la
 * validation : la version suivante de la même rencontre n'était plus annoncée.
 *
 * Désormais chaque alerte du circuit porte l'instant du constat : un fait
 * nouveau a un message nouveau. Tant qu'elle est ouverte, l'anti-doublon
 * (code, cible) la garde unique.
 *
 * Mutation qui rougit : retirer la date de `alerterParLaConsole` (1er cas).
 * Contre-témoin : deux constats pendant que l'alerte est ouverte n'en font
 * qu'une (2e cas).
 */

import { describe, expect, it, vi } from "vitest";

const base = vi.hoisted(() => ({ db: null as unknown }));
vi.mock("@/lib/prisma", () => ({
  prisma: new Proxy({}, { get: (_c, nom: string) => (base.db as Record<string, unknown>)[nom] }),
}));
vi.mock("@/server/qualiopi/alertes/evaluateur", () => ({
  evaluerAlertesDetaille: vi.fn(),
}));

import { CODES_ALERTES_CIRCUIT } from "../alertes-circuit";
import { alerterParLaConsole } from "../circuit";
import { fausseBase } from "../../../../tests/outils/fixtures-enregistreur";

const QUOTA = {
  code: CODES_ALERTES_CIRCUIT.circuitSuspendu,
  niveau: "critique" as const,
  titre: "Circuit visio suspendu : crédit OpenAI épuisé",
  message: "Rechargez le crédit OpenAI, puis cliquez « Reprendre » sur l'état du circuit.",
  rencontreId: null,
};

describe("une seconde panne de crédit alerte de nouveau", () => {
  it("créée, résolue par Will, puis une nouvelle panne : une nouvelle alerte", async () => {
    const db = fausseBase();
    base.db = db;
    await alerterParLaConsole(QUOTA, new Date("2026-11-03T09:00:00Z"));
    for (const a of db.lignes("alerteSysteme")) a["resolue"] = true;
    await alerterParLaConsole(QUOTA, new Date("2027-02-10T15:30:00Z"));
    const alertes = db.lignes("alerteSysteme");
    expect(alertes).toHaveLength(2);
    expect(alertes.filter((a) => a["resolue"] === false)).toHaveLength(1);
  });

  it("contre-témoin : deux constats pendant que l'alerte est ouverte n'en font qu'une", async () => {
    const db = fausseBase();
    base.db = db;
    await alerterParLaConsole(QUOTA, new Date("2026-11-03T09:00:00Z"));
    await alerterParLaConsole(QUOTA, new Date("2026-11-03T09:05:00Z"));
    expect(db.lignes("alerteSysteme")).toHaveLength(1);
  });
});
