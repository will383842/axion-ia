/**
 * QNC NC6, lot présence 2/3 — la réponse du stagiaire (B3). C'est la SEULE écriture de la
 * page publique : tout refus doit se faire SANS écriture, et la dernière réponse compte.
 */

import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

interface Remise {
  id: string;
  nature: string;
  objet: string;
  survenuLe: Date;
}

const h = vi.hoisted(() => ({
  etat: "actif" as string | null,
  inscription: true,
  sessionStatut: "planifiee",
  estTestInterne: false,
  debut: new Date("2026-10-26T00:00:00Z"),
  remises: [] as Array<{ id: string; nature: string; objet: string; survenuLe: Date }>,
}));

vi.mock("@/lib/prisma", () => {
  const prisma = {
    setting: {
      findUnique: vi.fn(async () => (h.etat === null ? null : { value: { etat: h.etat } })),
    },
    enrollment: {
      findFirst: vi.fn(async () =>
        h.inscription
          ? {
              id: "11111111-1111-4111-8111-111111111111",
              sessionId: "ses-1",
              session: {
                statut: h.sessionStatut,
                estTestInterne: h.estTestInterne,
                titreSession: "Piloter son activité avec l'IA",
                dateDebut: h.debut,
                jours: [{ date: h.debut, heureDebut: "09:00", heureFin: "17:00" }],
              },
              remisesRetours: [...h.remises],
            }
          : null,
      ),
    },
    remiseRetour: {
      create: vi.fn(async (a: { data: Record<string, unknown> }) => {
        const ligne = {
          id: `rep-${h.remises.length + 1}`,
          nature: a.data["nature"] as string,
          objet: a.data["objet"] as string,
          survenuLe: new Date(),
        };
        h.remises.push(ligne);
        return ligne;
      }),
    },
  };
  return { prisma };
});

import { prisma } from "@/lib/prisma";
import { signMagicToken } from "@/lib/magic-token";
import { emettreJetonPresence } from "../jeton";
import { enregistrerReponsePresence, lireEtatPresence } from "../reponse";

const INSCRIPTION = "11111111-1111-4111-8111-111111111111";
const db = prisma as unknown as {
  enrollment: { findFirst: ReturnType<typeof vi.fn> };
  remiseRetour: { create: ReturnType<typeof vi.fn> };
};
const DEMANDE: Remise = {
  id: "demande-1",
  nature: "remise",
  objet: "presence_confirmation",
  survenuLe: new Date("2026-10-23T08:00:00Z"),
};

let jeton: string;

beforeEach(async () => {
  vi.clearAllMocks();
  process.env["AUTH_SECRET"] = "secret-de-test-presence";
  delete process.env["DATABASE_URL"];
  vi.useFakeTimers();
  vi.setSystemTime(new Date("2026-10-24T10:00:00Z"));
  h.etat = "actif";
  h.inscription = true;
  h.sessionStatut = "planifiee";
  h.estTestInterne = false;
  h.debut = new Date("2026-10-26T00:00:00Z");
  h.remises = [{ ...DEMANDE }];
  jeton = await emettreJetonPresence(INSCRIPTION, new Date("2026-10-26T08:00:00Z"));
});
afterEach(() => vi.useRealTimers());

describe("refus : jamais d'écriture", () => {
  it("jeton forgé", async () => {
    const [payload] = jeton.split(".");
    for (const t of [`${payload}.AAAA`, "n-importe-quoi", ""]) {
      const r = await enregistrerReponsePresence(t, "oui");
      expect(r.ok).toBe(false);
    }
    expect(db.remiseRetour.create).not.toHaveBeenCalled();
  });

  it("jeton d'un autre scope (émargement)", async () => {
    const autre = await signMagicToken({ scope: "emargement", resourceId: INSCRIPTION });
    expect((await enregistrerReponsePresence(autre, "oui")).ok).toBe(false);
    expect(db.remiseRetour.create).not.toHaveBeenCalled();
  });

  it("jeton expiré", async () => {
    vi.setSystemTime(new Date("2026-10-26T08:00:01Z"));
    expect((await enregistrerReponsePresence(jeton, "oui")).ok).toBe(false);
    expect(db.remiseRetour.create).not.toHaveBeenCalled();
  });

  it("inscription sortie (abandon, exclusion) ou stagiaire effacé", async () => {
    h.inscription = false;
    expect((await enregistrerReponsePresence(jeton, "oui")).ok).toBe(false);
    expect(db.remiseRetour.create).not.toHaveBeenCalled();
    // Le filtre est celui des inscrits actifs, pas une copie.
    const where = db.enrollment.findFirst.mock.calls[0]?.[0].where;
    expect(JSON.stringify(where)).toContain("abandon");
    expect(where.id).toBe(INSCRIPTION);
  });

  it("session commencée (même avec un jeton encore valide)", async () => {
    const long = await signMagicToken({
      scope: "presence_confirmation",
      resourceId: INSCRIPTION,
      ttlMs: 30 * 24 * 3_600_000,
    });
    // 09 h Paris = 08 h UTC le 26/10 ; on est à 08 h 30.
    vi.setSystemTime(new Date("2026-10-26T08:30:00Z"));
    const r = await enregistrerReponsePresence(long, "oui");
    expect(r).toEqual({ ok: false, raison: "session_commencee" });
    expect(db.remiseRetour.create).not.toHaveBeenCalled();
  });

  it("session qui n'est plus planifiée", async () => {
    h.sessionStatut = "annulee";
    expect((await enregistrerReponsePresence(jeton, "oui")).ok).toBe(false);
    expect(db.remiseRetour.create).not.toHaveBeenCalled();
  });

  it("lot éteint, ou en essai sur une session réelle", async () => {
    h.etat = null;
    expect(await enregistrerReponsePresence(jeton, "oui")).toEqual({
      ok: false,
      raison: "lot_inactif",
    });
    h.etat = "essai";
    expect((await enregistrerReponsePresence(jeton, "oui")).ok).toBe(false);
    expect(db.remiseRetour.create).not.toHaveBeenCalled();
  });

  it("aucune demande envoyée : rien à lier, rien d'écrit", async () => {
    h.remises = [];
    expect((await enregistrerReponsePresence(jeton, "oui")).ok).toBe(false);
    expect(db.remiseRetour.create).not.toHaveBeenCalled();
  });
});

describe("enregistrement", () => {
  it("écrit une ligne `reponse` liée à la demande, avec un libellé lisible", async () => {
    const r = await enregistrerReponsePresence(jeton, "oui");
    expect(r).toEqual({ ok: true, enregistre: true, reponse: "oui" });
    expect(db.remiseRetour.create).toHaveBeenCalledTimes(1);
    const data = db.remiseRetour.create.mock.calls[0]?.[0].data;
    expect(data).toMatchObject({
      sessionId: "ses-1",
      enrollmentId: INSCRIPTION,
      nature: "reponse",
      remiseId: "demande-1",
      objet: "presence_confirmation:oui",
      destinataire: "stagiaire",
    });
    expect(data.libelle).toMatch(/présent/i);
    expect(data.libelle.length).toBeLessThanOrEqual(300);
  });

  it("le même choix deux fois : une seule ligne", async () => {
    await enregistrerReponsePresence(jeton, "non");
    const r = await enregistrerReponsePresence(jeton, "non");
    expect(r).toEqual({ ok: true, enregistre: false, reponse: "non" });
    expect(db.remiseRetour.create).toHaveBeenCalledTimes(1);
  });

  it("oui puis non : deux lignes, toutes deux liées à la demande ; la dernière compte", async () => {
    await enregistrerReponsePresence(jeton, "oui");
    vi.setSystemTime(new Date("2026-10-24T11:00:00Z"));
    await enregistrerReponsePresence(jeton, "non");
    expect(db.remiseRetour.create).toHaveBeenCalledTimes(2);
    const objets = db.remiseRetour.create.mock.calls.map((c) => c[0].data.objet);
    expect(objets).toEqual(["presence_confirmation:oui", "presence_confirmation:non"]);
    for (const c of db.remiseRetour.create.mock.calls) {
      expect(c[0].data.remiseId).toBe("demande-1");
    }
    const etat = await lireEtatPresence(jeton);
    expect(etat).toMatchObject({ ok: true, derniereReponse: "non" });
  });

  it("non puis oui puis non : trois lignes", async () => {
    for (const choix of ["non", "oui", "non"] as const) {
      vi.advanceTimersByTime(60_000);
      await enregistrerReponsePresence(jeton, choix);
    }
    expect(db.remiseRetour.create).toHaveBeenCalledTimes(3);
  });
});

describe("lireEtatPresence : lecture seule", () => {
  it("rend le titre, la date et la dernière réponse sans rien écrire", async () => {
    const etat = await lireEtatPresence(jeton);
    expect(etat).toEqual({
      ok: true,
      titreFormation: "Piloter son activité avec l'IA",
      dateDebutFormation: "lundi 26 octobre 2026",
      derniereReponse: null,
    });
    expect(db.remiseRetour.create).not.toHaveBeenCalled();
  });

  it("refuse un jeton forgé", async () => {
    expect((await lireEtatPresence("forge")).ok).toBe(false);
  });
});
