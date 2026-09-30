/**
 * ⛔ UNE DICTÉE NE REÇOIT JAMAIS LA VOIX DU CLIENT (PR 7, B14, art. 6.1.f).
 *
 * Une dictée démarre `en_cours` SANS accord ni preuve d'accord : elle n'est
 * licite que parce que Williams parle seul. Le serveur garde donc les deux
 * portes par lesquelles la voix du client pourrait y entrer :
 *   · une capture VISIO lancée pendant qu'une dictée est active (ou
 *     `interrompu`) sur la même rencontre est REFUSÉE (409 motivé), et non
 *     rattachée par le 409 `enregistrement_actif` que l'extension prend pour
 *     une reprise ;
 *   · une piste `client` (morceau comme fin de tranche) est refusée sur un
 *     enregistrement `nature = dictee`, quel que soit son statut.
 *
 * Mutation qui rougit : renvoyer `enregistrement_actif` sans regarder la
 * nature (`repriseOuRefus`), ou retirer `refusPisteClientEnDictee` de
 * `deposerMorceau` ou de `terminerTranche`.
 * Contre-témoins : la piste `axion` d'une dictée passe ; une seconde capture
 * VISIO sur une visio active est toujours une reprise.
 * Angle mort : un haut-parleur ouvert pendant la dictée fait entrer la voix du
 * client dans la piste `axion` — le serveur ne l'entend pas (la dictée ne
 * démarre qu'après la fin prévue, `une-dictee-ne-demarre-qu-apres…`).
 */

import { createHash } from "node:crypto";
import { beforeEach, describe, expect, it } from "vitest";

import { CODE_PISTE_CLIENT_EN_DICTEE, deposerMorceau } from "../morceaux";
import {
  CODE_VISIO_PENDANT_LA_DICTEE,
  creerOuReprendreSession,
  terminerTranche,
} from "../sessions";
import {
  CLE_DE_TEST,
  commePrisma,
  corpsSession,
  entetesMorceau,
  fausseBase,
  fauxStockage,
  semerAppareil,
  semerEnregistrement,
  semerRencontreTest,
  T0,
} from "../../../../tests/outils/fixtures-enregistreur";

const SON = Buffer.from("un morceau de son fictif, sans aucune parole réelle");

function preparer(nature: "visio" | "dictee", statut = "en_cours") {
  const db = fausseBase();
  const { appareilId, adminUserId } = semerAppareil(db);
  const { rencontreId } = semerRencontreTest(db);
  const id = semerEnregistrement(db, {
    rencontreId,
    appareilId,
    statut,
    nature,
    ...(nature === "visio" ? { accordConfirmeLe: T0 } : {}),
  });
  return { db, appareil: { id: appareilId, adminUserId }, rencontreId, id };
}

function entetes(piste: "client" | "axion") {
  const h = entetesMorceau(SON, { piste });
  return {
    piste: h["x-piste"] ?? null,
    tranche: h["x-tranche"] ?? null,
    seq: h["x-seq"] ?? null,
    debutCaptureMs: h["x-debut-capture-ms"] ?? null,
    empreinte: h["x-empreinte"] ?? null,
  };
}

describe("⛔ une dictée ne reçoit jamais la voix du client", () => {
  beforeEach(() => {
    process.env["PII_ENCRYPTION_KEY"] = CLE_DE_TEST;
  });

  it.each(["en_cours", "interrompu"])(
    "une capture visio pendant une dictée %s : 409 motivé, pas de rattachement",
    async (statut) => {
      const p = preparer("dictee", statut);
      const r = await creerOuReprendreSession(commePrisma(p.db), {
        appareil: p.appareil,
        corps: corpsSession(p.rencontreId, { accordLocalLe: T0 }),
        mode: "pilote",
        maintenant: T0,
      });
      expect(r.statut).toBe(409);
      expect(r.corps["erreur"]).toBe(CODE_VISIO_PENDANT_LA_DICTEE);
      expect(r.corps).not.toHaveProperty("enregistrementId");
      expect(p.db.lignes("enregistrement")).toHaveLength(1);
    },
  );

  it("contre-témoin : une seconde capture visio sur une visio active est une reprise", async () => {
    const p = preparer("visio");
    const r = await creerOuReprendreSession(commePrisma(p.db), {
      appareil: p.appareil,
      corps: corpsSession(p.rencontreId, { accordLocalLe: T0 }),
      mode: "pilote",
      maintenant: T0,
    });
    expect(r.statut).toBe(409);
    expect(r.corps["erreur"]).toBe("enregistrement_actif");
    expect(r.corps["enregistrementId"]).toBe(p.id);
  });

  it("un morceau de piste client sur une dictée : 409, rien n'atteint le stockage", async () => {
    const p = preparer("dictee");
    const stockage = fauxStockage();
    const r = await deposerMorceau(commePrisma(p.db), stockage, {
      appareil: p.appareil,
      enregistrementId: p.id,
      entetes: entetes("client"),
      octets: SON,
      maintenant: T0,
    });
    expect(r.statut).toBe(409);
    expect(r.corps["erreur"]).toBe(CODE_PISTE_CLIENT_EN_DICTEE);
    expect(stockage.objets.size).toBe(0);
    expect(p.db.lignes("enregistrementTranche")).toHaveLength(0);
  });

  it("contre-témoin : la piste axion d'une dictée passe", async () => {
    const p = preparer("dictee");
    const stockage = fauxStockage();
    const r = await deposerMorceau(commePrisma(p.db), stockage, {
      appareil: p.appareil,
      enregistrementId: p.id,
      entetes: entetes("axion"),
      octets: SON,
      maintenant: T0,
    });
    expect(r.statut).toBe(200);
    expect(stockage.objets.size).toBe(1);
  });

  it("une fin de tranche de piste client sur une dictée : 409, aucune tranche créée", async () => {
    const p = preparer("dictee");
    const r = await terminerTranche(commePrisma(p.db), {
      appareil: p.appareil,
      enregistrementId: p.id,
      corps: {
        piste: "client",
        numero: 0,
        motifDebut: "demarrage",
        debutCaptureEpochMs: T0.getTime(),
        nbMorceaux: 1,
        empreinte: createHash("sha256").update(SON).digest("hex"),
        dureeMs: 1000,
        finMuette: false,
      },
      maintenant: T0,
    });
    expect(r.statut).toBe(409);
    expect(r.corps["erreur"]).toBe(CODE_PISTE_CLIENT_EN_DICTEE);
    expect(p.db.lignes("enregistrementTranche")).toHaveLength(0);
  });
});
