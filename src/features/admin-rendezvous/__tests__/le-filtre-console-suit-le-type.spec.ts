// Le filtre console suit le TYPE de rendez-vous (2026-10-04, lot L3).
//
// « Appels réservés » et « Rendez-vous » filtrent par type (diagnostic,
// échange projet, apporteur, salon). La colonne `typeRendezVous` fait foi ;
// NULL (ligne écrite pendant le déploiement) → le nom. L'ancien `?public=`
// reste un alias : clients = diagnostic + échange projet + autre.

import { describe, it, expect, vi, beforeEach } from "vitest";

const findManyMock = vi.fn();
vi.mock("@/lib/prisma", () => ({
  prisma: { calendlyEvent: { findMany: (...a: unknown[]) => findManyMock(...a) } },
}));
vi.mock("@/lib/admin-path", () => ({
  adminPath: (_l: string, p: string) => `/fr/adm/${p}`,
}));

import { listRendezVous } from "../queries";
import { compterParType, lireFiltreType, passeLeFiltre } from "../type-rdv";

function row(
  id: string,
  eventTypeName: string,
  typeRendezVous: string | null,
  rawPayload: unknown = {},
) {
  return {
    id,
    eventTypeName,
    typeRendezVous,
    status: "scheduled",
    startTime: new Date("2026-10-08T08:00:00Z"),
    endTime: null,
    inviteeName: null,
    inviteeEmail: null,
    inviteePhone: null,
    location: null,
    rawPayload,
    notes: null,
    capturedAt: new Date("2026-10-04T08:00:00Z"),
  };
}

const AVEC_BESOIN = {
  invitee: {
    questions_and_answers: [{ question: "Quel service vous intéresse ?", answer: "Formation" }],
  },
};

const LIGNES = [
  row("diag", "Diagnostic IA", "diagnostic"),
  row("projet", "Discutons de votre projet IA", "echange_projet", AVEC_BESOIN),
  // NULL : classé par le nom (slug de l'iframe).
  row("projet-null", "premier-contact", null),
  row("apporteur", "Échange apporteur d'affaires (15 min)", "apporteur"),
  // Double verrou : nommé apporteur, mal classé → reste apporteur.
  row("apporteur-mal-classe", "Échange apporteur", "echange_projet"),
  row("salon", "Rencontre au salon GOFAB", "salon"),
  row("salon-null", "Rencontre au salon GOFAB", null),
  row("autre", "Rendez-vous perso", "autre"),
];

const ids = (rows: Array<{ sourceRecordId: string }>) => rows.map((r) => r.sourceRecordId).sort();

beforeEach(() => {
  vi.clearAllMocks();
  findManyMock.mockResolvedValue(LIGNES);
});

describe("listRendezVous — filtre par type", () => {
  it("diagnostic", async () => {
    expect(ids((await listRendezVous({ public: "diagnostic" })).rows)).toEqual(["diag"]);
  });

  it("échange projet : colonne ET repli nom quand NULL", async () => {
    expect(ids((await listRendezVous({ public: "echange_projet" })).rows)).toEqual([
      "projet",
      "projet-null",
    ]);
  });

  it("apporteur : double verrou (classé OU nommé)", async () => {
    expect(ids((await listRendezVous({ public: "apporteur" })).rows)).toEqual([
      "apporteur",
      "apporteur-mal-classe",
    ]);
  });

  it("salon : colonne ET repli nom", async () => {
    expect(ids((await listRendezVous({ public: "salon" })).rows)).toEqual(["salon", "salon-null"]);
  });

  it("alias `clients` = diagnostic + échange projet + autre (plus de salon)", async () => {
    expect(ids((await listRendezVous({ public: "clients" })).rows)).toEqual([
      "autre",
      "diag",
      "projet",
      "projet-null",
    ]);
  });

  it("alias `apporteurs` = apporteur", async () => {
    expect(ids((await listRendezVous({ public: "apporteurs" })).rows)).toEqual([
      "apporteur",
      "apporteur-mal-classe",
    ]);
  });

  it("sans filtre : tout, et les compteurs par type", async () => {
    const { rows, parType } = await listRendezVous({});
    expect(rows).toHaveLength(LIGNES.length);
    expect(parType).toEqual({ diagnostic: 1, echange_projet: 2, apporteur: 2, salon: 2, autre: 1 });
  });

  it("les compteurs ignorent le filtre de type (chaque onglet annonce son contenu)", async () => {
    const { parType } = await listRendezVous({ public: "salon" });
    expect(parType.diagnostic).toBe(1);
  });

  it("échange projet : le service choisi est porté par la ligne", async () => {
    const { rows } = await listRendezVous({ public: "echange_projet" });
    expect(rows.find((r) => r.sourceRecordId === "projet")?.besoinChoisi).toBe("Formation");
    expect(rows.find((r) => r.sourceRecordId === "projet-null")?.besoinChoisi).toBeNull();
  });
});

describe("lireFiltreType — l'URL", () => {
  it("`?type=` d'abord", () => {
    expect(lireFiltreType("salon", "apporteurs")).toBe("salon");
  });
  it("l'ancien `?public=` en alias", () => {
    expect(lireFiltreType(undefined, "clients")).toBe("clients");
    expect(lireFiltreType(undefined, "apporteurs")).toBe("apporteurs");
  });
  it("une valeur inconnue ne filtre rien", () => {
    expect(lireFiltreType("n-importe", "quoi")).toBeUndefined();
  });
});

describe("passeLeFiltre / compterParType", () => {
  it("sans filtre tout passe", () => {
    expect(passeLeFiltre("autre", undefined)).toBe(true);
  });
  it("compte zéro pour les types absents", () => {
    expect(compterParType([{ typeRendezVous: "salon" }])).toEqual({
      diagnostic: 0,
      echange_projet: 0,
      apporteur: 0,
      salon: 1,
      autre: 0,
    });
  });
});
