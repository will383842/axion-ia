/**
 * Une liaison non aboutie ne laisse pas d'appareil orphelin (relecture
 * sécurité du 02/10). Si l'extension refuse le jeton créé par « Relier », ou
 * ne répond pas, la page révoque CET appareil — et seulement s'il appartient à
 * l'admin courant, n'est pas déjà révoqué, et a été créé il y a moins de
 * 15 minutes. Un identifiant quelconque ne permet donc pas de révoquer le
 * poste d'un autre, ni un poste ancien.
 *
 * Mutation qui rougit : retirer la condition `adminUserId` → 3e cas.
 */

import { describe, expect, it } from "vitest";

import { annulerLiaisonNonAboutie, DELAI_ANNULATION_LIAISON_MS } from "../jeton";
import {
  commePrisma,
  fausseBase,
  MINUTE,
  semerAppareil,
} from "../../../../tests/outils/fixtures-enregistreur";

const MAINTENANT = new Date("2026-10-02T10:00:00Z");

function appareilCreeIlYa(ms: number, revoqueLe: Date | null = null) {
  const db = fausseBase();
  const s = semerAppareil(db, { revoqueLe });
  const ligne = db.lignes("appareilEnregistrement")[0] as Record<string, unknown>;
  ligne["creeLe"] = new Date(MAINTENANT.getTime() - ms);
  // La fausse base REMPLACE la ligne à chaque écriture : on la relit.
  const revoqueLeLu = () =>
    (db.lignes("appareilEnregistrement")[0] as Record<string, unknown>)["revoqueLe"];
  return { db, revoqueLeLu, ...s };
}

describe("une liaison non aboutie ne laisse pas d'appareil orphelin", () => {
  it("le délai est de 15 minutes", () => {
    expect(DELAI_ANNULATION_LIAISON_MS).toBe(15 * MINUTE);
  });

  it("l'appareil de l'admin courant, créé il y a 1 min : révoqué", async () => {
    const { db, revoqueLeLu, appareilId, adminUserId } = appareilCreeIlYa(MINUTE);
    const ok = await annulerLiaisonNonAboutie(commePrisma(db), {
      appareilId,
      adminUserId,
      maintenant: MAINTENANT,
    });
    expect(ok).toBe(true);
    expect(revoqueLeLu()).toEqual(MAINTENANT);
  });

  it("l'appareil d'un AUTRE admin : intact", async () => {
    const { db, revoqueLeLu, appareilId } = appareilCreeIlYa(MINUTE);
    const ok = await annulerLiaisonNonAboutie(commePrisma(db), {
      appareilId,
      adminUserId: "un-autre-admin",
      maintenant: MAINTENANT,
    });
    expect(ok).toBe(false);
    expect(revoqueLeLu()).toBeNull();
  });

  it("créé il y a plus de 15 minutes : intact", async () => {
    const { db, revoqueLeLu, appareilId, adminUserId } = appareilCreeIlYa(16 * MINUTE);
    const ok = await annulerLiaisonNonAboutie(commePrisma(db), {
      appareilId,
      adminUserId,
      maintenant: MAINTENANT,
    });
    expect(ok).toBe(false);
    expect(revoqueLeLu()).toBeNull();
  });

  it("déjà révoqué : la date de révocation ne bouge pas", async () => {
    const avant = new Date(MAINTENANT.getTime() - 30_000);
    const { db, revoqueLeLu, appareilId, adminUserId } = appareilCreeIlYa(MINUTE, avant);
    const ok = await annulerLiaisonNonAboutie(commePrisma(db), {
      appareilId,
      adminUserId,
      maintenant: MAINTENANT,
    });
    expect(ok).toBe(false);
    expect(revoqueLeLu()).toEqual(avant);
  });
});
