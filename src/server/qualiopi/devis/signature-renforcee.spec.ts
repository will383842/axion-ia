import { describe, expect, it } from "vitest";
import { getLegal } from "@/content/legal";
import {
  CODE_DEVIS_BLOCAGE_MS,
  CODE_DEVIS_ENVOIS_PAR_HEURE_PAR_LIEN,
  CODE_DEVIS_ESSAIS_MAX,
  CODE_DEVIS_VALIDITE_MS,
  codeAssezRecent,
  decisionEnvoiCode,
  libelleValiditeCode,
  normaliserSaisie,
  validerDeclaration,
} from "./signature-renforcee";
import { CODE_ESSAIS_MAX } from "@/server/qualiopi/documents/signature/code-signature";

const T = new Date("2026-11-07T10:00:00.000Z");
const avant = (ms: number) => new Date(T.getTime() - ms);

describe("validerDeclaration", () => {
  it("accepte nom, fonction et pouvoir EXACTEMENT true ; normalise les espaces", () => {
    const r = validerDeclaration({
      nom: "  Jeanne   Martin ",
      fonction: "Directrice générale",
      pouvoirEngager: true,
    });
    expect(r).toEqual({
      ok: true,
      declaration: { nom: "Jeanne Martin", fonction: "Directrice générale" },
    });
  });

  it("refuse un pouvoir non coché, sous toute forme", () => {
    for (const pouvoirEngager of [false, "true", 1, "on", null, undefined]) {
      expect(
        validerDeclaration({ nom: "Jeanne Martin", fonction: "DG", pouvoirEngager }),
      ).toMatchObject({
        ok: false,
        raison: "pouvoir_non_declare",
      });
    }
  });

  it("refuse un nom ou une fonction absents, trop courts, trop longs ou non textuels", () => {
    for (const nom of ["", " ", "J", "x".repeat(201), 12, null, undefined, {}]) {
      expect(validerDeclaration({ nom, fonction: "DG", pouvoirEngager: true })).toMatchObject({
        ok: false,
        raison: "nom_invalide",
      });
    }
    for (const fonction of ["", "  ", "D", "y".repeat(201), 3, undefined]) {
      expect(
        validerDeclaration({ nom: "Jeanne Martin", fonction, pouvoirEngager: true }),
      ).toMatchObject({
        ok: false,
        raison: "fonction_invalide",
      });
    }
  });

  it("refuse les caractères de commande, séparateurs de ligne et marques bidirectionnelles", () => {
    for (const mauvais of [
      "Jeanne\nMartin",
      "Jeanne\tMartin",
      "Jeanne\u0000Martin",
      "Jeanne‮Martin",
      "Jeanne Martin",
      "Jeanne​Martin",
    ]) {
      expect(normaliserSaisie(mauvais)).toBeNull();
    }
  });

  it("garde les caractères accentués et les noms composés", () => {
    expect(normaliserSaisie("Anne-Sophie d'Écosse")).toBe("Anne-Sophie d'Écosse");
  });
});

describe("longueur du nom et de la fonction : points de code Unicode (comme length() SQL)", () => {
  const saisie = (nom: string, fonction = "DG") =>
    validerDeclaration({ nom, fonction, pouvoirEngager: true });

  it("un emoji est UN caractère : « 😀 » seul est trop court, « 😀😀 » suffit", () => {
    expect(saisie("😀")).toMatchObject({ ok: false, raison: "nom_invalide" });
    expect(saisie("😀😀")).toMatchObject({ ok: true });
  });

  it("200 emojis (400 unités UTF-16) passent ; 201 sont refusés proprement, sans lever", () => {
    expect(saisie("😀".repeat(200))).toMatchObject({ ok: true });
    expect(() => saisie("😀".repeat(201))).not.toThrow();
    expect(saisie("😀".repeat(201))).toMatchObject({ ok: false, raison: "nom_invalide" });
    expect(saisie("Jeanne", "🧑‍💼".repeat(100))).toMatchObject({
      ok: false,
      raison: "fonction_invalide",
    });
  });

  it("ce qui passe tient dans VARCHAR(200) : jamais plus de 200 points de code", () => {
    const r = saisie("é".repeat(200));
    expect(r.ok && Array.from(r.declaration.nom).length).toBe(200);
  });

  it("un demi-substitut isolé (UTF-8 invalide pour Postgres) est refusé, jamais écrit", () => {
    expect(saisie("Jeanne \ud83d")).toMatchObject({ ok: false, raison: "nom_invalide" });
    expect(saisie("\ude00 Martin")).toMatchObject({ ok: false, raison: "nom_invalide" });
  });
});

describe("décision d'envoi du code", () => {
  const libre = {
    maintenant: T,
    envoisDuLien: [] as Date[],
    envoisDeLaPiece: 0,
    bloqueJusquA: null,
  };

  it("laisse passer une première demande", () => {
    expect(decisionEnvoiCode(libre)).toEqual({ ok: true });
  });

  it("une minute entre deux envois (borne exacte)", () => {
    expect(decisionEnvoiCode({ ...libre, envoisDuLien: [avant(59_999)] })).toEqual({
      ok: false,
      raison: "trop_tot",
    });
    expect(decisionEnvoiCode({ ...libre, envoisDuLien: [avant(60_000)] })).toEqual({ ok: true });
  });

  it("au plus 5 envois par heure et par lien ; 8 par pièce", () => {
    const cinq = Array.from({ length: CODE_DEVIS_ENVOIS_PAR_HEURE_PAR_LIEN }, (_, i) =>
      avant(120_000 + i * 1000),
    );
    expect(decisionEnvoiCode({ ...libre, envoisDuLien: cinq })).toEqual({
      ok: false,
      raison: "trop_de_codes",
    });
    expect(decisionEnvoiCode({ ...libre, envoisDeLaPiece: 8 })).toEqual({
      ok: false,
      raison: "trop_de_codes",
    });
    expect(decisionEnvoiCode({ ...libre, envoisDeLaPiece: 7 })).toEqual({ ok: true });
  });

  it("le blocage prime sur tout, et tombe à son échéance (borne exclue)", () => {
    expect(decisionEnvoiCode({ ...libre, bloqueJusquA: new Date(T.getTime() + 1) })).toEqual({
      ok: false,
      raison: "bloque",
    });
    expect(decisionEnvoiCode({ ...libre, bloqueJusquA: T })).toEqual({ ok: true });
  });
});

describe("le code consommé doit être récent", () => {
  it("valable 10 minutes, borne incluse ; jamais dans le futur", () => {
    expect(codeAssezRecent(avant(CODE_DEVIS_VALIDITE_MS), T)).toBe(true);
    expect(codeAssezRecent(avant(CODE_DEVIS_VALIDITE_MS + 1), T)).toBe(false);
    expect(codeAssezRecent(new Date(T.getTime() + 1), T)).toBe(false);
  });
});

describe("les constantes disent la même chose que les CGV et le mécanisme", () => {
  const cgv = getLegal("conditions-generales")
    .fr.sections.map((s) => s.body)
    .join("\n");

  it("10 minutes, 5 essais, blocage de 15 minutes", () => {
    expect(CODE_DEVIS_VALIDITE_MS).toBe(10 * 60 * 1000);
    expect(libelleValiditeCode()).toBe("10 minutes");
    expect(CODE_DEVIS_ESSAIS_MAX).toBe(CODE_ESSAIS_MAX);
    expect(CODE_DEVIS_BLOCAGE_MS).toBe(15 * 60 * 1000);
  });

  it("les CGV annoncent la même durée et le même nombre d'essais que le code réel", () => {
    expect(cgv).toContain("six chiffres, valable dix minutes");
    expect(cgv).toContain("limité à cinq essais");
  });

  it("les CGV : le contrat est formé à la contresignature, signature électronique simple (pas avancée ni qualifiée)", () => {
    expect(cgv).toMatch(/Le contrat est formé à la contresignature d'Axion-IA/);
    expect(cgv).toMatch(/signature électronique simple/);
    expect(cgv).toMatch(/ni une signature avancée, ni une signature qualifiée/);
    expect(cgv).toMatch(/RFC 3161/);
    // Jamais de capital social dans les CGV (décision de Will).
    expect(cgv).not.toMatch(/capital/i);
  });
});
