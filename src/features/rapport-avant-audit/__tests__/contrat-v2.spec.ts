/** Contrat `base-audit/2` : la V1 passe toujours, une V2 fictive passe, un cas négatif par règle. */
import { describe, expect, it } from "vitest";

import { BaseAuditSchema } from "../base-audit-schema";
import type { Automatisation, BaseAudit } from "../base-audit-schema";
import { automatisationExemple, baseValide, baseValideV2 } from "./base.fixture";

const ok = (b: unknown): boolean => BaseAuditSchema.safeParse(b).success;

function messages(b: unknown): string {
  const r = BaseAuditSchema.safeParse(b);
  return r.success ? "" : r.error.issues.map((i) => i.message).join(" | ");
}

/** Une V2 dont on modifie la liste d'automatisations. */
function avec(f: (liste: Automatisation[], b: BaseAudit) => void): BaseAudit {
  const b = structuredClone(baseValideV2());
  f(b.automatisations!.liste, b);
  return b;
}

describe("base-audit/1 et /2", () => {
  it("la base de référence V1 passe toujours (sans les champs V2)", () => {
    const b = baseValide();
    expect(b.contexte_interne).toBeUndefined();
    expect(ok(b)).toBe(true);
  });

  it("la base de référence V2 (fictive) passe", () => {
    expect(messages(baseValideV2())).toBe("");
  });

  it("refuse une version inconnue", () => {
    expect(ok({ ...baseValideV2(), version: "base-audit/3" })).toBe(false);
  });

  it("V2 : le contexte interne est obligatoire", () => {
    const b = structuredClone(baseValideV2());
    delete (b as { contexte_interne?: unknown }).contexte_interne;
    expect(messages(b)).toContain("contexte interne");
    expect(ok({ ...baseValideV2(), contexte_interne: null })).toBe(false);
  });

  it("V2 : les automatisations sont obligatoires, mais peuvent valoir null avec une limite", () => {
    const b = structuredClone(baseValideV2());
    delete (b as { automatisations?: unknown }).automatisations;
    expect(ok(b)).toBe(false);
    expect(ok({ ...baseValideV2(), automatisations: null })).toBe(false); // sans limite
    const avecLimite = baseValideV2();
    expect(
      ok({
        ...avecLimite,
        automatisations: null,
        meta: { ...avecLimite.meta, limites: ["Les automatisations n'ont pas pu être produites."] },
      }),
    ).toBe(true);
  });
});

describe("automatisations — une règle, un cas négatif", () => {
  it("ids uniques", () => {
    expect(messages(avec((l) => (l[1]!.id = "A1")))).toContain("en double");
  });

  it("dependDe ne cite que des A existants", () => {
    expect(messages(avec((l) => (l[1]!.dependDe = ["A9"])))).toContain("n'existe pas");
  });

  it("une formule ne cite que des A existants", () => {
    expect(
      messages(avec((_l, b) => (b.automatisations!.formules[0]!.ids = ["A1", "A7"]))),
    ).toContain("La formule");
  });

  it("une formule cite au moins une automatisation", () => {
    expect(ok(avec((_l, b) => (b.automatisations!.formules[0]!.ids = [])))).toBe(false);
  });

  it("pas de boucle", () => {
    const b = avec((l) => {
      l[0]!.dependDe = ["A2"];
      l[0]!.estSocle = false;
    });
    expect(messages(b)).toContain("boucle");
  });

  it("pas de dépendance à soi-même", () => {
    expect(messages(avec((l) => (l[2]!.dependDe = ["A3"])))).toContain("d'elle-même");
  });

  it("la dépendance se met en place avant celle qui en dépend", () => {
    expect(
      messages(
        avec((l) => {
          l[0]!.ordreMiseEnPlace = 2;
          l[1]!.ordreMiseEnPlace = 2;
        }),
      ),
    ).toContain("avant");
  });

  it("rangImportance = suite 1..n sans trou", () => {
    expect(messages(avec((l) => (l[2]!.rangImportance = 5)))).toContain("1..n");
    expect(messages(avec((l) => (l[2]!.rangImportance = 2)))).toContain("1..n");
  });

  it("catalogue ⇔ catalogueId non nul", () => {
    expect(messages(avec((l) => (l[0]!.catalogueId = null)))).toContain("catalogue");
    expect(messages(avec((l) => (l[2]!.catalogueId = "x-y")))).toContain("catalogue");
  });

  it("base unique : le socle, ou une automatisation qui en dépend", () => {
    expect(messages(avec((l) => (l[2]!.groupe = "base_unique")))).toContain("base unique");
    // Un socle n'a pas besoin de dépendre d'un autre ; une dépendante d'un socle passe.
    expect(ok(avec((l) => (l[1]!.groupe = "base_unique")))).toBe(true);
  });

  it("hors demande : sans douleur ou sans besoin servi, c'est refusé ; hors demande, c'est permis", () => {
    expect(messages(avec((l) => (l[2]!.douleurs = [])))).toContain("douleur");
    expect(messages(avec((l) => (l[2]!.besoinsServis = [])))).toContain("besoin");
    expect(messages(avec((l) => (l[2]!.besoinsServis = ["B9"])))).toContain("n'existe pas");
    expect(
      ok(
        avec((l) => {
          l[2]!.horsDemande = true;
          l[2]!.douleurs = [];
          l[2]!.besoinsServis = [];
        }),
      ),
    ).toBe(true);
  });

  it("un prix n'est jamais fixé dans la base", () => {
    const a = { ...automatisationExemple("A1"), prix: { etat: "fixe", montant: 10 } };
    expect(ok(avec((l) => (l[0] = a as unknown as Automatisation)))).toBe(false);
  });

  it("budget « déclaré » : au moins une citation", () => {
    const b = structuredClone(baseValideV2());
    b.contexte_interne!.budget = {
      etat: "declare",
      elements: [{ enonce: "Un budget", citations: [] }],
    };
    expect(messages(b)).toContain("citation");
    b.contexte_interne!.budget = { etat: "non_repondu", elements: [] };
    expect(ok(b)).toBe(true);
  });
});
