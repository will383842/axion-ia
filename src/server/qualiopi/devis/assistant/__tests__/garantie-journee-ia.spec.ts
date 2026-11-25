/**
 * Garantie de remboursement de la Journée IA imprimée sur le devis (conditions particulières) :
 * constante assemblée, paragraphe de prix unique, aller-retour du brouillon, conversion et
 * réouverture depuis la colonne `Devis.journeeIa`.
 */
import { describe, expect, it, vi } from "vitest";

vi.mock("@/lib/prisma", () => ({ prisma: {} }));
vi.mock("@/auth", () => ({ auth: vi.fn() }));

import { CONDITION_GARANTIE, GARANTIE_PHRASE } from "@/content/journee-ia-commun";
import {
  CONDITIONS_PARTICULIERES_LIGNES_MAX,
  CONDITIONS_PARTICULIERES_MAX,
  avecGarantieJourneeIa,
  nombreDeLignes,
} from "@/server/qualiopi/devis/conditions-particulieres";
import { conditionsAvecJourneeIa } from "@/server/qualiopi/devis/champs-classiques";
import { computeTotauxFacture } from "@/server/qualiopi/legal/tva";
import { etatInitial } from "@/components/admin/qualiopi/assistant-devis/etat";
import {
  etatVersPayload,
  payloadVersEtat,
} from "@/components/admin/qualiopi/assistant-devis/vers-payload";
import { controlerEcheancier, texteConditionsPrixUnique } from "../conditions-prix-unique";
import { devisVersPayload, payloadVersCreation } from "../conversion";
import { lirePayload, payloadVide, type PayloadAssistantV1 } from "../payload";
import { TEXTE_GARANTIE_JOURNEE_IA } from "../textes-rubriques";

describe("TEXTE_GARANTIE_JOURNEE_IA", () => {
  it("est assemblé depuis le socle commun, sans le réécrire", () => {
    expect(TEXTE_GARANTIE_JOURNEE_IA).toBe(
      `Garantie de remboursement de la Journée IA (article 47.10 des conditions générales). ${GARANTIE_PHRASE} ${CONDITION_GARANTIE}`,
    );
    expect(TEXTE_GARANTIE_JOURNEE_IA).toContain(GARANTIE_PHRASE);
    expect(TEXTE_GARANTIE_JOURNEE_IA).toContain(CONDITION_GARANTIE);
  });

  it("ne porte aucun montant, aucun mot interdit", () => {
    expect(TEXTE_GARANTIE_JOURNEE_IA).not.toMatch(/€|euro|\d\s?%/i);
    // Le seul chiffre est le renvoi à l'article 47.10 et le multiple de la garantie (« 3 fois »).
    expect(TEXTE_GARANTIE_JOURNEE_IA.replace("47.10", "")).not.toMatch(/\d{2,}/);
    for (const mot of [
      "grenoble",
      "aucun gain garanti",
      "sans discussion",
      "nous vous remboursons",
      "déplacement",
    ])
      expect(TEXTE_GARANTIE_JOURNEE_IA.toLowerCase()).not.toContain(mot);
  });
});

function payload(journeeIa: boolean): PayloadAssistantV1 {
  const p = payloadVide(20);
  p.typeDevis = "classique";
  p.clientId = "00000000-0000-4000-8000-000000000001";
  p.activite = "audit";
  p.lignesClassiques = [{ designation: "Journée IA", quantite: "1", prixEur: "1000" }];
  p.formules.achat.phases = [
    { libelle: "Acompte", pourcentage: "50", declencheur: "signature" },
    { libelle: "Solde", pourcentage: "50", declencheur: "livraison" },
  ];
  p.journeeIa = journeeIa;
  return p;
}
const totaux = computeTotauxFacture(
  [{ quantite: 1, prixUnitaireHtCents: 100000 }],
  "assujetti",
  20,
);

describe("conditions de prix unique avec / sans journeeIa", () => {
  it("sans la case : aucun paragraphe de garantie Journée IA", () => {
    const r = texteConditionsPrixUnique(payload(false), totaux, "assujetti");
    if ("erreurs" in r) throw new Error(JSON.stringify(r.erreurs));
    expect(r.texte).not.toContain(TEXTE_GARANTIE_JOURNEE_IA);
  });

  it("avec la case : paragraphe imprimé une fois, l'échéancier reste contrôlable", () => {
    const r = texteConditionsPrixUnique(payload(true), totaux, "assujetti");
    if ("erreurs" in r) throw new Error(JSON.stringify(r.erreurs));
    expect(r.texte.split(TEXTE_GARANTIE_JOURNEE_IA)).toHaveLength(2);
    expect(r.texte.length).toBeLessThanOrEqual(CONDITIONS_PARTICULIERES_MAX);
    expect(nombreDeLignes(r.texte)).toBeLessThanOrEqual(CONDITIONS_PARTICULIERES_LIGNES_MAX);
    expect(controlerEcheancier(r.texte, totaux.totalTtcCents, "assujetti")).toBe(true);
  });
});

describe("aller-retour du brouillon", () => {
  it("faux par défaut, relu tel quel, et un champ de mauvais type retombe à faux", () => {
    expect(payloadVide(20).journeeIa).toBe(false);
    const lu = lirePayload(JSON.parse(JSON.stringify(payload(true))));
    expect(lu.ok && lu.payload.journeeIa).toBe(true);
    const mauvais = lirePayload({ ...payload(true), journeeIa: "oui" });
    expect(mauvais.ok && mauvais.payload.journeeIa).toBe(false);
  });

  it("état d'écran → payload → état : la case survit ; formules : jamais envoyée", () => {
    const ctx = { tvaStandardPct: 20, textes: [] };
    const e = {
      ...etatInitial({ validiteParDefaut: "", formulesActives: true }),
      garantieJournee: true,
    };
    const p = etatVersPayload(e, 1, ctx);
    expect(p.typeDevis).toBe("classique");
    expect(p.journeeIa).toBe(true);
    expect(payloadVersEtat(p).etat.garantieJournee).toBe(true);
    const f = etatVersPayload(
      { ...e, proposition: "A", modele: "implementation", clientType: "entreprise" },
      1,
      ctx,
    );
    expect(f.typeDevis).toBe("formules");
    expect(f.journeeIa).toBe(false);
  });

  it("la colonne fait foi à la réouverture (devis classique)", () => {
    const base = {
      id: "d1",
      clientId: "c1",
      refClient: null,
      activite: null,
      dateValidite: null,
      updatedAt: new Date("2026-11-25T10:00:00Z"),
      offre: null,
      lignes: [{ designation: "x", quantite: 1, prixUnitaireHtCents: 100000 }],
    };
    const avec = devisVersPayload({ ...base, journeeIa: true }, 20);
    const sans = devisVersPayload(base, 20);
    expect("payload" in avec && avec.payload.journeeIa).toBe(true);
    expect("payload" in sans && sans.payload.journeeIa).toBe(false);
  });
});

describe("conversion vers l'entrée du devis classique", () => {
  const ctx = { tauxStandard: 20 } as never;
  it("transmet journeeIa (vrai ET faux, pour pouvoir décocher)", () => {
    for (const v of [true, false]) {
      const r = payloadVersCreation(payload(v), ctx);
      if (!("type" in r) || r.type !== "classique") throw new Error(JSON.stringify(r));
      expect(r.input.journeeIa).toBe(v);
      expect(r.input.conditionsParticulieres?.includes(TEXTE_GARANTIE_JOURNEE_IA)).toBe(v);
    }
  });
});

describe("avecGarantieJourneeIa / conditionsAvecJourneeIa (formulaire classique)", () => {
  it("ajoute, est idempotent, retire", () => {
    const ajoute = avecGarantieJourneeIa("Mon texte", true);
    expect(ajoute).toBe(`Mon texte\n\n${TEXTE_GARANTIE_JOURNEE_IA}`);
    expect(avecGarantieJourneeIa(ajoute, true)).toBe(ajoute);
    expect(avecGarantieJourneeIa(ajoute, false)).toBe("Mon texte");
    expect(avecGarantieJourneeIa(TEXTE_GARANTIE_JOURNEE_IA, false)).toBeNull();
    expect(avecGarantieJourneeIa(null, true)).toBe(TEXTE_GARANTIE_JOURNEE_IA);
    expect(avecGarantieJourneeIa("Mon  texte ", false)).toBe("Mon  texte ");
  });

  it("refuse un texte qui dépasserait 4 000 caractères avec le paragraphe", () => {
    const long = "a".repeat(CONDITIONS_PARTICULIERES_MAX - 10);
    expect("error" in conditionsAvecJourneeIa(long, true)).toBe(true);
    expect("texte" in conditionsAvecJourneeIa("court", true)).toBe(true);
  });
});
