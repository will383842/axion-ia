// Le passage de la file d'attente (art. 3.5), sur une base en mémoire. Regroupe les cas de passage :
// repos de 30 jours, fin d'attribution, premier rang seul informé, fenêtre échue (Q-F1), extinction.
import { beforeEach, describe, expect, it, vi } from "vitest";

import { creerFaux, D, JOUR, ligne, presentation } from "./file-attente-faux";

const m = vi.hoisted(() => ({
  occupe: false,
  envoyes: [] as Array<Record<string, unknown>>,
  resultat: "envoye" as string,
}));

vi.mock("server-only", () => ({}));
vi.mock("@/lib/prisma", () => ({ prisma: {} }));
vi.mock("@/lib/pii-crypto", () => ({
  decryptPii: (v: unknown) => v,
  encryptPii: (v: unknown) => v,
}));
vi.mock("../signaler", () => ({ signalerErreurReseau: vi.fn() }));
vi.mock("../occupation", () => ({ perimetreOccupe: vi.fn(async () => m.occupe) }));
vi.mock("../envois", () => ({
  envoyer: vi.fn(async (e: Record<string, unknown>) => {
    m.envoyes.push(e);
    return m.resultat;
  }),
}));

import { passerFileAttente } from "../file-attente";

const PRES = [presentation("P-a"), presentation("P-b")];
const bilan = () => ({ erreurs: 0 }) as { erreurs: number } & Record<string, number>;
const MAINT = D("2026-12-01T09:00:00Z");

function deuxEnAttente() {
  return creerFaux({
    file: [
      ligne({ id: "a", recueAt: D("2026-11-01T10:00:00Z") }),
      ligne({ id: "b", recueAt: D("2026-11-02T10:00:00Z") }),
    ],
    presentations: PRES,
  });
}

beforeEach(() => {
  m.occupe = false;
  m.envoyes = [];
  m.resultat = "envoye";
});

describe("file-attente-apres-les-30-jours-de-repos", () => {
  it("aucun e-mail tant que l'entreprise est occupée (repos compris), puis un e-mail au premier passage libre", async () => {
    const { etat, db } = deuxEnAttente();
    m.occupe = true; // J .. J+30 : perimetreOccupe tient déjà compte des 30 jours de repos (echueAt)
    await passerFileAttente(D("2026-12-01T09:00:00Z"), bilan(), db);
    await passerFileAttente(D("2026-12-30T09:00:00Z"), bilan(), db);
    expect(m.envoyes).toHaveLength(0);
    expect(etat.file.every((l) => l.statut === "en_attente")).toBe(true);
    m.occupe = false; // repos fini
    const t = D("2026-12-31T09:00:00Z");
    await passerFileAttente(t, bilan(), db);
    expect(m.envoyes).toHaveLength(1);
    const a = etat.file.find((l) => l.id === "a")!;
    expect(a.statut).toBe("informee");
    // Fenêtre de 15 jours à partir de cet e-mail : le jour de l'e-mail est le jour 1.
    expect((a.fenetreFinAt as Date).toISOString()).toBe("2027-01-14T22:59:59.999Z");
  });
});

describe("file-attente-fin-attribution-immediate", () => {
  it("une attribution échue libère l'entreprise : e-mail au passage suivant, sans repos", async () => {
    const { etat, db } = deuxEnAttente();
    m.occupe = true;
    await passerFileAttente(MAINT, bilan(), db);
    expect(m.envoyes).toHaveLength(0);
    m.occupe = false; // confirmee dont protegeeJusquAt est passée
    await passerFileAttente(new Date(MAINT.getTime() + JOUR), bilan(), db);
    expect(m.envoyes).toHaveLength(1);
    expect(etat.file.find((l) => l.id === "a")!.statut).toBe("informee");
  });
});

describe("file-attente-seul-le-premier-rang-est-informe", () => {
  it("un seul e-mail, au rang 1 ; le rang 2 reste en attente et ne reçoit rien aux passages suivants", async () => {
    const { etat, db } = deuxEnAttente();
    await passerFileAttente(MAINT, bilan(), db);
    await passerFileAttente(new Date(MAINT.getTime() + JOUR), bilan(), db);
    expect(m.envoyes).toHaveLength(1);
    expect(m.envoyes[0]!.entityId).toBe("P-a");
    expect(etat.file.find((l) => l.id === "b")!.statut).toBe("en_attente");
  });

  it("l'ordre est l'horodatage, pas l'ordre d'insertion", async () => {
    const { db } = creerFaux({
      file: [
        ligne({ id: "tard", presentationId: "P-b", recueAt: D("2026-11-05T10:00:00Z") }),
        ligne({ id: "tot", presentationId: "P-a", recueAt: D("2026-11-01T10:00:00Z") }),
      ],
      presentations: PRES,
    });
    await passerFileAttente(MAINT, bilan(), db);
    expect(m.envoyes[0]!.entityId).toBe("P-a");
  });
});

describe("file-attente-ne-revele-jamais-l-occupant", () => {
  it("la charge ne contient que prenom, entreprise et jusquAu", async () => {
    const { db } = deuxEnAttente();
    await passerFileAttente(MAINT, bilan(), db);
    const e = m.envoyes[0]!;
    expect(e.gabarit).toBe("apporteur-file-attente-premier-rang");
    expect(Object.keys(e.payload as object).sort()).toEqual(["entreprise", "jusquAu", "prenom"]);
    expect(e.jobId).toMatch(/^apporteur-file-attente-/);
    expect((e.payload as { jusquAu: string }).jusquAu).toBe("15 décembre 2026");
  });
});

describe("file-attente-email-pose-informee-seulement-si-parti", () => {
  it("e-mail non parti : la ligne reste en_attente, sans fenêtre ; réessayée au passage suivant", async () => {
    const { etat, db } = deuxEnAttente();
    m.resultat = "indisponible";
    await passerFileAttente(MAINT, bilan(), db);
    const a = etat.file.find((l) => l.id === "a")!;
    expect(a.statut).toBe("en_attente");
    expect(a.informeeAt).toBeNull();
    expect(a.fenetreFinAt).toBeNull();
    m.resultat = "envoye";
    await passerFileAttente(new Date(MAINT.getTime() + JOUR), bilan(), db);
    expect(a.statut).toBe("informee");
    expect(m.envoyes).toHaveLength(2);
    expect(m.envoyes[0]!.jobId).toBe(m.envoyes[1]!.jobId);
  });

  it("apporteur retiré du réseau : la ligne s'éteint et le rang suivant avance", async () => {
    const { etat, db } = deuxEnAttente();
    m.resultat = "fiche-retiree";
    await passerFileAttente(MAINT, bilan(), db);
    expect(etat.file.find((l) => l.id === "a")!.statut).toBe("eteinte");
    m.resultat = "envoye";
    await passerFileAttente(new Date(MAINT.getTime() + JOUR), bilan(), db);
    expect(etat.file.find((l) => l.id === "b")!.statut).toBe("informee");
  });
});

describe("file-attente-delai-passe", () => {
  it("J+16 : le premier rang est effacé, le second reste en attente, sans e-mail (Q-F1)", async () => {
    const { etat, db } = deuxEnAttente();
    await passerFileAttente(MAINT, bilan(), db); // informe a
    m.envoyes = [];
    const j16 = new Date(MAINT.getTime() + 16 * JOUR);
    const b = bilan();
    await passerFileAttente(j16, b, db);
    const a = etat.file.find((l) => l.id === "a")!;
    expect(a.statut).toBe("effacee");
    expect(a.clotureeAt).toEqual(j16);
    expect(etat.file.find((l) => l.id === "b")!.statut).toBe("en_attente");
    expect(m.envoyes).toHaveLength(0);
    expect(b.fileAttenteEffacees).toBe(1);
    // Passages suivants, entreprise libre : le second n'est toujours pas informé (aucune nouvelle occupation).
    await passerFileAttente(new Date(j16.getTime() + JOUR), bilan(), db);
    expect(m.envoyes).toHaveLength(0);
    expect(etat.presentations.length).toBe(2); // la présentation n'est jamais supprimée
  });

  it("à la prochaine fin d'occupation, le second rang est informé", async () => {
    const { etat, db } = deuxEnAttente();
    await passerFileAttente(MAINT, bilan(), db);
    const j16 = new Date(MAINT.getTime() + 16 * JOUR);
    await passerFileAttente(j16, bilan(), db);
    m.envoyes = [];
    // Une nouvelle présentation occupe puis libère l'entreprise.
    etat.presentations.push(
      presentation("P-n", { statut: "terminee", recueAt: new Date(j16.getTime() + 2 * JOUR) }),
    );
    await passerFileAttente(new Date(j16.getTime() + 40 * JOUR), bilan(), db);
    expect(m.envoyes).toHaveLength(1);
    expect(m.envoyes[0]!.entityId).toBe("P-b");
    expect(etat.file.find((l) => l.id === "b")!.statut).toBe("informee");
  });

  it("pendant la fenêtre, rien ne change et personne d'autre n'est informé", async () => {
    const { etat, db } = deuxEnAttente();
    await passerFileAttente(MAINT, bilan(), db);
    m.envoyes = [];
    await passerFileAttente(new Date(MAINT.getTime() + 10 * JOUR), bilan(), db);
    expect(etat.file.find((l) => l.id === "a")!.statut).toBe("informee");
    expect(m.envoyes).toHaveLength(0);
  });
});

describe("file-attente-extinction-12-mois", () => {
  it("en_attente et informee s'éteignent 12 mois après l'enregistrement, sans e-mail", async () => {
    const { etat, db } = creerFaux({
      file: [
        ligne({
          id: "a",
          recueAt: D("2026-01-10T10:00:00Z"),
          statut: "informee",
          informeeAt: D("2027-01-02T10:00:00Z"),
          fenetreFinAt: D("2027-01-30T10:00:00Z"),
        }),
        ligne({ id: "b", recueAt: D("2026-01-11T10:00:00Z") }),
      ],
      presentations: PRES,
    });
    const b = bilan();
    await passerFileAttente(D("2027-01-12T12:00:00Z"), b, db);
    expect(etat.file.map((l) => l.statut)).toEqual(["eteinte", "eteinte"]);
    expect(etat.file.every((l) => l.clotureeAt !== null)).toBe(true);
    expect(m.envoyes).toHaveLength(0);
    expect(b.fileAttenteEteintes).toBe(2);
  });

  it("la veille de l'extinction, la ligne vit encore", async () => {
    const { etat, db } = creerFaux({
      file: [ligne({ id: "a", recueAt: D("2026-01-10T10:00:00Z") })],
      presentations: PRES,
    });
    m.occupe = true;
    await passerFileAttente(D("2027-01-10T20:00:00Z"), bilan(), db);
    expect(etat.file[0]!.statut).toBe("en_attente");
  });
});

describe("file-attente — tolérance", () => {
  it("table absente (P2021) : l'étape ne fait rien et ne lève pas", async () => {
    const db = {
      declarationEnAttente: {
        findMany: async () => {
          throw Object.assign(new Error("x"), { code: "P2021" });
        },
      },
    } as never;
    await expect(passerFileAttente(MAINT, bilan(), db)).resolves.toBeUndefined();
  });
});
