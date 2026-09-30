/**
 * Un accord local rejoué au `POST sessions` est accepté (PR 5) : le site était
 * injoignable au clic « Accord obtenu » ; l'extension crée la session au
 * retour du réseau, avec `accordLocalLe`. Dans le délai de 3 min, la session
 * naît `en_cours`, la preuve d'accord et l'information au registre sont écrites
 * (JAMAIS `optin`). Hors délai, l'accord n'est pas retenu.
 */

import { describe, expect, it } from "vitest";

import { creerOuReprendreSession } from "../sessions";
import {
  CLE_DE_TEST,
  commePrisma,
  corpsSession,
  fausseBase,
  MINUTE,
  semerAppareil,
  semerRencontreCalendly,
  T0,
} from "../../../../tests/outils/fixtures-enregistreur";

describe("un accord local rejoué au POST sessions est accepté", () => {
  it("accord à +2 min : session en_cours, preuve declaration_axion, information au registre", async () => {
    process.env["PII_ENCRYPTION_KEY"] = CLE_DE_TEST;
    const db = fausseBase();
    const { appareilId, adminUserId } = semerAppareil(db);
    const { rencontreId } = semerRencontreCalendly(db);
    const r = await creerOuReprendreSession(commePrisma(db), {
      appareil: { id: appareilId, adminUserId },
      corps: corpsSession(rencontreId as string, {
        accordLocalLe: new Date(T0.getTime() + 2 * MINUTE),
      }),
      mode: "ouvert",
      maintenant: new Date(T0.getTime() + 20 * MINUTE),
    });
    expect(r.statut).toBe(200);
    expect(r.corps["statut"]).toBe("en_cours");
    const preuves = db.lignes("enregistrementConsentement");
    expect(preuves.map((p) => p["type"])).toEqual(["declaration_axion"]);
    const registre = db.lignes("consentEvent");
    expect(registre).toHaveLength(1);
    expect(registre[0]?.["action"]).toBe("information");
    expect(registre[0]?.["formRef"]).toBe("enregistrement-visio-annonce");
  });

  it("accord à +4 min (hors délai) : non retenu, la session attend l'accord", async () => {
    const db = fausseBase();
    const { appareilId, adminUserId } = semerAppareil(db);
    const { rencontreId } = semerRencontreCalendly(db);
    const r = await creerOuReprendreSession(commePrisma(db), {
      appareil: { id: appareilId, adminUserId },
      corps: corpsSession(rencontreId as string, {
        accordLocalLe: new Date(T0.getTime() + 4 * MINUTE),
      }),
      mode: "ouvert",
      maintenant: T0,
    });
    expect(r.corps["statut"]).toBe("accord_en_attente");
    expect(db.lignes("enregistrementConsentement")).toHaveLength(0);
  });

  it("rejouer la même création rend le même enregistrement (repris), sans doublon", async () => {
    const db = fausseBase();
    const { appareilId, adminUserId } = semerAppareil(db);
    const { rencontreId } = semerRencontreCalendly(db);
    const corps = corpsSession(rencontreId as string);
    const entree = {
      appareil: { id: appareilId, adminUserId },
      corps,
      mode: "ouvert" as const,
      maintenant: T0,
    };
    const a = await creerOuReprendreSession(commePrisma(db), entree);
    const b = await creerOuReprendreSession(commePrisma(db), entree);
    expect(b.corps["enregistrementId"]).toBe(a.corps["enregistrementId"]);
    expect(b.corps["repris"]).toBe(true);
    expect(db.lignes("enregistrement")).toHaveLength(1);
  });
});
