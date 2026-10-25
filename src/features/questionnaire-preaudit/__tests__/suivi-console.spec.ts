// Le suivi côté console (2026-10-26) : ce que le clic de Will écrit, et rien d'autre.
// Base EN MÉMOIRE ; ce module n'envoie rien (le worker envoie).

import { describe, expect, it, vi } from "vitest";

vi.mock("@/lib/prisma", () => ({ prisma: {} }));

import { arreterRelances, demanderEssai, lireSuivi, noterEnvoi } from "../suivi-console";

type Ligne = Record<string, unknown>;
const QID = "11111111-1111-4111-8111-111111111111";

function base(suivis: Ligne[] = [], courriers: Ligne[] = []) {
  const egal = (r: Ligne, w: Record<string, unknown>) =>
    Object.entries(w).every(([k, v]) => {
      if (v !== null && typeof v === "object" && "in" in (v as object)) {
        return (v as { in: unknown[] }).in.includes(r[k]);
      }
      return r[k] === v;
    });
  return {
    suivis,
    courriers,
    questionnaireAvantAuditSuivi: {
      findUnique: vi.fn(
        async (a: { where: Ligne }) => suivis.find((s) => egal(s, a.where)) ?? null,
      ),
      create: vi.fn(async (a: { data: Ligne }) => {
        const l = { id: `s${suivis.length + 1}`, relancesArreteesLe: null, ...a.data };
        suivis.push(l);
        return l;
      }),
      update: vi.fn(async (a: { where: { id: string }; data: Ligne }) => {
        const l = suivis.find((s) => s["id"] === a.where.id)!;
        Object.assign(l, a.data);
        return l;
      }),
      updateMany: vi.fn(async (a: { where: Ligne; data: Ligne }) => {
        const l = suivis.filter((s) => egal(s, a.where));
        l.forEach((s) => Object.assign(s, a.data));
        return { count: l.length };
      }),
    },
    questionnaireAvantAuditCourrier: {
      createMany: vi.fn(async (a: { data: Ligne[] }) => {
        let count = 0;
        for (const d of a.data) {
          if (courriers.some((c) => c["cle"] === d["cle"])) continue;
          courriers.push({ id: `c${courriers.length + 1}`, ...d });
          count++;
        }
        return { count };
      }),
      updateMany: vi.fn(async (a: { where: Ligne; data: Ligne }) => {
        const l = courriers.filter((c) => egal(c, a.where));
        l.forEach((c) => Object.assign(c, a.data));
        return { count: l.length };
      }),
      findMany: vi.fn(async () => courriers),
    },
  };
}
type B = Parameters<typeof noterEnvoi>[4];

const T = new Date("2026-10-26T09:00:00Z");

describe("noterEnvoi", () => {
  it("crée le suivi et note l'envoi au journal (aucun envoi d'ici)", async () => {
    const b = base();
    await noterEnvoi(
      QID,
      { relances: true, dateAudit: null, lieuAudit: " dans vos locaux " },
      "envoye",
      T,
      b as unknown as B,
    );
    expect(b.suivis[0]).toMatchObject({
      questionnaireId: QID,
      relancesDemandees: true,
      lieuAudit: "dans vos locaux",
    });
    expect(b.courriers).toEqual([
      expect.objectContaining({
        nature: "invitation",
        canal: "journal",
        statut: "journal",
        motif: "envoyé par Will",
      }),
    ]);
  });

  it("un renvoi met à jour date et lieu, mais ne rallume JAMAIS des relances arrêtées", async () => {
    const b = base([
      { id: "s1", questionnaireId: QID, relancesDemandees: false, relancesArreteesLe: T },
    ]);
    const audit = new Date("2026-11-06T07:30:00Z");
    await noterEnvoi(
      QID,
      { relances: true, dateAudit: audit, lieuAudit: null },
      "retenu_corbeille",
      T,
      b as unknown as B,
    );
    expect(b.suivis[0]).toMatchObject({ relancesDemandees: false, dateAudit: audit });
    expect(b.courriers[0]).toMatchObject({ motif: "retenu en corbeille" });
  });
});

describe("renvoi avec une nouvelle date d'audit", () => {
  it("recalcule les relances pas encore parties ; une relance trop proche est annulée", async () => {
    const j0 = new Date("2026-10-26T09:00:00Z");
    const b = base(
      [
        {
          id: "s1",
          questionnaireId: QID,
          relancesDemandees: true,
          relancesArreteesLe: null,
          premierEnvoiLe: j0,
          dateAudit: null,
        },
      ],
      [
        {
          cle: "r1",
          questionnaireId: QID,
          nature: "relance_1",
          statut: "envoye",
          prevuLe: new Date("2026-10-28T08:30:00Z"),
        },
        {
          cle: "r2",
          questionnaireId: QID,
          nature: "relance_2",
          statut: "prevu",
          prevuLe: new Date("2026-11-02T08:30:00Z"),
        },
        {
          cle: "r3",
          questionnaireId: QID,
          nature: "relance_3",
          statut: "prevu",
          prevuLe: new Date("2026-11-05T08:30:00Z"),
        },
      ],
    );
    // Audit avancé au mardi 3 novembre 8 h : la relance 2 (lundi 2/11 9 h 30) tombe à moins de
    // 24 h, la relance 3 est avancée au vendredi 30/10.
    await noterEnvoi(
      QID,
      { relances: true, dateAudit: new Date("2026-11-03T07:00:00Z"), lieuAudit: null },
      "envoye",
      new Date("2026-10-29T10:00:00Z"),
      b as unknown as B,
    );
    expect(b.courriers[0]!["statut"]).toBe("envoye");
    expect(b.courriers[1]).toMatchObject({ statut: "annule", motif: "audit_proche" });
    expect(b.courriers[2]).toMatchObject({
      statut: "prevu",
      prevuLe: new Date("2026-10-30T08:30:00Z"),
    });
  });
});

describe("arreterRelances", () => {
  it("annule les relances prévues, prévient Telegram une fois, idempotent", async () => {
    const b = base(
      [{ id: "s1", questionnaireId: QID, relancesDemandees: true, relancesArreteesLe: null }],
      [
        { cle: "relance_1:q", questionnaireId: QID, nature: "relance_1", statut: "envoye" },
        { cle: "relance_2:q", questionnaireId: QID, nature: "relance_2", statut: "prevu" },
      ],
    );
    expect(await arreterRelances(QID, "desinscription", T, b as unknown as B)).toBe(true);
    expect(b.suivis[0]).toMatchObject({ relancesArretMotif: "desinscription" });
    expect(b.courriers[0]!["statut"]).toBe("envoye");
    expect(b.courriers[1]).toMatchObject({ statut: "annule", motif: "desinscription" });
    expect(b.courriers.filter((c) => c["nature"] === "telegram_arret")).toHaveLength(1);
    expect(await arreterRelances(QID, "will", T, b as unknown as B)).toBe(false);
    expect(b.suivis[0]).toMatchObject({ relancesArretMotif: "desinscription" });
    expect(b.courriers.filter((c) => c["nature"] === "telegram_arret")).toHaveLength(1);
  });

  it("sans suivi (questionnaire jamais envoyé) : rien ne change", async () => {
    const b = base();
    expect(await arreterRelances(QID, "desinscription", T, b as unknown as B)).toBe(false);
    expect(b.courriers).toHaveLength(0);
  });
});

describe("demanderEssai et lireSuivi", () => {
  it("un essai = une ligne prévue, nature « essai », jamais un envoi", async () => {
    const b = base();
    await demanderEssai(QID, "relance_2", T, b as unknown as B);
    await demanderEssai(QID, "telegram_reponse", new Date(T.getTime() + 1), b as unknown as B);
    expect(b.courriers.map((c) => [c["nature"], c["essaiDe"], c["canal"], c["statut"]])).toEqual([
      ["essai", "relance_2", "email", "prevu"],
      ["essai", "telegram_reponse", "telegram", "prevu"],
    ]);
  });

  it("migration absente : null, la fiche s'affiche sans le bloc", async () => {
    const b = base();
    b.questionnaireAvantAuditSuivi.findUnique.mockRejectedValueOnce(
      Object.assign(new Error("x"), { code: "P2021" }),
    );
    await expect(lireSuivi(QID, b as unknown as B)).resolves.toBeNull();
  });

  it("la prochaine relance est la première encore prévue", async () => {
    const b = base(
      [{ id: "s1", questionnaireId: QID, relancesDemandees: true, relancesArreteesLe: null }],
      [
        {
          id: "c1",
          nature: "relance_1",
          statut: "envoye",
          prevuLe: new Date("2026-10-28T08:30:00Z"),
        },
        {
          id: "c2",
          nature: "relance_2",
          statut: "prevu",
          prevuLe: new Date("2026-11-02T08:30:00Z"),
        },
      ],
    );
    const s = await lireSuivi(QID, b as unknown as B);
    expect(s?.prochaine?.toISOString()).toBe("2026-11-02T08:30:00.000Z");
    expect(s?.journal).toHaveLength(2);
  });
});
