/**
 * ⛔ UN ENREGISTREMENT ABANDONNÉ EST CLÔTURÉ PAR LE SERVEUR (PR 5), horloge
 * simulée :
 *
 *   · `accord_en_attente` depuis plus de 3 min → `accord_non_confirme` ;
 *   · `en_cours` sans signe de vie depuis 10 min → `interrompu` ;
 *   · `interrompu` au-delà de `max(fin prévue, dernier signe) + 2 h` →
 *     `depose`, `incomplet`, motif `cloture_serveur`.
 *
 * Mutation qui rougit : retirer la branche `interrompu` de `decisionCloture`
 * → un enregistrement abandonné reste `interrompu` pour toujours (3ᵉ cas).
 * Contre-témoins : juste avant chaque seuil, rien ne bouge ; la clôture
 * CONSERVE le dernier signe de vie (sinon elle repousserait la suivante).
 * Angle mort : sans la PR 4, la clôture ne tourne qu'à la requête suivante de
 * l'extension (garde commune), pas toutes les 5 minutes.
 */

import { describe, expect, it } from "vitest";

import { cloturerEnregistrements, decisionCloture } from "../cloture";
import {
  commePrisma,
  fausseBase,
  MINUTE,
  semerAppareil,
  semerEnregistrement,
  semerRencontreTest,
  T0,
} from "../../../../tests/outils/fixtures-enregistreur";

const plus = (m: number) => new Date(T0.getTime() + m * MINUTE);

describe("⛔ un enregistrement abandonné est clôturé par le serveur", () => {
  it("décisions pures, juste avant et juste après chaque seuil", () => {
    const base = { debut: T0, updatedAt: T0, finPrevueRencontre: plus(30) };
    expect(decisionCloture({ ...base, statut: "accord_en_attente" }, plus(3)).action).toBe(
      "aucune",
    );
    expect(decisionCloture({ ...base, statut: "accord_en_attente" }, plus(3.1)).action).toBe(
      "accord_non_confirme",
    );
    expect(decisionCloture({ ...base, statut: "en_cours" }, plus(10)).action).toBe("aucune");
    expect(decisionCloture({ ...base, statut: "en_cours" }, plus(10.1)).action).toBe("interrompre");
    // Repère = fin prévue (T0+30) > dernier signe (T0) : dépôt après T0+30+120.
    expect(decisionCloture({ ...base, statut: "interrompu" }, plus(150)).action).toBe("aucune");
    expect(decisionCloture({ ...base, statut: "interrompu" }, plus(151)).action).toBe(
      "deposer_incomplet",
    );
    expect(decisionCloture({ ...base, statut: "depose" }, plus(10_000)).action).toBe("aucune");
  });

  it("la passe applique les trois clôtures et garde le dernier signe de vie", async () => {
    const db = fausseBase();
    const { appareilId } = semerAppareil(db);
    const r1 = semerRencontreTest(db).rencontreId;
    const r2 = semerRencontreTest(db).rencontreId;
    const r3 = semerRencontreTest(db, { debutPrevu: T0 }).rencontreId;
    semerEnregistrement(db, {
      rencontreId: r1,
      appareilId,
      statut: "accord_en_attente",
      debut: T0,
      updatedAt: T0,
    });
    semerEnregistrement(db, {
      rencontreId: r2,
      appareilId,
      statut: "en_cours",
      updatedAt: plus(200),
    });
    semerEnregistrement(db, {
      rencontreId: r3,
      appareilId,
      statut: "interrompu",
      updatedAt: plus(20),
    });

    const bilan = await cloturerEnregistrements(commePrisma(db), plus(215));
    expect(bilan).toEqual({ accordNonConfirme: 1, interrompus: 1, deposes: 1 });

    const par = (r: string) => db.lignes("enregistrement").find((e) => e["rencontreId"] === r);
    expect(par(r1)?.["statut"]).toBe("accord_non_confirme");
    expect(par(r2)?.["statut"]).toBe("interrompu");
    expect((par(r2)?.["updatedAt"] as Date).getTime()).toBe(plus(200).getTime());
    expect(par(r3)?.["statut"]).toBe("depose");
    expect(par(r3)?.["incomplet"]).toBe(true);
    expect(par(r3)?.["motifArret"]).toBe("cloture_serveur");
    expect((par(r3)?.["fin"] as Date).getTime()).toBe(plus(20).getTime());
  });
});
