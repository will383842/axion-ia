/**
 * ⛔ AUCUN MORCEAU N'EST ACCEPTÉ AVANT L'ACCORD (PR 5, ADR 0054).
 *
 * Tant que l'enregistrement est `accord_en_attente`, la route des morceaux
 * répond 409 et RIEN n'atteint le stockage : le son reste dans l'IndexedDB de
 * l'extension, qui le détruit sans accord sous 3 minutes.
 *
 * Mutation qui rougit : retirer le test `statut === "accord_en_attente"` de
 * `deposerMorceau` → le morceau est déposé (200) et le stockage le reçoit.
 * Contre-témoin : le même morceau, sur un enregistrement `en_cours`, passe.
 * Angle mort : on prouve le code du site ; que l'extension n'ENVOIE rien avant
 * l'accord est prouvé à part (`rien-ne-part-avant-l-accord…` côté extension).
 */

import { beforeEach, describe, expect, it } from "vitest";

import { deposerMorceau } from "../morceaux";
import {
  CLE_DE_TEST,
  commePrisma,
  entetesMorceau,
  fausseBase,
  fauxStockage,
  semerAppareil,
  semerEnregistrement,
  semerRencontreTest,
  T0,
} from "../../../../tests/outils/fixtures-enregistreur";

const SON = Buffer.from("un morceau de son fictif, sans aucune parole réelle");

function entetes(): {
  piste: string | null;
  tranche: string | null;
  seq: string | null;
  debutCaptureMs: string | null;
  empreinte: string | null;
} {
  const h = entetesMorceau(SON);
  return {
    piste: h["x-piste"] ?? null,
    tranche: h["x-tranche"] ?? null,
    seq: h["x-seq"] ?? null,
    debutCaptureMs: h["x-debut-capture-ms"] ?? null,
    empreinte: h["x-empreinte"] ?? null,
  };
}

describe("⛔ aucun morceau n'est accepté avant l'accord", () => {
  beforeEach(() => {
    process.env["PII_ENCRYPTION_KEY"] = CLE_DE_TEST;
  });

  it("409 en accord_en_attente, et le stockage ne reçoit rien", async () => {
    const db = fausseBase();
    const { appareilId, adminUserId } = semerAppareil(db);
    const { rencontreId } = semerRencontreTest(db);
    const id = semerEnregistrement(db, { rencontreId, appareilId, statut: "accord_en_attente" });
    const stockage = fauxStockage();

    const r = await deposerMorceau(commePrisma(db), stockage, {
      appareil: { id: appareilId, adminUserId },
      enregistrementId: id,
      entetes: entetes(),
      octets: SON,
      maintenant: T0,
    });

    expect(r.statut).toBe(409);
    expect(r.corps["erreur"]).toBe("accord_en_attente");
    expect(stockage.objets.size).toBe(0);
    expect(db.lignes("enregistrementMorceau")).toHaveLength(0);
  });

  it.each(["refuse", "accord_non_confirme", "abandonne", "valide"])(
    "409 aussi après un refus ou une clôture (%s)",
    async (statut) => {
      const db = fausseBase();
      const { appareilId, adminUserId } = semerAppareil(db);
      const { rencontreId } = semerRencontreTest(db);
      const id = semerEnregistrement(db, { rencontreId, appareilId, statut });
      const stockage = fauxStockage();
      const r = await deposerMorceau(commePrisma(db), stockage, {
        appareil: { id: appareilId, adminUserId },
        enregistrementId: id,
        entetes: entetes(),
        octets: SON,
        maintenant: T0,
      });
      expect(r.statut).toBe(409);
      expect(stockage.objets.size).toBe(0);
    },
  );

  it("contre-témoin : le même morceau passe une fois l'accord obtenu", async () => {
    const db = fausseBase();
    const { appareilId, adminUserId } = semerAppareil(db);
    const { rencontreId } = semerRencontreTest(db);
    const id = semerEnregistrement(db, { rencontreId, appareilId, statut: "en_cours" });
    const stockage = fauxStockage();
    const r = await deposerMorceau(commePrisma(db), stockage, {
      appareil: { id: appareilId, adminUserId },
      enregistrementId: id,
      entetes: entetes(),
      octets: SON,
      maintenant: T0,
    });
    expect(r.statut).toBe(200);
    expect(stockage.objets.size).toBe(1);
  });
});
