/**
 * ⛔ AUCUNE ALERTE D'EXPIRATION DE JETON NE PART (révision du 02/10).
 *
 * Décision de Williams : le jeton de l'enregistreur n'expire plus, il vaut
 * jusqu'à sa révocation. Les alertes J-14 et J-3 (PR 5) sont donc retirées :
 * même un jeton créé AVANT la révision, dont la date d'origine (90 jours)
 * approche ou est dépassée, ne lève rien — ni dans `AlerteSysteme`, ni sur
 * Telegram. Les deux codes ont quitté `CODES_ALERTES_VISIO` et le catalogue
 * (liste exacte de `catalogue.spec.ts`).
 *
 * Mutation qui rougit : remettre le bloc « jetons qui expirent » dans
 * `balayerEnregistreur` → le 2e cas rougit (une alerte à 10 jours).
 * Contre-témoin : le balayage tourne bien (une extension trop ancienne sur un
 * appareil d'avant la révision alerte toujours).
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

describe("⛔ aucune alerte d'expiration de jeton ne part", () => {
  beforeEach(() => {
    delete process.env["DATABASE_URL"];
  });

  it("les codes J-14 et J-3 n'existent plus dans le chantier", () => {
    // Le catalogue, lui, est tenu par sa liste exacte (`catalogue.spec.ts`).
    const codes: string[] = Object.values(CODES_ALERTES_VISIO);
    expect(codes.filter((c) => c.startsWith("visio.jeton"))).toEqual([]);
  });

  it.each([30, 14, 10, 3, 2, -1, -60])(
    "jeton d'avant la révision, date d'origine à %i jour(s) : rien ne part",
    async (jours) => {
      const db = nouvelleBase();
      semerAppareil(db, { expireLe: new Date(T0.getTime() + jours * JOUR) });
      const notifier = vi.fn().mockResolvedValue(true);
      await balayer(db, notifier);
      await balayer(db, notifier, new Date(T0.getTime() + 8 * JOUR));
      expect(notifier).not.toHaveBeenCalled();
      expect(db.lignes("alerteSysteme")).toHaveLength(0);
    },
  );

  it("contre-témoin : le balayage regarde toujours les appareils d'avant la révision", async () => {
    const db = nouvelleBase();
    const { appareilId } = semerAppareil(db, { expireLe: new Date(T0.getTime() - 60 * JOUR) });
    const appareil = db.lignes("appareilEnregistrement")[0] as Record<string, unknown>;
    appareil["versionExtension"] = "1.0.0";
    const notifier = vi.fn().mockResolvedValue(true);
    await balayer(db, notifier);
    const alertes = db.lignes("alerteSysteme");
    expect(alertes.map((a) => a["code"])).toEqual([CODES_ALERTES_VISIO.extensionTropAncienne]);
    expect(alertes[0]?.["cibleId"]).toBe(appareilId);
  });
});
