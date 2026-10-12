/**
 * L-INV — la carte « Invitation à l'échange » de la candidature et le geste « J'ai répondu
 * ailleurs » lisent la même règle que le balayage F1 : `invitation_auto` ET
 * `suivi_echange`. Une seule des deux allumée : rien n'apparaît.
 */
import { beforeEach, describe, expect, it, vi } from "vitest";

const lignes = vi.hoisted(() => ({ valeur: [] as Array<{ key: string; value: unknown }> }));
const enPanne = vi.hoisted(() => ({ valeur: false }));

vi.mock("@/lib/prisma", () => ({
  prisma: {
    setting: {
      findMany: vi.fn(async (q: { where: { key: { startsWith?: string; in?: string[] } } }) => {
        if (enPanne.valeur) throw new Error("base");
        const k = q.where.key;
        return lignes.valeur.filter((l) =>
          k.in ? k.in.includes(l.key) : l.key.startsWith(k.startsWith ?? ""),
        );
      }),
    },
  },
}));

import { invitationAutoFormateursAllumee } from "../etats-entree";

function poser(invitationAuto: boolean, suiviEchange: boolean) {
  lignes.valeur = [
    { key: "formateurs.invitation_auto", value: { actif: invitationAuto } },
    { key: "formateurs.suivi_echange", value: { actif: suiviEchange } },
  ];
}

beforeEach(() => {
  enPanne.valeur = false;
  lignes.valeur = [];
});

describe("l'invitation automatique exige ses deux clés", () => {
  it("absentes : coupée", async () => {
    expect(await invitationAutoFormateursAllumee()).toBe(false);
  });
  it("`invitation_auto` seule : coupée", async () => {
    poser(true, false);
    expect(await invitationAutoFormateursAllumee()).toBe(false);
  });
  it("`suivi_echange` seule : coupée", async () => {
    poser(false, true);
    expect(await invitationAutoFormateursAllumee()).toBe(false);
  });
  it("les deux : allumée", async () => {
    poser(true, true);
    expect(await invitationAutoFormateursAllumee()).toBe(true);
  });
  it("base muette : coupée", async () => {
    poser(true, true);
    enPanne.valeur = true;
    expect(await invitationAutoFormateursAllumee()).toBe(false);
  });
});
