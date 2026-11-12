// @vitest-environment node
//
// Lot guide réseau 4 (O5) — rattrapage des origines restées en route : une transmission par
// (personne, guide), seulement si la personne a cliqué, jamais avant 10 min, jamais sans date de
// coupure (D3 : décision de Williams en attente), colonne absente tolérée.
import { beforeEach, describe, expect, it, vi } from "vitest";

type Ligne = Record<string, unknown>;
const m = vi.hoisted(() => ({
  origines: [] as Record<string, unknown>[],
  demandes: new Map<string, Record<string, unknown>>(),
  appels: [] as Record<string, unknown>[],
  erreurColonne: false,
  exclues: new Set<string>(),
  requetes: [] as { sql: string; values: unknown[] }[],
}));

vi.mock("@/lib/prisma", () => ({
  prisma: {
    // Lecture bornée aux personnes qui ont CLIQUÉ (`first_click_at` ET `crm_emitted_at`) et aux
    // `MAX` origines les plus récentes de chaque (personne, guide) : la requête est un `$queryRaw`,
    // ses valeurs sont [max, lt, gte, curseur, limite].
    $queryRaw: async (sql: { sql: string; values: unknown[] }) => {
      if (m.erreurColonne) {
        throw Object.assign(new Error("col"), { code: "P2010", meta: { code: "42703" } });
      }
      m.requetes.push(sql);
      const [max, lt, gte, curseur, limite] = sql.values as [number, Date, Date, string, number];
      const rang = new Map<unknown, number>();
      const groupes = new Map<string, Record<string, unknown>[]>();
      for (const x of m.origines) {
        if (x.archiveeLe !== null || !(x.crmStatut === null || x.crmStatut === "transmise"))
          continue;
        const k = `${x.emailKey}|${x.guide}`;
        groupes.set(k, [...(groupes.get(k) ?? []), x]);
      }
      for (const l of groupes.values()) {
        l.sort((a, b) => +(b.occurredAt as Date) - +(a.occurredAt as Date));
        l.forEach((x, i) => rang.set(x, i + 1));
      }
      return m.origines
        .filter((x) => {
          const d = m.demandes.get(`${x.emailKey}|${x.guide}`);
          return (
            x.crmStatut === null &&
            x.archiveeLe === null &&
            (rang.get(x) ?? 999) <= max &&
            +(x.createdAt as Date) < +lt &&
            +(x.createdAt as Date) >= +gte &&
            d !== undefined &&
            d.firstClickAt != null &&
            d.crmEmittedAt != null &&
            String(x.id) > curseur
          );
        })
        .sort((x, y) => String(x.id).localeCompare(String(y.id)))
        .slice(0, limite);
    },
    guideRequest: {
      findUnique: async (a: { where: { emailKey_aimant: { emailKey: string; aimant: string } } }) =>
        m.demandes.get(`${a.where.emailKey_aimant.emailKey}|${a.where.emailKey_aimant.aimant}`) ??
        null,
    },
  },
}));
vi.mock("@/lib/security/email-hash", () => ({ hashEmailForLookup: () => "x" }));
vi.mock("@/server/queue/queues", () => ({ crmSyncQueue: null }));
vi.mock("@/server/email/opposition", () => ({ estOpposee: async () => false }));
vi.mock("@/server/guides-reseau/synchro-v3", async (orig) => ({
  ...(await orig<typeof import("@/server/guides-reseau/synchro-v3")>()),
  transmettreOriginesSuivantes: async (a: Record<string, unknown>) => {
    m.appels.push(a);
    // Fidèle au vrai : une adresse « exclue » voit ses origines passer `hors_charge`.
    if (m.exclues.has(String(a.emailKey))) {
      m.origines
        .filter((x) => x.emailKey === a.emailKey && x.crmStatut === null)
        .forEach((x) => (x.crmStatut = "hors_charge"));
      return "exclue";
    }
    return "transmise";
  },
}));

import {
  MAX_LOTS_ORIGINES,
  TAILLE_LOT,
  rattraperOriginesSuivantes,
} from "../rattrapage-lettre-guide";

const MAINTENANT = new Date("2026-11-11T12:00:00.000Z");
const il_y_a = (min: number) => new Date(MAINTENANT.getTime() - min * 60_000);
let compteur = 0;
const o = (sur: Ligne = {}): Ligne => ({
  id: `id-${String((compteur += 1)).padStart(6, "0")}`,
  emailKey: "cle-1",
  guide: "guide-ia",
  crmStatut: null,
  archiveeLe: null,
  createdAt: il_y_a(60),
  occurredAt: new Date(Date.UTC(2026, 10, 1, 0, 0, 0) + compteur * 1000),
  ...sur,
});

beforeEach(() => {
  m.origines.length = 0;
  m.demandes.clear();
  m.appels.length = 0;
  m.requetes.length = 0;
  m.erreurColonne = false;
  m.exclues.clear();
  m.demandes.set("cle-1|guide-ia", {
    email: "p@exemple.test",
    firstClickAt: il_y_a(500),
    crmEmittedAt: il_y_a(499),
  });
  vi.spyOn(console, "warn").mockImplementation(() => {});
});
const lancer = (sur: Record<string, unknown> = {}) =>
  rattraperOriginesSuivantes({
    executer: true,
    depuis: il_y_a(24 * 60),
    maintenant: MAINTENANT,
    ...sur,
  });

describe("rattraperOriginesSuivantes", () => {
  it("origine en attente depuis 1 h d'une personne cliquée : une transmission par (personne, guide)", async () => {
    m.origines.push(o(), o(), o({ guide: "autre" }));
    m.demandes.set("cle-1|autre", {
      email: "p@exemple.test",
      firstClickAt: il_y_a(100),
      crmEmittedAt: il_y_a(99),
    });
    const b = await lancer();
    expect(m.appels).toHaveLength(2);
    expect(b.groupes).toBe(2);
    expect(b.transmis).toBe(2);
  });

  it("origine vieille de 2 min : ignorée (le chemin direct finit)", async () => {
    m.origines.push(o({ createdAt: il_y_a(2) }));
    await lancer();
    expect(m.appels).toHaveLength(0);
  });

  it("personne jamais cliquée : rien ne part", async () => {
    m.demandes.set("cle-1|guide-ia", { email: "p@exemple.test", firstClickAt: null });
    m.origines.push(o());
    const b = await lancer();
    expect(m.appels).toHaveLength(0);
    // Elle n'est même pas lue : la requête ne retient que les personnes qui ont cliqué.
    expect(b.groupes).toBe(0);
  });

  it("sans date de coupure (D3 en attente) : rien n'est lu ni envoyé", async () => {
    m.origines.push(o());
    const b = await rattraperOriginesSuivantes({ executer: true, maintenant: MAINTENANT });
    expect(b.refus).toBe("coupure-absente");
    expect(m.requetes).toHaveLength(0);
    expect(m.appels).toHaveLength(0);
  });

  it("origine antérieure à la coupure : jamais envoyée", async () => {
    m.origines.push(o({ createdAt: il_y_a(3 * 24 * 60) }));
    await lancer();
    expect(m.appels).toHaveLength(0);
  });

  it("le rattrapage passe la date de coupure au chemin direct (une ancienne origine ne part pas)", async () => {
    const depuis = il_y_a(24 * 60);
    m.origines.push(o());
    await lancer({ depuis });
    expect(m.appels[0]?.depuis).toEqual(depuis);
  });

  it("MIXTE : une ancienne (avant la coupure) + une nouvelle de la même personne : seule la nouvelle déclenche, avec la coupure", async () => {
    const depuis = il_y_a(24 * 60);
    m.origines.push(o({ createdAt: il_y_a(3 * 24 * 60) }), o({ createdAt: il_y_a(60) }));
    const b = await lancer({ depuis });
    // Un seul groupe, et la coupure est transmise : l'ancienne reste NULL côté chemin direct.
    expect(b.groupes).toBe(1);
    expect(m.appels).toHaveLength(1);
    expect(m.appels[0]?.depuis).toEqual(depuis);
    expect(m.origines[0]?.crmStatut).toBeNull();
  });

  it("21e origine + adresse exclue : la borne n'est pas mangée, la vraie origine en attente est lue", async () => {
    // 21 origines pour une personne : la plus ancienne (21e) n'est jamais lue.
    for (let i = 0; i < 21; i += 1) m.origines.push(o({ emailKey: "vingt1" }));
    m.demandes.set("vingt1|guide-ia", {
      email: "v@exemple.test",
      firstClickAt: il_y_a(500),
      crmEmittedAt: il_y_a(499),
    });
    const b1 = await lancer({ executer: false });
    expect(b1.groupes).toBe(1);
    expect(m.requetes[0]!.values[0]).toBe(20);

    // Adresses exclues : plus de lots que la borne. Premier passage : elles passent hors_charge.
    m.origines.length = 0;
    m.requetes.length = 0;
    const total = TAILLE_LOT * MAX_LOTS_ORIGINES + 5;
    for (let i = 0; i < total; i += 1) {
      m.origines.push(o({ emailKey: `x${i}` }));
      m.exclues.add(`x${i}`);
      m.demandes.set(`x${i}|guide-ia`, {
        email: "x@exemple.test",
        firstClickAt: il_y_a(500),
        crmEmittedAt: il_y_a(499),
      });
    }
    m.origines.push(o({ emailKey: "vraie", createdAt: il_y_a(30) }));
    m.demandes.set("vraie|guide-ia", {
      email: "v@exemple.test",
      firstClickAt: il_y_a(500),
      crmEmittedAt: il_y_a(499),
    });
    const p1 = await lancer();
    expect(p1.borneAtteinte).toBe(true);
    m.appels.length = 0;
    const p2 = await lancer();
    // Les exclues déjà sorties (hors_charge) ne reviennent plus : la vraie origine est lue.
    expect(m.appels.some((a) => a.emailKey === "vraie")).toBe(true);
    expect(p2.borneAtteinte).toBe(false);
    expect(m.origines.filter((x) => x.crmStatut === "hors_charge").length).toBeGreaterThan(0);
    expect(m.origines).toHaveLength(total + 1);
  });

  it("à blanc : compte, n'envoie rien", async () => {
    m.origines.push(o());
    const b = await lancer({ executer: false });
    expect(b.groupes).toBe(1);
    expect(m.appels).toHaveLength(0);
  });

  it("colonne absente (P2022) : sortie propre, aucune exception", async () => {
    m.erreurColonne = true;
    const b = await lancer();
    expect(b.refus).toBe("colonne-absente");
  });

  it("deux passes : la seconde ne trouve plus rien si l'origine est marquée", async () => {
    m.origines.push(o());
    await lancer();
    m.origines.forEach((x) => (x.crmStatut = "transmise"));
    m.appels.length = 0;
    await lancer();
    expect(m.appels).toHaveLength(0);
  });

  it("501 origines anciennes d'une personne jamais cliquée + 1 plus récente d'une personne cliquée : celle-ci est transmise", async () => {
    m.demandes.set("jamais|guide-ia", { email: "j@exemple.test", firstClickAt: null });
    for (let i = 0; i < TAILLE_LOT + 1; i += 1) {
      m.origines.push(o({ emailKey: "jamais", createdAt: il_y_a(600 + i) }));
    }
    m.origines.push(o({ emailKey: "cle-1", createdAt: il_y_a(30) }));
    const b = await lancer();
    expect(m.appels).toEqual([expect.objectContaining({ emailKey: "cle-1" })]);
    expect(b.transmis).toBe(1);
    // Les origines de la personne jamais cliquée ne prennent plus de place dans la lecture.
    expect(b.groupes).toBe(1);
    expect(b.borneAtteinte).toBe(false);
    expect(m.origines).toHaveLength(TAILLE_LOT + 2);
  });

  it("origines qui ne partiront jamais : le passage s'arrête à la borne, les lignes restent NULL et le journal le dit", async () => {
    // Une personne distincte par ligne, ayant cliqué mais exclue du CRM plus loin : plus de lots
    // que la borne.
    const total = TAILLE_LOT * MAX_LOTS_ORIGINES + 5;
    for (let i = 0; i < total; i += 1) {
      m.origines.push(o({ emailKey: `k${i}` }));
      m.demandes.set(`k${i}|guide-ia`, {
        email: "x@exemple.test",
        firstClickAt: il_y_a(500),
        crmEmittedAt: il_y_a(499),
      });
    }
    const b = await lancer({ executer: false });
    expect(b.borneAtteinte).toBe(true);
    expect(b.groupes).toBe(TAILLE_LOT * MAX_LOTS_ORIGINES);
    expect(m.requetes).toHaveLength(MAX_LOTS_ORIGINES);
    // Rien n'est effacé ni marqué : tout est encore en attente.
    expect(m.origines).toHaveLength(total);
    expect(m.origines.every((x) => x.crmStatut === null)).toBe(true);
    expect(console.warn).toHaveBeenCalledWith(expect.stringContaining("borne_atteinte"));
  });
});
