import { beforeEach, describe, expect, it, vi } from "vitest";

// Contrat 2.7, art. 11.1 : la résiliation est NOTIFIÉE avec son préavis (30, 60, 90 jours selon
// l'ancienneté quand la Société résilie ; 30 jours quand l'Apporteur résilie ; 30 jours pour un
// contrat signé avant la 2.7). Le contrat continue pendant le préavis ; la fin s'applique à la date.
// Art. 11.2 : fin immédiate pour manquement, motivée.

const etat = vi.hoisted(() => ({
  apporteur: {
    statut: "signe",
    signatureApporteur: { version: "2.7" } as unknown,
    signeParSocieteAt: new Date("2026-10-01T10:00:00Z") as Date | null,
    noteInterne: null as string | null,
  },
  ligne: null as Record<string, unknown> | null,
  resilies: [] as Array<{ id: string; le: Date }>,
  envois: [] as Array<Record<string, unknown>>,
}));

vi.mock("@/lib/prisma", () => ({
  prisma: {
    apporteurReseau: {
      findUnique: vi.fn(async () => ({
        ...etat.apporteur,
        prenom: "Jeanne",
        nom: "Martin",
        email: "jeanne@example.fr",
      })),
      update: vi.fn(async (a: { data: { noteInterne: string } }) => {
        etat.apporteur.noteInterne = a.data.noteInterne;
        return {};
      }),
    },
    apporteurReseauResiliation: {
      findUnique: vi.fn(async () => (etat.ligne ? { ...etat.ligne } : null)),
      findMany: vi.fn(async () =>
        etat.ligne && !etat.ligne.annuleeAt && !etat.ligne.appliqueeAt
          ? [{ apporteurId: "APP1", finAt: etat.ligne.finAt }]
          : [],
      ),
      upsert: vi.fn(async (a: { create: Record<string, unknown> }) => {
        etat.ligne = { ...a.create };
        return {};
      }),
      updateMany: vi.fn(async (a: { data: Record<string, unknown> }) => {
        if (!etat.ligne || etat.ligne.annuleeAt || etat.ligne.appliqueeAt) return { count: 0 };
        etat.ligne = { ...etat.ligne, ...a.data };
        return { count: 1 };
      }),
    },
  },
}));
vi.mock("@/lib/pii-crypto", () => ({ decryptPii: (v: string | null) => v }));
vi.mock("../envois", () => ({
  envoyer: vi.fn(async (e: Record<string, unknown>) => {
    etat.envois.push(e);
    return "envoye";
  }),
}));
vi.mock("../resiliation", () => ({
  resilierApporteur: vi.fn(async (id: string, le: Date) => {
    if (etat.apporteur.statut !== "signe")
      return { ok: false, message: "Seul un contrat signé peut être résilié." };
    etat.apporteur.statut = "resilie";
    etat.resilies.push({ id, le });
    return { ok: true, message: "Contrat résilié." };
  }),
}));
vi.mock("../signaler", () => ({ signalerErreurReseau: vi.fn() }));

import {
  annulerResiliation,
  appliquerFinsDePreavis,
  finDuPreavis,
  notifierResiliation,
  preavisEchu,
  preavisJours,
  preavisProgressif,
  resilierPourManquement,
} from "../preavis";

const PRISE_EFFET = new Date("2026-10-01T10:00:00Z");
const jour = (d: Date) => d.toISOString().slice(0, 10);

beforeEach(() => {
  etat.apporteur = {
    statut: "signe",
    signatureApporteur: { version: "2.7" },
    signeParSocieteAt: PRISE_EFFET,
    noteInterne: null,
  };
  etat.ligne = null;
  etat.resilies = [];
  etat.envois = [];
});

describe("durée du préavis (art. 11.1)", () => {
  const societe = (version: string | null, notifieeLe: string) =>
    preavisJours({
      par: "societe",
      version,
      priseEffet: PRISE_EFFET,
      notifieeLe: new Date(notifieeLe),
    });

  it("Société, contrat 2.7 : 30 jours la 1re année, 60 la 2e, 90 à partir de la 3e", () => {
    expect(societe("2.7", "2026-10-09T10:00:00Z")).toBe(30);
    expect(societe("2.7", "2027-09-30T10:00:00Z")).toBe(30);
    expect(societe("2.7", "2027-10-01T10:00:00Z")).toBe(60);
    expect(societe("2.7", "2028-09-30T10:00:00Z")).toBe(60);
    expect(societe("2.7", "2028-10-01T10:00:00Z")).toBe(90);
    expect(societe("2.10", "2030-01-01T10:00:00Z")).toBe(90);
  });

  it("Société, contrat signé AVANT la 2.7 : 30 jours (texte de sa version), quelle que soit l'ancienneté", () => {
    for (const v of ["2", "2.1", "2.5", "2.6"]) expect(societe(v, "2029-01-01T10:00:00Z")).toBe(30);
    expect(preavisProgressif("2.6")).toBe(false);
    expect(preavisProgressif("2.7")).toBe(true);
  });

  it("version inconnue : le préavis le plus long (2.7), jamais plus court que le contrat", () => {
    expect(societe(null, "2028-10-01T10:00:00Z")).toBe(90);
  });

  it("l'Apporteur résilie : 30 jours, même après trois ans", () => {
    expect(
      preavisJours({
        par: "apporteur",
        version: "2.7",
        priseEffet: PRISE_EFFET,
        notifieeLe: new Date("2030-01-01T10:00:00Z"),
      }),
    ).toBe(30);
  });

  it("date de fin = jour de Paris de la notification + préavis ; échue ce jour-là", () => {
    const fin = finDuPreavis(new Date("2026-10-09T22:30:00Z"), 30); // déjà le 10 à Paris
    expect(jour(fin)).toBe("2026-11-09");
    expect(preavisEchu(fin, new Date("2026-11-08T22:00:00Z"))).toBe(false);
    expect(preavisEchu(fin, new Date("2026-11-09T06:00:00Z"))).toBe(true);
  });
});

describe("notifier, annuler, appliquer", () => {
  const CLIC = new Date("2026-10-09T10:00:00Z");

  it("la Société résilie : le contrat NE s'arrête PAS au clic ; e-mail avec la date de fin", async () => {
    const r = await notifierResiliation({ apporteurId: "APP1", par: "societe", maintenant: CLIC });
    expect(r.ok).toBe(true);
    expect(r.message).toContain("8 novembre 2026");
    expect(etat.apporteur.statut).toBe("signe");
    expect(etat.resilies).toEqual([]);
    expect(etat.ligne).toMatchObject({ par: "societe", preavisJours: 30 });
    expect(jour(etat.ligne!.finAt as Date)).toBe("2026-11-08");
    expect(etat.envois).toHaveLength(1);
    expect(etat.envois[0]).toMatchObject({
      gabarit: "apporteur-resiliation",
      payload: { cas: "societe", dateFin: "8 novembre 2026", preavisJours: 30 },
    });
    expect(etat.apporteur.noteInterne).toContain("fin du contrat le 8 novembre 2026");
  });

  it("deux notifications ne se cumulent pas", async () => {
    await notifierResiliation({ apporteurId: "APP1", par: "societe", maintenant: CLIC });
    const r = await notifierResiliation({
      apporteurId: "APP1",
      par: "apporteur",
      maintenant: CLIC,
    });
    expect(r.ok).toBe(false);
  });

  it("un contrat non signé ne se résilie pas", async () => {
    etat.apporteur.statut = "a_verifier";
    expect((await notifierResiliation({ apporteurId: "APP1", par: "societe" })).ok).toBe(false);
  });

  it("annulée avant la date : le contrat continue, l'apporteur est averti ; la fin ne s'applique jamais", async () => {
    await notifierResiliation({ apporteurId: "APP1", par: "apporteur", maintenant: CLIC });
    const a = await annulerResiliation({
      apporteurId: "APP1",
      maintenant: new Date("2026-10-20T10:00:00Z"),
    });
    expect(a.ok).toBe(true);
    expect(etat.envois[1]).toMatchObject({ payload: { cas: "annulee" } });
    expect(await appliquerFinsDePreavis(new Date("2026-12-01T10:00:00Z"))).toBe(0);
    expect(etat.apporteur.statut).toBe("signe");
  });

  it("l'annulation est refusée une fois la date de fin atteinte", async () => {
    await notifierResiliation({ apporteurId: "APP1", par: "societe", maintenant: CLIC });
    const a = await annulerResiliation({
      apporteurId: "APP1",
      maintenant: new Date("2026-11-08T07:00:00Z"),
    });
    expect(a.ok).toBe(false);
  });

  it("la fin s'applique le jour de fin, pas avant, avec les effets de « Résilier » datés de la fin", async () => {
    await notifierResiliation({ apporteurId: "APP1", par: "societe", maintenant: CLIC });
    expect(await appliquerFinsDePreavis(new Date("2026-11-07T10:00:00Z"))).toBe(0);
    expect(etat.apporteur.statut).toBe("signe");
    expect(await appliquerFinsDePreavis(new Date("2026-11-08T16:00:00Z"))).toBe(1);
    expect(etat.apporteur.statut).toBe("resilie");
    expect(jour(etat.resilies[0]!.le)).toBe("2026-11-08");
    expect(etat.ligne!.appliqueeAt).toBeInstanceOf(Date);
    // Un second passage ne refait rien.
    expect(await appliquerFinsDePreavis(new Date("2026-11-09T06:00:00Z"))).toBe(0);
  });
});

describe("fin immédiate pour manquement (art. 11.2)", () => {
  it("motif obligatoire", async () => {
    const r = await resilierPourManquement({ apporteurId: "APP1", motif: "court" });
    expect(r.ok).toBe(false);
    expect(etat.apporteur.statut).toBe("signe");
  });

  it("résilié tout de suite, motif à l'e-mail et à la note interne, préavis zéro", async () => {
    const motif = "Démarchage au nom d'Axion-IA malgré la mise en demeure du 1er octobre.";
    const r = await resilierPourManquement({
      apporteurId: "APP1",
      motif,
      maintenant: new Date("2026-10-20T10:00:00Z"),
    });
    expect(r.ok).toBe(true);
    expect(etat.apporteur.statut).toBe("resilie");
    expect(etat.ligne).toMatchObject({ par: "manquement", preavisJours: 0 });
    expect(etat.envois[0]).toMatchObject({
      gabarit: "apporteur-resiliation",
      payload: { cas: "manquement", motifResiliation: motif, dateFin: "20 octobre 2026" },
    });
    expect(etat.apporteur.noteInterne).toContain(motif);
  });
});
