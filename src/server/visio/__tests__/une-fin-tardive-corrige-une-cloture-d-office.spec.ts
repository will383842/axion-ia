/**
 * ⛔ UNE FIN TARDIVE CORRIGE UNE CLÔTURE D'OFFICE (PR 5, plan §3.6 C2).
 *
 * Le serveur a déposé l'enregistrement d'office (`cloture_serveur`,
 * `incomplet = true`). La `fin` de l'extension arrive ensuite : elle remplace
 * le motif, la date de fin et les périodes perdues, et `incomplet` est
 * RECALCULÉ (faux s'il ne manque rien). Le journal dit « clôture serveur
 * corrigée ».
 *
 * Mutation qui rougit : dans `terminerSession`, rendre « déjà » pour tout
 * `depose` → le motif reste `cloture_serveur` et `incomplet` reste vrai.
 * Contre-témoin : une `fin` sur un enregistrement refusé est refusée (409).
 */

import { describe, expect, it } from "vitest";

import { terminerSession } from "../sessions";
import {
  commePrisma,
  fausseBase,
  MINUTE,
  semerAppareil,
  semerEnregistrement,
  semerRencontreTest,
  T0,
} from "../../../../tests/outils/fixtures-enregistreur";

const FIN = {
  finLe: new Date(T0.getTime() + 45 * MINUTE).toISOString(),
  motif: "manuel" as const,
  perdus: [],
  fenetresHorsAccord: [],
  evenements: [{ le: new Date(T0.getTime() + 10 * MINUTE).toISOString(), type: "pause" }],
};

describe("⛔ une fin tardive corrige une clôture d'office", () => {
  it("depose/cloture_serveur → motif, fin et incomplet corrigés, journal", async () => {
    const db = fausseBase();
    const { appareilId, adminUserId } = semerAppareil(db);
    const { rencontreId } = semerRencontreTest(db);
    const id = semerEnregistrement(db, {
      rencontreId,
      appareilId,
      statut: "depose",
      motifArret: "cloture_serveur",
      fin: new Date(T0.getTime() + 30 * MINUTE),
    });
    const ligne = db.lignes("enregistrement")[0];
    if (ligne) ligne["incomplet"] = true;

    const r = await terminerSession(commePrisma(db), {
      appareil: { id: appareilId, adminUserId },
      enregistrementId: id,
      corps: FIN,
      maintenant: new Date(T0.getTime() + 3 * 60 * MINUTE),
    });
    expect(r.statut).toBe(200);
    expect(r.corps["corrige"]).toBe(true);
    const e = db.lignes("enregistrement")[0];
    expect(e?.["motifArret"]).toBe("manuel");
    expect(e?.["incomplet"]).toBe(false);
    expect((e?.["fin"] as Date).toISOString()).toBe(FIN.finLe);
    expect(String(e?.["evenements"])).toContain("cloture_serveur_corrigee");
    // Le son est effacé au plus tard 30 jours après la fin (B1).
    expect((e?.["audioAPurgerAvant"] as Date).getTime()).toBe(
      Date.parse(FIN.finLe) + 30 * 86_400_000,
    );
  });

  it("des périodes perdues gardent l'enregistrement incomplet", async () => {
    const db = fausseBase();
    const { appareilId, adminUserId } = semerAppareil(db);
    const { rencontreId } = semerRencontreTest(db);
    const id = semerEnregistrement(db, { rencontreId, appareilId, statut: "en_cours" });
    await terminerSession(commePrisma(db), {
      appareil: { id: appareilId, adminUserId },
      enregistrementId: id,
      corps: { ...FIN, perdus: [{ debutMs: 60_000, finMs: 70_000 }] },
      maintenant: T0,
    });
    expect(db.lignes("enregistrement")[0]?.["incomplet"]).toBe(true);
  });

  it("contre-témoin : jamais après un refus", async () => {
    const db = fausseBase();
    const { appareilId, adminUserId } = semerAppareil(db);
    const { rencontreId } = semerRencontreTest(db);
    const id = semerEnregistrement(db, { rencontreId, appareilId, statut: "refuse" });
    const r = await terminerSession(commePrisma(db), {
      appareil: { id: appareilId, adminUserId },
      enregistrementId: id,
      corps: FIN,
      maintenant: T0,
    });
    expect(r.statut).toBe(409);
    expect(db.lignes("enregistrement")[0]?.["statut"]).toBe("refuse");
  });
});
