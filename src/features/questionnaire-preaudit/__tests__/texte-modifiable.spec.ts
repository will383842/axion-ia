/**
 * Texte de base (réglage global, table `settings`, aucune migration) et copies relues après coup
 * (2026-10-25). Lecture sans exception ; écriture assainie ; « revenir à l'origine » n'efface rien.
 */
import { beforeEach, describe, expect, it, vi } from "vitest";

const m = vi.hoisted(() => ({
  ligne: null as { value: unknown } | null,
  upsert: vi.fn(async () => ({})),
  findMany: vi.fn(),
  casse: false,
}));

vi.mock("@/lib/prisma", () => ({
  prisma: {
    setting: {
      findUnique: async () => {
        if (m.casse) throw new Error("base indisponible");
        return m.ligne;
      },
      upsert: m.upsert,
    },
    emailLog: { findMany: m.findMany },
  },
}));

import { CORPS_PAR_DEFAUT } from "@/lib/email/questionnaire-avant-audit-texte";
import {
  CLE_GABARIT_INVITATION,
  enregistrerGabaritBase,
  lireGabaritBase,
  resoudreTexte,
} from "../gabarit-invitation";
import { lireCopiesInvitation } from "../copies-envoyees";

beforeEach(() => {
  m.ligne = null;
  m.casse = false;
  m.upsert.mockClear();
  m.findMany.mockReset();
});

describe("texte de base", () => {
  it("rien en base : le texte d'origine (aucune surcharge)", async () => {
    expect(await lireGabaritBase()).toEqual({ objet: null, corps: null });
    expect(await resoudreTexte({})).toEqual({});
  });

  it("une base en panne ne casse ni l'aperçu ni l'envoi", async () => {
    m.casse = true;
    expect(await lireGabaritBase()).toEqual({ objet: null, corps: null });
  });

  it("l'enregistrement est assaini, tracé (updatedBy) et sous la bonne clé", async () => {
    await enregistrerGabaritBase(
      { objet: "Votre audit\r\nBcc: x", corps: "Texte\r\n\r\n\r\nde base" },
      "u1",
    );
    expect(m.upsert).toHaveBeenCalledOnce();
    const arg = m.upsert.mock.calls[0] as unknown as [
      { where: { key: string }; update: { value: unknown; updatedBy: string } },
    ];
    expect(arg[0].where.key).toBe(CLE_GABARIT_INVITATION);
    expect(arg[0].update).toEqual({
      value: { objet: "Votre audit Bcc: x", corps: "Texte\n\nde base" },
      updatedBy: "u1",
    });
  });

  it("revenir à l'origine écrit des valeurs vides (rien n'est supprimé)", async () => {
    await enregistrerGabaritBase({ objet: "", corps: CORPS_PAR_DEFAUT }, "u1");
    const arg = m.upsert.mock.calls[0] as unknown as [{ update: { value: unknown } }];
    expect(arg[0].update.value).toEqual({ objet: null, corps: null });
  });

  it("la base s'applique à l'envoi ; la saisie du client l'emporte", async () => {
    m.ligne = { value: { objet: "Base objet", corps: "Base corps" } };
    expect(await resoudreTexte({})).toEqual({ objetPerso: "Base objet", corpsPerso: "Base corps" });
    expect(await resoudreTexte({ objet: "Client objet", message: "Mot" })).toEqual({
      objetPerso: "Client objet",
      messagePerso: "Mot",
      corpsPerso: "Base corps",
    });
  });

  it("une valeur de base forgée (non texte) est ignorée", async () => {
    m.ligne = { value: { objet: { x: 1 }, corps: 42 } };
    expect(await lireGabaritBase()).toEqual({ objet: null, corps: null });
  });
});

describe("copies relues après coup", () => {
  it("rend objet et HTML conservés, et dit quand la copie manque", async () => {
    const d = new Date("2026-10-25T10:00:00Z");
    m.findMany.mockResolvedValue([
      {
        id: "a",
        sentAt: d,
        recipient: "c@x.fr",
        contenu: { subject: "Objet", html: "<p>Corps</p>" },
      },
      { id: "b", sentAt: d, recipient: "c@x.fr", contenu: null },
    ]);
    expect(await lireCopiesInvitation("q1")).toEqual([
      {
        emailLogId: "a",
        envoyeLe: d,
        destinataire: "c@x.fr",
        objet: "Objet",
        html: "<p>Corps</p>",
      },
      { emailLogId: "b", envoyeLe: d, destinataire: "c@x.fr", objet: null, html: null },
    ]);
    const where = (m.findMany.mock.calls[0]?.[0] as { where: Record<string, unknown> }).where;
    expect(where).toMatchObject({ template: "questionnaire-avant-audit", entityId: "q1" });
  });

  it("ne lève jamais", async () => {
    m.findMany.mockRejectedValue(new Error("x"));
    expect(await lireCopiesInvitation("q1")).toEqual([]);
  });
});
