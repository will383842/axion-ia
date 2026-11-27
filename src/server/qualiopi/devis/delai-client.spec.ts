import { describe, expect, it, vi } from "vitest";
import { filtrerChangesJournal } from "@/server/journal/journaliser";
import {
  ACTION_DELAI_CLIENT_DEMANDE,
  ACTION_DELAI_CLIENT_LEVE,
  CODES_ALERTES_SUSPENDUES_PAR_DELAI,
  bornesDelaiClient,
  debutDeJourneeParis,
  delaisClientActifs,
  finDelaiDepuisChanges,
  idsDevisEnDelaiClient,
  peutDemanderDelai,
} from "./delai-client";

const MAINTENANT = new Date("2026-07-10T10:00:00Z");

interface LigneJournal {
  targetId: string | null;
  action: string;
  changes: unknown;
  createdAt: Date;
  id: string;
}

function lecteurDe(lignes: LigneJournal[]) {
  const findMany = vi.fn(async () => lignes);
  return { lecteur: { activityLog: { findMany } }, findMany };
}

const ligne = (
  targetId: string,
  action: string,
  finDelai: unknown,
  createdAt: string,
  id: string,
) => ({
  targetId,
  action,
  changes: { finDelai },
  createdAt: new Date(createdAt),
  id,
});

describe("delai-client : constantes", () => {
  it("les actions et les codes d'alerte sont ceux de la conception", () => {
    expect(ACTION_DELAI_CLIENT_DEMANDE).toBe("qualiopi.devis.delai_client.demande");
    expect(ACTION_DELAI_CLIENT_LEVE).toBe("qualiopi.devis.delai_client.leve");
    expect([...CODES_ALERTES_SUSPENDUES_PAR_DELAI]).toEqual([
      "devis_sans_reponse",
      "devis_expire_j7",
    ]);
  });
});

describe("debutDeJourneeParis", () => {
  it("hiver, été et changements d'heure", () => {
    expect(debutDeJourneeParis(2026, 1, 15).toISOString()).toBe("2026-01-14T23:00:00.000Z");
    expect(debutDeJourneeParis(2026, 7, 15).toISOString()).toBe("2026-07-14T22:00:00.000Z");
    expect(debutDeJourneeParis(2026, 3, 29).toISOString()).toBe("2026-03-28T23:00:00.000Z");
    expect(debutDeJourneeParis(2026, 10, 25).toISOString()).toBe("2026-10-24T22:00:00.000Z");
  });
  it("le 1er du mois (d - 1 = 0)", () => {
    expect(debutDeJourneeParis(2026, 2, 1).toISOString()).toBe("2026-01-31T23:00:00.000Z");
  });
});

describe("finDelaiDepuisChanges", () => {
  it("changes illisibles ignorés", () => {
    expect(finDelaiDepuisChanges(null)).toBeNull();
    expect(finDelaiDepuisChanges({})).toBeNull();
    expect(finDelaiDepuisChanges({ finDelai: 12 })).toBeNull();
    expect(finDelaiDepuisChanges({ finDelai: "pas une date" })).toBeNull();
    expect(finDelaiDepuisChanges({ finDelai: "2026-07-17T22:00:00.000Z" })?.toISOString()).toBe(
      "2026-07-17T22:00:00.000Z",
    );
  });
});

describe("delaisClientActifs", () => {
  it("la dernière entrée gagne", async () => {
    const fin = "2026-07-17T22:00:00.000Z";
    // Triées de la plus récente à la plus ancienne (comme l'orderBy).
    const demandePuisLevee = lecteurDe([
      ligne("d1", ACTION_DELAI_CLIENT_LEVE, null, "2026-07-10T09:00:00Z", "b"),
      ligne("d1", ACTION_DELAI_CLIENT_DEMANDE, fin, "2026-07-09T09:00:00Z", "a"),
    ]);
    expect((await delaisClientActifs(demandePuisLevee.lecteur, MAINTENANT, ["d1"])).size).toBe(0);

    const leveePuisDemande = lecteurDe([
      ligne("d1", ACTION_DELAI_CLIENT_DEMANDE, fin, "2026-07-10T09:00:00Z", "b"),
      ligne("d1", ACTION_DELAI_CLIENT_LEVE, null, "2026-07-09T09:00:00Z", "a"),
    ]);
    const m = await delaisClientActifs(leveePuisDemande.lecteur, MAINTENANT, ["d1"]);
    expect(m.get("d1")?.toISOString()).toBe(fin);

    const deuxDemandes = lecteurDe([
      ligne(
        "d1",
        ACTION_DELAI_CLIENT_DEMANDE,
        "2026-07-20T22:00:00.000Z",
        "2026-07-10T09:00:00Z",
        "b",
      ),
      ligne("d1", ACTION_DELAI_CLIENT_DEMANDE, fin, "2026-07-09T09:00:00Z", "a"),
    ]);
    const m2 = await delaisClientActifs(deuxDemandes.lecteur, MAINTENANT, ["d1"]);
    expect(m2.get("d1")?.toISOString()).toBe("2026-07-20T22:00:00.000Z");
  });

  it("délai échu inactif", async () => {
    const egal = lecteurDe([
      ligne(
        "d1",
        ACTION_DELAI_CLIENT_DEMANDE,
        MAINTENANT.toISOString(),
        "2026-07-09T09:00:00Z",
        "a",
      ),
    ]);
    expect((await delaisClientActifs(egal.lecteur, MAINTENANT, ["d1"])).size).toBe(0);
    const apres = lecteurDe([
      ligne(
        "d1",
        ACTION_DELAI_CLIENT_DEMANDE,
        new Date(MAINTENANT.getTime() + 1).toISOString(),
        "2026-07-09T09:00:00Z",
        "a",
      ),
    ]);
    expect((await delaisClientActifs(apres.lecteur, MAINTENANT, ["d1"])).size).toBe(1);
  });

  it("changes illisibles ignorés sans lever", async () => {
    for (const f of [undefined, 42, "pas une date"]) {
      const { lecteur } = lecteurDe([
        ligne("d1", ACTION_DELAI_CLIENT_DEMANDE, f, "2026-07-09T09:00:00Z", "a"),
      ]);
      expect((await delaisClientActifs(lecteur, MAINTENANT, ["d1"])).size).toBe(0);
    }
  });

  it("une requête groupée bornée à 90 jours, avec et sans liste", async () => {
    const avec = lecteurDe([]);
    await delaisClientActifs(avec.lecteur, MAINTENANT, ["d1", "d2"]);
    expect(avec.findMany).toHaveBeenCalledTimes(1);
    expect(avec.findMany).toHaveBeenCalledWith({
      where: {
        action: { in: [ACTION_DELAI_CLIENT_DEMANDE, ACTION_DELAI_CLIENT_LEVE] },
        targetType: "Devis",
        createdAt: { gte: new Date(MAINTENANT.getTime() - 90 * 86_400_000) },
        targetId: { in: ["d1", "d2"] },
      },
      select: { targetId: true, action: true, changes: true, createdAt: true, id: true },
      orderBy: [{ createdAt: "desc" }, { id: "desc" }],
    });

    const sans = lecteurDe([]);
    await delaisClientActifs(sans.lecteur, MAINTENANT);
    expect(sans.findMany).toHaveBeenCalledWith({
      where: {
        action: { in: [ACTION_DELAI_CLIENT_DEMANDE, ACTION_DELAI_CLIENT_LEVE] },
        targetType: "Devis",
        createdAt: { gte: new Date(MAINTENANT.getTime() - 90 * 86_400_000) },
      },
      select: { targetId: true, action: true, changes: true, createdAt: true, id: true },
      orderBy: [{ createdAt: "desc" }, { id: "desc" }],
    });
  });

  it("liste vide : aucune requête", async () => {
    const { lecteur, findMany } = lecteurDe([]);
    const m = await delaisClientActifs(lecteur, MAINTENANT, []);
    expect(m.size).toBe(0);
    expect(findMany).not.toHaveBeenCalled();
  });

  it("idsDevisEnDelaiClient rend les devis en délai (lecture globale)", async () => {
    const { lecteur } = lecteurDe([
      ligne(
        "d1",
        ACTION_DELAI_CLIENT_DEMANDE,
        "2026-07-17T22:00:00.000Z",
        "2026-07-09T09:00:00Z",
        "a",
      ),
      ligne("d2", ACTION_DELAI_CLIENT_LEVE, null, "2026-07-09T09:00:00Z", "b"),
    ]);
    expect(await idsDevisEnDelaiClient(lecteur, MAINTENANT)).toEqual(["d1"]);
  });
});

describe("journal", () => {
  it("le filtre du journal garde finDelai, jour et numero", () => {
    const changes = {
      numero: "AXI-DEV-2026-001",
      jour: "2026-07-17",
      finDelai: "2026-07-16T22:00:00.000Z",
    };
    expect(filtrerChangesJournal(changes)).toMatchObject(changes);
  });
});

describe("bornesDelaiClient", () => {
  it("défaut = aujourd'hui + 7 jours", () => {
    expect(bornesDelaiClient(MAINTENANT, new Date("2026-12-31T22:59:59Z"))).toEqual({
      min: "2026-07-11",
      max: "2026-10-08",
      defaut: "2026-07-17",
    });
  });
  it("ramenées à la validité", () => {
    expect(bornesDelaiClient(MAINTENANT, new Date("2026-07-14T21:59:59Z"))).toEqual({
      min: "2026-07-11",
      max: "2026-07-14",
      defaut: "2026-07-14",
    });
  });
  it("nulles si la validité se termine aujourd'hui", () => {
    expect(bornesDelaiClient(MAINTENANT, new Date("2026-07-10T21:59:59Z"))).toBeNull();
  });
  it("max = 90 jours", () => {
    const b = bornesDelaiClient(MAINTENANT, new Date("2027-12-31T22:59:59Z"));
    expect(b?.max).toBe("2026-10-08");
  });
});

describe("peutDemanderDelai", () => {
  const base = {
    statut: "envoye",
    clientASigne: false,
    signeParClient: false,
    signeDesDeuxParties: false,
    repriseParRelance: false,
    peutEcrire: true,
    dateValidite: new Date("2026-07-20T21:59:59Z"),
    maintenant: MAINTENANT,
  };
  it("vrai pour un devis envoyé valide non signé", () => {
    expect(peutDemanderDelai(base)).toBe(true);
  });
  it.each([
    ["expiré", { statut: "expire" }],
    ["signé par le client", { clientASigne: true }],
    ["signé par le client (bis)", { signeParClient: true }],
    ["signé des deux parties", { signeDesDeuxParties: true }],
    ["reprise par relance", { repriseParRelance: true }],
    ["validité dépassée", { dateValidite: new Date("2026-07-09T21:59:59Z") }],
    ["sans droit d'écriture", { peutEcrire: false }],
  ])("faux : %s", (_n, over) => {
    expect(peutDemanderDelai({ ...base, ...over })).toBe(false);
  });
});
