/**
 * ⛔ UNE RENCONTRE APPORTEUR OU UN ENTRETIEN EST REFUSÉ (PR 5, PA-9).
 *
 * Seuls les rendez-vous « Discutons de votre projet IA » (et les visios créées
 * dans la console) s'enregistrent. Un échange avec un candidat apporteur, un
 * type hors liste blanche, ou un entretien de candidat prévu à ±30 min :
 * 409 motivé, aucun enregistrement créé.
 *
 * Mutation qui rougit : retirer l'étape « entretien à ±30 min » de
 * `motifDeRefus` → le 3ᵉ cas crée un enregistrement. Contre-témoin : un
 * « Discutons » sans entretien autour est accepté.
 * Angle mort : un entretien planifié HORS Calendly n'est pas vu.
 */

import { describe, expect, it } from "vitest";

import { creerOuReprendreSession } from "../sessions";
import {
  commePrisma,
  corpsSession,
  fausseBase,
  MINUTE,
  semerAppareil,
  semerRencontreCalendly,
  T0,
} from "../../../../tests/outils/fixtures-enregistreur";

async function demarrer(db: ReturnType<typeof fausseBase>, rencontreId: string) {
  const { appareilId, adminUserId } = semerAppareil(db);
  return creerOuReprendreSession(commePrisma(db), {
    appareil: { id: appareilId, adminUserId },
    corps: corpsSession(rencontreId),
    mode: "ouvert",
    maintenant: T0,
  });
}

describe("⛔ une rencontre apporteur ou un entretien est refusé", () => {
  it("échange apporteur : 409 « apporteur »", async () => {
    const db = fausseBase();
    const { rencontreId } = semerRencontreCalendly(db, {
      eventTypeName: "Échange apporteur d'affaires (15 min)",
    });
    const r = await demarrer(db, rencontreId as string);
    expect(r.statut).toBe(409);
    expect(r.corps["erreur"]).toBe("apporteur");
    expect(db.lignes("enregistrement")).toHaveLength(0);
  });

  it("type hors liste blanche : 409 « hors_liste_blanche »", async () => {
    const db = fausseBase();
    const { rencontreId } = semerRencontreCalendly(db, { eventTypeName: "Point formation (1 h)" });
    const r = await demarrer(db, rencontreId as string);
    expect(r.statut).toBe(409);
    expect(r.corps["erreur"]).toBe("hors_liste_blanche");
  });

  it("un entretien de candidat à ±30 min : 409 « entretien_candidat »", async () => {
    const db = fausseBase();
    const { rencontreId } = semerRencontreCalendly(db);
    semerRencontreCalendly(db, {
      eventTypeName: "Entretien de recrutement",
      startTime: new Date(T0.getTime() + 20 * MINUTE),
      linkedJobApplicationId: "3f1c2a4e-8b7d-4c1e-9a2b-1c2d3e4f5a6b",
      avecRencontre: false,
    });
    const r = await demarrer(db, rencontreId as string);
    expect(r.statut).toBe(409);
    expect(r.corps["erreur"]).toBe("entretien_candidat");
    expect(db.lignes("enregistrement")).toHaveLength(0);
  });

  it("contre-témoin : un « Discutons » sans entretien autour est accepté", async () => {
    const db = fausseBase();
    const { rencontreId } = semerRencontreCalendly(db);
    semerRencontreCalendly(db, {
      eventTypeName: "Entretien de recrutement",
      startTime: new Date(T0.getTime() + 3 * 60 * MINUTE),
      avecRencontre: false,
    });
    const r = await demarrer(db, rencontreId as string);
    expect(r.statut).toBe(200);
    expect(r.corps["statut"]).toBe("accord_en_attente");
  });

  it("une rencontre de reprise d'historique ne s'enregistre jamais", async () => {
    const db = fausseBase();
    const { rencontreId } = semerRencontreCalendly(db);
    const r0 = db.lignes("rencontre").find((l) => l["id"] === rencontreId);
    if (r0) r0["repriseHistorique"] = true;
    const r = await demarrer(db, rencontreId as string);
    expect(r.corps["erreur"]).toBe("reprise_historique");
  });
});
