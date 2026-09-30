/**
 * ⛔ UN JETON QUI EXPIRE SOUS 14 JOURS ALERTE (PR 5).
 *
 * Le balayage lève UNE alerte `visio.jeton_expire_j14`, puis UNE
 * `visio.jeton_expire_j3`, par appareil — dans `AlerteSysteme`, par le VRAI
 * `creerOuDedup` (anti-doublon A3 : plus de table `alertes_visio`). L'alerte
 * part une fois sur Telegram ; un envoi raté est retenté ; une alerte envoyée
 * ne repart jamais. Aucun nom de personne dans le texte.
 *
 * Mutation qui rougit : dans `seuilAlerteJeton`, rendre `null` quand il reste
 * 10 jours → aucune alerte (2e cas). Remettre l'écriture dans `alerteVisio` →
 * le 2e cas rougit (`alertes_visio` doit rester vide). Contre-témoins : à
 * 30 jours, rien ; un jeton renouvelé ferme l'alerte.
 * `balayerEnregistreur` est appelé par le worker de balayage toutes les
 * 5 minutes (garde `le-worker-de-balayage-appelle-l-enregistreur.spec.ts`).
 */

import { beforeEach, describe, expect, it, vi } from "vitest";

import type { FausseBase } from "../../../../tests/outils/fausse-base-enregistreur";

const base = vi.hoisted(() => ({ db: null as unknown }));

// Le VRAI `creerOuDedup` écrit dans la fausse base.
vi.mock("@/lib/prisma", () => ({
  prisma: new Proxy({}, { get: (_c, nom: string) => (base.db as Record<string, unknown>)[nom] }),
}));
vi.mock("@/server/qualiopi/alertes/evaluateur", () => ({
  evaluerAlertesDetaille: vi.fn(),
}));

import { CODES_ALERTES_VISIO } from "../alertes";
import { balayerEnregistreur } from "../balayage-enregistreur";
import { seuilAlerteJeton } from "../jeton";
import {
  commePrisma,
  fausseBase,
  fauxStockage,
  JOUR,
  semerAppareil,
  T0,
} from "../../../../tests/outils/fixtures-enregistreur";

const ENV = { ENREGISTREMENT_VISIO_PILOTE: "true" };

function nouvelleBase(): FausseBase {
  const db = fausseBase();
  base.db = db;
  return db;
}

async function balayer(db: FausseBase, notifier: ReturnType<typeof vi.fn>, maintenant = T0) {
  return balayerEnregistreur(commePrisma(db), notifier, {
    maintenant,
    version: "t",
    env: ENV,
    stockage: fauxStockage(),
  });
}

describe("⛔ un jeton qui expire sous 14 jours alerte", () => {
  beforeEach(() => {
    delete process.env["DATABASE_URL"];
  });

  it("seuils purs : 30 j rien, 10 j → 14, 2 j → 3, expiré ou révoqué → rien", () => {
    const a = (jours: number, revoqueLe: Date | null = null) => ({
      expireLe: new Date(T0.getTime() + jours * JOUR),
      revoqueLe,
    });
    expect(seuilAlerteJeton(a(30), T0)).toBeNull();
    expect(seuilAlerteJeton(a(14), T0)).toBe(14);
    expect(seuilAlerteJeton(a(10), T0)).toBe(14);
    expect(seuilAlerteJeton(a(2), T0)).toBe(3);
    expect(seuilAlerteJeton(a(-1), T0)).toBeNull();
    expect(seuilAlerteJeton(a(2, T0), T0)).toBeNull();
  });

  it("une alerte J-14 dans AlerteSysteme, pas deux ; retentée si l'envoi échoue", async () => {
    const db = nouvelleBase();
    const { appareilId } = semerAppareil(db, { expireLe: new Date(T0.getTime() + 10 * JOUR) });
    const notifier = vi.fn().mockResolvedValueOnce(false).mockResolvedValue(true);

    await balayer(db, notifier);
    await balayer(db, notifier);
    await balayer(db, notifier);

    expect(notifier).toHaveBeenCalledTimes(2); // échec, puis succès, puis plus rien
    const alertes = db.lignes("alerteSysteme");
    expect(alertes).toHaveLength(1);
    expect(alertes[0]?.["code"]).toBe(CODES_ALERTES_VISIO.jetonJ14);
    expect(alertes[0]?.["cibleId"]).toBe(appareilId);
    expect(alertes[0]?.["niveau"]).toBe("important");
    expect(alertes[0]?.["notifiedAt"]).toBeInstanceOf(Date);
    // Anti-doublon A3 : la table abandonnée reste vide.
    expect(db.lignes("alerteVisio")).toHaveLength(0);
  });

  it("puis une seconde à J-3, et la J-14 se ferme", async () => {
    const db = nouvelleBase();
    semerAppareil(db, { expireLe: new Date(T0.getTime() + 10 * JOUR) });
    const notifier = vi.fn().mockResolvedValue(true);
    await balayer(db, notifier);
    await balayer(db, notifier, new Date(T0.getTime() + 8 * JOUR));
    expect(notifier).toHaveBeenCalledTimes(2);
    const parCode = Object.fromEntries(
      db.lignes("alerteSysteme").map((a) => [String(a["code"]), a["resolue"]]),
    );
    expect(parCode).toEqual({
      [CODES_ALERTES_VISIO.jetonJ14]: true,
      [CODES_ALERTES_VISIO.jetonJ3]: false,
    });
  });

  it("contre-témoin : un jeton à 30 jours n'alerte pas", async () => {
    const db = nouvelleBase();
    semerAppareil(db, { expireLe: new Date(T0.getTime() + 30 * JOUR) });
    const notifier = vi.fn().mockResolvedValue(true);
    await balayer(db, notifier);
    expect(notifier).not.toHaveBeenCalled();
    expect(db.lignes("alerteSysteme")).toHaveLength(0);
  });

  it("contre-témoin : un jeton renouvelé ferme l'alerte ouverte", async () => {
    const db = nouvelleBase();
    semerAppareil(db, { expireLe: new Date(T0.getTime() + 10 * JOUR) });
    const notifier = vi.fn().mockResolvedValue(true);
    await balayer(db, notifier);
    const appareil = db.lignes("appareilEnregistrement")[0] as Record<string, unknown>;
    appareil["expireLe"] = new Date(T0.getTime() + 90 * JOUR);
    await balayer(db, notifier);
    expect(db.lignes("alerteSysteme")[0]?.["resolue"]).toBe(true);
  });
});
