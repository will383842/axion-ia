// @vitest-environment node
//
// Lot L3b — contrat de la synchro v3 vers le CRM : interrupteur éteint = rien en file, et charge
// émise conforme à la FIXTURE JSON PARTAGÉE (`fixtures/charge-crm-v3.json`, à copier à l'identique
// côté CRM pour son test de lecteur v3). Adresses en `.test`, jetons fictifs.
import { describe, it, expect, vi } from "vitest";
import fixture from "./fixtures/charge-crm-v3.json";

vi.mock("@/lib/prisma", () => ({ prisma: {} }));

import { chargeCrmV3 } from "../synchro-v3";
import { construireOrigine } from "../origines";
import { analyserCorps } from "../contrat";

const demande = () => {
  const r = analyserCorps(
    Buffer.from(
      JSON.stringify({
        schemaVersion: 3,
        cleIdempotence: "run_zernio_0001",
        email: "personne@exemple.test",
        mot: "guide",
        reseau: "instagram",
        guide: "guide-ia",
        accord: "non_demande",
        versionTexteM1: "m1-brouillon-v1",
        post_ref: "post_ref_test_01",
        canal: "commentaire",
        famille: "guide_reseau",
        detail: "autre_non_classe",
        compte: "page_principale",
        version_texte: "m1-v1",
        utm_campaign: "guide_reseau",
        commentaire_ref: "comm_ref_test_01",
      }),
    ),
  );
  if (!r.ok || !r.demande) throw new Error("fixture invalide");
  return r.demande;
};
const quand = new Date(Date.UTC(2026, 10, 1, 10, 0, 0));
const charge = () => {
  const c = chargeCrmV3([construireOrigine(demande(), quand)]);
  if (!c.ok) throw new Error("charge invalide");
  return c.charge;
};

describe("synchro v3 — contrat de la charge", () => {
  it("charge conforme au schéma CRM (fixture JSON partagée)", () => {
    expect(charge()).toEqual(fixture.payload);
  });

  it("la charge ne porte ni jeton de commentaire (même en HMAC) ni pseudo ni texte", () => {
    const texte = JSON.stringify(charge());
    expect(texte).not.toContain("comm_ref_test_01");
    expect(texte).not.toMatch(/"(commentaire_ref|pseudo|texte|nom)"/);
  });
});
