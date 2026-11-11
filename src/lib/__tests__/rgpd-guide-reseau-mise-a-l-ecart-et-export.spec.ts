// @vitest-environment node
// Lot S2 — art. 15 et 17 pour `contacts_guide_reseau` : l'export rend le prénom déchiffré et la
// preuve de la case ; l'effacement MET À L'ÉCART (merci_statut = 'ecarte'), il ne supprime RIEN.
import { describe, it, expect, vi, beforeEach } from "vitest";

type Ligne = Record<string, unknown>;
const etat = vi.hoisted(() => ({
  appels: [] as { op: string; args: unknown }[],
  lignes: [] as Ligne[],
  origines: [] as Ligne[],
}));

vi.mock("@/lib/prisma", () => ({
  prisma: {
    contactGuideReseau: {
      findMany: async (args: unknown) => {
        etat.appels.push({ op: "findMany", args });
        return etat.lignes;
      },
      updateMany: async (args: unknown) => {
        etat.appels.push({ op: "updateMany", args });
        return { count: etat.lignes.length };
      },
      deleteMany: async (args: unknown) => {
        etat.appels.push({ op: "deleteMany", args });
        return { count: 0 };
      },
    },
    guideReseauOrigine: {
      findMany: async (args: unknown) => {
        etat.appels.push({ op: "origine.findMany", args });
        return etat.origines;
      },
      updateMany: async (args: unknown) => {
        etat.appels.push({ op: "origine.updateMany", args });
        return { count: 0 };
      },
      deleteMany: async (args: unknown) => {
        etat.appels.push({ op: "origine.deleteMany", args });
        return { count: 0 };
      },
      delete: async (args: unknown) => {
        etat.appels.push({ op: "origine.delete", args });
        return {};
      },
    },
    clientContactAdresse: { findMany: async () => [] },
    rencontreParticipant: { findMany: async () => [] },
  },
}));
vi.mock("@/lib/security/email-hash", () => ({
  hashEmailForLookup: (e: string) => `h:${e.trim().toLowerCase()}`,
}));
vi.mock("@/lib/pii-crypto", () => ({
  decryptPii: (v: string) =>
    v.startsWith("enc:") ? Buffer.from(v.slice(4), "base64").toString() : v,
  encryptPii: (v: string) => v,
}));
vi.mock("@sentry/nextjs", () => ({
  captureException: () => undefined,
  captureMessage: () => undefined,
}));

import { exporterGuideReseauPour } from "@/lib/rgpd-guide-reseau";
import { effacerCibleParAdresses } from "@/lib/rgpd-erase";

beforeEach(() => {
  etat.appels.length = 0;
  etat.lignes = [
    {
      prenom: `enc:${Buffer.from("Camille").toString("base64")}`,
      mot: "GUIDE",
      reseau: "instagram",
      postRef: null,
      versionConsentement: "page-guide-2026-11-08",
      consentEmpreinte: "a".repeat(64),
      consentiLe: new Date("2026-11-08T10:00:00Z"),
      merciStatut: "a_envoyer",
      preuveStatut: "confirmee",
      preuveConfirmeeLe: new Date("2026-11-08T12:00:00Z"),
      preuveEcarteeLe: null,
      jetonEmpreinte: "j".repeat(64),
      convRef: "c".repeat(64),
    },
  ];
  etat.origines = [
    {
      mot: "GUIDE",
      reseau: "instagram",
      guide: "guide-ia",
      postRef: "post_12345678",
      compte: "axion_ia",
      famille: "guide_reseau",
      occurredAt: new Date("2026-11-08T10:00:00Z"),
      archiveeLe: null,
      commentaireRefHmac: "h".repeat(64),
      cleDedoublonnage: "d".repeat(64),
      emailKey: "h:personne@example.test",
    },
  ];
  vi.spyOn(console, "warn").mockImplementation(() => undefined);
});

describe("contacts_guide_reseau — export art. 15", () => {
  it("rend l'état de la preuve de l'accord et ses deux dates ; NULL se lit « en_attente »", async () => {
    const r = await exporterGuideReseauPour("personne@example.test");
    expect(r.contacts[0]).toMatchObject({
      preuve: "confirmee",
      preuveConfirmeeLe: new Date("2026-11-08T12:00:00Z"),
      preuveEcarteeLe: null,
    });
    etat.lignes = [{ ...etat.lignes[0]!, preuveStatut: null, preuveConfirmeeLe: null }];
    const nul = await exporterGuideReseauPour("personne@example.test");
    expect(nul.contacts[0]).toMatchObject({ preuve: "en_attente" });
  });

  it("rend le prénom déchiffré et la preuve de la case, jamais l'empreinte du jeton ni la conversation", async () => {
    const r = await exporterGuideReseauPour("personne@example.test");
    expect(r.contacts).toHaveLength(1);
    expect(r.contacts[0]).toMatchObject({
      prenom: "Camille",
      versionTexteCase: "page-guide-2026-11-08",
      remerciement: "a_envoyer",
    });
    const texte = JSON.stringify(r);
    expect(texte).not.toContain("j".repeat(64));
    expect(texte).not.toContain("c".repeat(64));
    expect(etat.appels[0]!.args).toMatchObject({ where: { emailKey: "h:personne@example.test" } });
  });
});

describe("guide_reseau_origines — export art. 15", () => {
  it("rend mot, réseau, guide, post, compte, famille et dates, sans l'empreinte HMAC du commentaire", async () => {
    const r = await exporterGuideReseauPour("personne@example.test");
    expect(r.origines).toHaveLength(1);
    expect(r.origines[0]).toEqual({
      mot: "GUIDE",
      reseau: "instagram",
      guide: "guide-ia",
      postRef: "post_12345678",
      compte: "axion_ia",
      famille: "guide_reseau",
      occurredAt: new Date("2026-11-08T10:00:00Z"),
      archiveeLe: null,
    });
    const texte = JSON.stringify(r);
    expect(texte).not.toContain("h".repeat(64));
    expect(texte).not.toContain("d".repeat(64));
    const lecture = etat.appels.find((a) => a.op === "origine.findMany");
    expect(lecture?.args).toMatchObject({ where: { emailKey: "h:personne@example.test" } });
  });
});

describe("contacts_guide_reseau — effacement art. 17 : mise à l'écart", () => {
  it("passe merci_statut à 'ecarte', ne supprime rien, même sans fiche personne", async () => {
    await effacerCibleParAdresses(["personne@example.test"]);
    const maj = etat.appels.find((a) => a.op === "updateMany");
    expect(maj?.args).toMatchObject({
      where: { emailKey: { in: ["h:personne@example.test"] } },
      data: { merciStatut: "ecarte" },
    });
    expect(etat.appels.some((a) => a.op === "deleteMany")).toBe(false);
  });

  it("ne supprime ni ne modifie les origines (guide_reseau_origines)", async () => {
    await effacerCibleParAdresses(["personne@example.test"]);
    expect(
      etat.appels.some((a) => a.op === "origine.deleteMany" || a.op === "origine.delete"),
    ).toBe(false);
    expect(etat.appels.some((a) => a.op === "origine.updateMany")).toBe(false);
  });

  it("n'écrit aucune adresse ni prénom au journal", async () => {
    const warn = vi.spyOn(console, "warn");
    await effacerCibleParAdresses(["personne@example.test"]);
    const tout = warn.mock.calls.map((c) => c.join(" ")).join("\n");
    expect(tout).not.toContain("example.test");
    expect(tout).not.toContain("Camille");
  });
});
