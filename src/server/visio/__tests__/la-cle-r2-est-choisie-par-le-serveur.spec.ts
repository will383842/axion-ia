/**
 * ⛔ LA CLÉ R2 EST CHOISIE PAR LE SERVEUR (PR 5, ADR 0054).
 *
 * L'extension ne fournit jamais de nom de fichier : la clé est
 * `visio-audio/<enregistrementId>/<piste>/<tranche 4 chiffres>/<seq 5 chiffres>.bin`,
 * calculée par `cleR2Morceau`. Un en-tête forgé (chemin, `..`, autre préfixe)
 * est refusé avant tout dépôt.
 *
 * Mutation qui rougit : laisser passer un `x-piste` libre dans
 * `lireEntetesMorceau` → la clé contient « ../ » (le 3ᵉ cas rougit).
 * Contre-témoin : une piste et des numéros valides donnent la clé attendue.
 * Angle mort : les droits du jeton R2 (bucket entier) ne sont pas restreints
 * au préfixe ; c'est une limite de Cloudflare, écrite dans l'ADR 0054.
 */

import { beforeEach, describe, expect, it } from "vitest";

import { deposerMorceau, lireEntetesMorceau } from "../morceaux";
import { cleR2Morceau, PREFIXE_AUDIO } from "../stockage-audio";
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

const SON = Buffer.from("son fictif");

describe("⛔ la clé R2 est choisie par le serveur", () => {
  beforeEach(() => {
    process.env["PII_ENCRYPTION_KEY"] = CLE_DE_TEST;
  });

  it("la clé déposée suit le gabarit, sous le préfixe privé", async () => {
    const db = fausseBase();
    const { appareilId, adminUserId } = semerAppareil(db);
    const { rencontreId } = semerRencontreTest(db);
    const id = semerEnregistrement(db, { rencontreId, appareilId, statut: "en_cours" });
    const stockage = fauxStockage();
    const h = entetesMorceau(SON, { piste: "axion", tranche: 3, seq: 7 });
    await deposerMorceau(commePrisma(db), stockage, {
      appareil: { id: appareilId, adminUserId },
      enregistrementId: id,
      entetes: {
        piste: h["x-piste"] ?? null,
        tranche: h["x-tranche"] ?? null,
        seq: h["x-seq"] ?? null,
        debutCaptureMs: h["x-debut-capture-ms"] ?? null,
        empreinte: h["x-empreinte"] ?? null,
      },
      octets: SON,
      maintenant: T0,
    });
    expect([...stockage.objets.keys()]).toEqual([`${PREFIXE_AUDIO}${id}/axion/0003/00007.bin`]);
  });

  it("aucun en-tête ne peut choisir un chemin : piste libre, numéros non entiers, empreinte forgée", () => {
    const base = { tranche: "0", seq: "0", debutCaptureMs: "1", empreinte: "a".repeat(64) };
    expect(lireEntetesMorceau({ ...base, piste: "../../factures" })).toBeNull();
    expect(lireEntetesMorceau({ ...base, piste: "client", tranche: "1/../2" })).toBeNull();
    expect(lireEntetesMorceau({ ...base, piste: "client", seq: "-1" })).toBeNull();
    expect(lireEntetesMorceau({ ...base, piste: "client", empreinte: "../x" })).toBeNull();
    expect(lireEntetesMorceau({ ...base, piste: "client", tranche: "10000" })).toBeNull();
  });

  it("cleR2Morceau refuse un identifiant ou des numéros hors bornes", () => {
    expect(() => cleR2Morceau("../x", "client", 0, 0)).toThrow();
    expect(() =>
      cleR2Morceau("3f1c2a4e-8b7d-4c1e-9a2b-1c2d3e4f5a6b", "client", 10_000, 0),
    ).toThrow();
    expect(cleR2Morceau("3f1c2a4e-8b7d-4c1e-9a2b-1c2d3e4f5a6b", "client", 12, 345)).toBe(
      "visio-audio/3f1c2a4e-8b7d-4c1e-9a2b-1c2d3e4f5a6b/client/0012/00345.bin",
    );
  });
});
