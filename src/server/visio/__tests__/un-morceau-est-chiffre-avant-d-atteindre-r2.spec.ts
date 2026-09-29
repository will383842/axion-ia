/**
 * ⛔ UN MORCEAU EST CHIFFRÉ AVANT D'ATTEINDRE R2 (PR 5, ADR 0054 et 0056).
 *
 * Ce que le stockage reçoit ne contient pas le son reçu : il porte l'enveloppe
 * `AXB1` (AES-256-GCM, clé `PII_ENCRYPTION_KEY`) et se déchiffre en l'octet
 * source exact.
 *
 * Mutation qui rougit : dans `morceaux.ts`, remplacer `chiffrerOctets(entree.octets)`
 * par `entree.octets` → le stockage reçoit le son en clair (les deux premiers
 * `expect` rougissent). Contre-témoin : sans clé, rien n'est déposé (503).
 * Angle mort : le chiffrement côté R2 lui-même (au repos, chez Cloudflare)
 * n'est pas mesuré ici ; il s'ajoute, il ne remplace pas.
 */

import { afterEach, beforeEach, describe, expect, it } from "vitest";

import { dechiffrerOctets } from "@/lib/chiffrer-parole";
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

const SON = Buffer.from("MARQUEUR-DE-SON-EN-CLAIR-0123456789");

function lire(h: Record<string, string>) {
  return {
    piste: h["x-piste"] ?? null,
    tranche: h["x-tranche"] ?? null,
    seq: h["x-seq"] ?? null,
    debutCaptureMs: h["x-debut-capture-ms"] ?? null,
    empreinte: h["x-empreinte"] ?? null,
  };
}

async function deposer(stockage = fauxStockage()) {
  const db = fausseBase();
  const { appareilId, adminUserId } = semerAppareil(db);
  const { rencontreId } = semerRencontreTest(db);
  const id = semerEnregistrement(db, { rencontreId, appareilId, statut: "en_cours" });
  const r = await deposerMorceau(commePrisma(db), stockage, {
    appareil: { id: appareilId, adminUserId },
    enregistrementId: id,
    entetes: lire(entetesMorceau(SON)),
    octets: SON,
    maintenant: T0,
  });
  return { r, stockage, db };
}

describe("⛔ un morceau est chiffré avant d'atteindre R2", () => {
  beforeEach(() => {
    process.env["PII_ENCRYPTION_KEY"] = CLE_DE_TEST;
  });
  afterEach(() => {
    process.env["PII_ENCRYPTION_KEY"] = CLE_DE_TEST;
  });

  it("le corps déposé ne contient pas le son source, et porte l'enveloppe AXB1", async () => {
    const { r, stockage } = await deposer();
    expect(r.statut).toBe(200);
    const [depot] = [...stockage.objets.values()];
    expect(depot).toBeDefined();
    expect(depot?.includes(SON)).toBe(false);
    expect(depot?.subarray(0, 4).toString("latin1")).toBe("AXB1");
  });

  it("il se déchiffre en l'octet source exact (rien n'est perdu)", async () => {
    const { stockage } = await deposer();
    const [depot] = [...stockage.objets.values()];
    expect(dechiffrerOctets(depot as Buffer).equals(SON)).toBe(true);
  });

  it("contre-témoin : sans clé, rien n'est déposé (503), jamais en clair", async () => {
    delete process.env["PII_ENCRYPTION_KEY"];
    const { r, stockage, db } = await deposer();
    expect(r.statut).toBe(503);
    expect(stockage.objets.size).toBe(0);
    expect(db.lignes("enregistrementMorceau")).toHaveLength(0);
  });

  it("une écriture R2 qui échoue rend 503 et n'enregistre aucun morceau", async () => {
    const { r, db } = await deposer(fauxStockage({ echecDepot: true }));
    expect(r.statut).toBe(503);
    expect(r.corps["erreur"]).toBe("stockage_indisponible");
    expect(db.lignes("enregistrementMorceau")).toHaveLength(0);
  });
});
