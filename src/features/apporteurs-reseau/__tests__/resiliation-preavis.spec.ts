/**
 * Lot L1b : la résiliation en DEUX TEMPS. Notification (statut « signe », préavis de 30 jours en
 * 11.1), puis prise d'effet par le passage quotidien. Aucune échéance ne porte sur l'apporteur.
 */
import { beforeEach, describe, expect, it, vi } from "vitest";

const etat = vi.hoisted(() => ({
  statut: "signe" as string,
  ligne: null as Record<string, unknown> | null,
  journal: [] as Array<Record<string, unknown>>,
  majApporteur: [] as Array<Record<string, unknown>>,
  presentations: [] as Array<Record<string, unknown>>,
  majPresentations: [] as Array<Record<string, unknown>>,
  argent: false,
  tableAbsente: false,
  journalEnPanne: false,
  envois: [] as Array<{ gabarit: string; payload: Record<string, unknown> }>,
}));

vi.mock("@/lib/prisma", () => {
  const absente = () => Object.assign(new Error("absente"), { code: "P2021" });
  const prisma = {
    apporteurReseau: {
      findUnique: vi.fn(async () => ({
        id: "APP1",
        statut: etat.statut,
        prenom: "Claire",
        email: "claire@example.fr",
        versionLien: 1,
      })),
      updateMany: vi.fn(async (a: { data: Record<string, unknown> }) => {
        if (etat.statut !== "signe") return { count: 0 };
        etat.majApporteur.push(a.data);
        etat.statut = "resilie";
        return { count: 1 };
      }),
    },
    presentationEntreprise: {
      findMany: vi.fn(async () => etat.presentations),
      update: vi.fn(async (a: Record<string, unknown>) => {
        etat.majPresentations.push(a);
        return {};
      }),
    },
    apporteurResiliation: {
      findUnique: vi.fn(async () => {
        if (etat.tableAbsente) throw absente();
        return etat.ligne;
      }),
      findMany: vi.fn(async (a: { where: { effetLe: { lte: Date } } }) => {
        if (etat.tableAbsente) throw absente();
        return etat.ligne &&
          !etat.ligne.executeeAt &&
          (etat.ligne.effetLe as Date).getTime() <= a.where.effetLe.lte.getTime()
          ? [etat.ligne]
          : [];
      }),
      create: vi.fn(async (a: { data: Record<string, unknown> }) => {
        etat.ligne = { ...a.data, executeeAt: null };
        return {};
      }),
      updateMany: vi.fn(async (a: { data: Record<string, unknown> }) => {
        if (etat.ligne && "executeeAt" in a.data) etat.ligne.executeeAt = a.data.executeeAt;
        return { count: 1 };
      }),
    },
    activityLog: {
      create: vi.fn(async (a: { data: Record<string, unknown> }) => {
        if (etat.journalEnPanne) throw new Error("journal en panne");
        etat.journal.push(a.data);
        return {};
      }),
    },
    $transaction: async (cb: (tx: unknown) => unknown) => {
      // Une erreur dans la transaction ANNULE ses écritures (simulé pour la ligne et le statut).
      const avant = { ligne: etat.ligne, statut: etat.statut, journal: [...etat.journal] };
      try {
        return await cb(prisma);
      } catch (err) {
        etat.ligne = avant.ligne;
        etat.statut = avant.statut;
        etat.journal = avant.journal;
        throw err;
      }
    },
  };
  return { prisma };
});
vi.mock("../envois", () => ({
  envoyer: vi.fn(async (e: { gabarit: string; payload: Record<string, unknown> }) => {
    etat.envois.push(e);
    return "envoye";
  }),
}));
vi.mock("../retrait", () => ({ argentEnJeu: vi.fn(async () => etat.argent) }));
vi.mock("../jeton", () => ({
  urlDossier: (id: string, v: number) => `https://exemple.test/dossier/${id.toLowerCase()}/${v}`,
}));
vi.mock("@/lib/pii-crypto", () => ({ decryptPii: (v: string) => v }));

import {
  executerResiliation,
  executerResiliationsEchues as etapeResiliationsEchuesPourTest,
  notifierResiliation,
  planNotificationResiliation,
} from "../resiliation";

const J = (iso: string) => new Date(`${iso}T12:00:00Z`);
const base = { apporteurId: "APP1", adminId: "ADM1" };

beforeEach(() => {
  etat.statut = "signe";
  etat.ligne = null;
  etat.journal = [];
  etat.majApporteur = [];
  etat.presentations = [];
  etat.majPresentations = [];
  etat.argent = false;
  etat.tableAbsente = false;
  etat.journalEnPanne = false;
  etat.envois = [];
});

describe("planNotificationResiliation", () => {
  const maintenant = J("2026-12-05");
  it("11.1 notifiée le 1er décembre : effet le 31 décembre (jours de Paris)", () => {
    const p = planNotificationResiliation({
      initiative: "societe",
      fondement: "11.1",
      notifieeLe: J("2026-12-01"),
      maintenant,
    });
    expect(p).toMatchObject({ ok: true, immediat: false });
    if (p.ok) expect(p.effetLe.toISOString()).toBe("2026-12-30T23:00:00.000Z");
  });
  it("11.1 : une date d'effet plus proche est refusée", () => {
    const p = planNotificationResiliation({
      initiative: "societe",
      fondement: "11.1",
      notifieeLe: J("2026-12-01"),
      effetDemandeLe: J("2026-12-20"),
      maintenant,
    });
    expect(p.ok).toBe(false);
  });
  it("11.1 : une date plus lointaine n'est acceptée qu'à la demande de l'apporteur", () => {
    const e = {
      fondement: "11.1" as const,
      notifieeLe: J("2026-12-01"),
      effetDemandeLe: J("2027-02-01"),
      maintenant,
    };
    expect(planNotificationResiliation({ ...e, initiative: "apporteur" }).ok).toBe(true);
    expect(planNotificationResiliation({ ...e, initiative: "societe" }).ok).toBe(false);
  });
  it("11.1 : aucun motif (l'article dispense de motiver)", () => {
    expect(
      planNotificationResiliation({
        initiative: "societe",
        fondement: "11.1",
        notifieeLe: J("2026-12-01"),
        motif: "manque d'activité",
        maintenant,
      }).ok,
    ).toBe(false);
  });
  it("11.2 sans mise en demeure antérieure, ou sans motif : refus ; avec : effet immédiat", () => {
    const e = {
      initiative: "societe" as const,
      fondement: "11.2" as const,
      notifieeLe: J("2026-12-04"),
      maintenant,
    };
    expect(planNotificationResiliation({ ...e, motif: "x" }).ok).toBe(false);
    expect(
      planNotificationResiliation({ ...e, miseEnDemeureLe: J("2026-12-04"), motif: "x" }).ok,
    ).toBe(false);
    expect(planNotificationResiliation({ ...e, miseEnDemeureLe: J("2026-11-20") }).ok).toBe(false);
    expect(
      planNotificationResiliation({ ...e, miseEnDemeureLe: J("2026-11-19"), motif: "x" }),
    ).toMatchObject({ ok: true, immediat: true });
  });
  it("11.2 : la mise en demeure doit être restée sans effet 15 jours (14 jours : refus)", () => {
    const e = {
      initiative: "societe" as const,
      fondement: "11.2" as const,
      notifieeLe: J("2026-12-04"),
      motif: "x",
      maintenant,
    };
    expect(planNotificationResiliation({ ...e, miseEnDemeureLe: J("2026-11-20") }).ok).toBe(false);
    expect(planNotificationResiliation({ ...e, miseEnDemeureLe: J("2026-11-19") }).ok).toBe(true);
  });
  it("une notification antérieure de plus de 7 jours est refusée (pas d'effet rétroactif)", () => {
    const e = { initiative: "societe" as const, fondement: "11.1" as const, maintenant };
    expect(planNotificationResiliation({ ...e, notifieeLe: J("2026-11-27") }).ok).toBe(false);
    expect(planNotificationResiliation({ ...e, notifieeLe: J("2026-11-28") }).ok).toBe(true);
  });
  it("12.5 sans motif : refus", () => {
    const e = {
      initiative: "societe" as const,
      fondement: "12.5" as const,
      notifieeLe: J("2026-12-04"),
      maintenant,
    };
    expect(planNotificationResiliation(e).ok).toBe(false);
    expect(planNotificationResiliation({ ...e, motif: "radiation constatée" }).ok).toBe(true);
  });
  it("notification datée dans le futur : refus", () => {
    expect(
      planNotificationResiliation({
        initiative: "societe",
        fondement: "11.1",
        notifieeLe: J("2026-12-06"),
        maintenant,
      }).ok,
    ).toBe(false);
  });
});

describe("notifierResiliation (11.1)", () => {
  const notif = () =>
    notifierResiliation({
      ...base,
      initiative: "societe",
      fondement: "11.1",
      notifieeLe: J("2026-12-01"),
      maintenant: J("2026-12-01"),
    });

  it("le statut reste signe, les présentations sont intactes, journal et e-mail une fois", async () => {
    etat.presentations = [{ id: "r", statut: "reservee", protegeeJusquAt: null }];
    expect((await notif()).ok).toBe(true);
    expect(etat.statut).toBe("signe");
    expect(etat.majApporteur).toHaveLength(0);
    expect(etat.majPresentations).toHaveLength(0);
    expect(etat.journal).toHaveLength(1);
    expect(etat.journal[0]).toMatchObject({
      adminUserId: "ADM1",
      action: "apporteur.resiliation_notifiee",
    });
    expect(etat.envois.map((e) => e.gabarit)).toEqual(["apporteur-resiliation-notifiee"]);
    expect(etat.envois[0]!.payload).toMatchObject({ fondement: "11.1-societe", prenom: "Claire" });
    expect(etat.envois[0]!.payload).not.toHaveProperty("motif");
    expect((await notif()).ok).toBe(false);
    expect(etat.envois).toHaveLength(1);
  });

  it("une erreur d'écriture du journal annule le geste, sans e-mail", async () => {
    etat.journalEnPanne = true;
    await expect(notif()).rejects.toThrow();
    expect(etat.ligne).toBeNull();
    expect(etat.envois).toHaveLength(0);
  });

  it("le passage du 30 décembre ne résilie pas ; celui du 31 résilie une seule fois", async () => {
    await notif();
    await etapeResiliationsEchuesPourTest(J("2026-12-30"));
    expect(etat.statut).toBe("signe");
    await etapeResiliationsEchuesPourTest(J("2026-12-31"));
    expect(etat.statut).toBe("resilie");
    await etapeResiliationsEchuesPourTest(J("2026-12-31"));
    expect(etat.majApporteur).toHaveLength(1);
    expect(etat.envois.map((e) => e.gabarit)).toEqual([
      "apporteur-resiliation-notifiee",
      "apporteur-resiliation-effective",
    ]);
    expect(etat.journal.map((j) => j.action)).toEqual([
      "apporteur.resiliation_notifiee",
      "apporteur.resiliation_effective",
    ]);
  });

  it("la prise d'effet date la résiliation et la protection de l'EFFET, pas du jour du passage", async () => {
    etat.presentations = [
      { id: "c", statut: "confirmee", protegeeJusquAt: new Date("2027-06-01T00:00:00Z") },
    ];
    await notif();
    await etapeResiliationsEchuesPourTest(J("2027-01-03"));
    const effet = new Date("2026-12-30T23:00:00.000Z");
    expect(etat.majApporteur[0]).toMatchObject({ statut: "resilie", resilieAt: effet });
    expect(etat.majPresentations[0]).toMatchObject({ data: { protegeeJusquAt: effet } });
  });

  it("une résiliation en erreur ne bloque pas les suivantes ; une ligne terminale est close", async () => {
    await notif();
    etat.statut = "resilie"; // déjà résilié par ailleurs : l'exécution refuse, définitivement
    await etapeResiliationsEchuesPourTest(J("2026-12-31"));
    expect(etat.ligne!.executeeAt).toBeTruthy();
    expect(etat.envois.map((e) => e.gabarit)).toEqual(["apporteur-resiliation-notifiee"]);
  });

  it("table absente (P2021) : le passage ne lève pas", async () => {
    etat.tableAbsente = true;
    await expect(etapeResiliationsEchuesPourTest(J("2026-12-31"))).resolves.toBeUndefined();
  });
});

describe("effet immédiat (11.2, 12.5) et B1 bis", () => {
  it("12.5 : résilié aussitôt, motif journalisé, deux e-mails", async () => {
    const r = await notifierResiliation({
      ...base,
      initiative: "societe",
      fondement: "12.5",
      notifieeLe: J("2026-12-01"),
      motif: "radiation constatée",
      maintenant: J("2026-12-01"),
    });
    expect(r.ok).toBe(true);
    expect(etat.statut).toBe("resilie");
    expect(etat.journal[0]).toMatchObject({
      changes: expect.objectContaining({ motif: "radiation constatée" }),
    });
    expect(etat.envois.map((e) => e.gabarit)).toEqual([
      "apporteur-resiliation-notifiee",
      "apporteur-resiliation-effective",
    ]);
  });

  it("B1 bis : argent en jeu, le lien n'est pas révoqué et l'e-mail porte le lien", async () => {
    etat.argent = true;
    await executerResiliation("APP1", J("2026-12-31"), J("2026-12-31"));
    expect(etat.majApporteur[0]).not.toHaveProperty("versionLien");
    expect(etat.envois[0]!.payload).toMatchObject({ argentEnJeu: true });
    expect(String(etat.envois[0]!.payload.lien)).toContain("APP1".toLowerCase());
  });

  it("sans argent en jeu : lien révoqué (version +1), pas de lien dans l'e-mail", async () => {
    await executerResiliation("APP1", J("2026-12-31"), J("2026-12-31"));
    expect(etat.majApporteur[0]).toMatchObject({ versionLien: { increment: 1 } });
    expect(etat.envois[0]!.payload).not.toHaveProperty("lien");
  });
});
