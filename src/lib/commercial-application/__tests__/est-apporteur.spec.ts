// Le prédicat « cette submission est-elle un dossier apporteur ? ».
//
// ── Pourquoi il mérite ses propres tests ──────────────────────────────────
// Depuis la décision B2 du 19/09, un dossier apporteur ne part plus au CRM. Le
// rapprochement quotidien (`crm-sync/reconcile.ts`) doit donc cesser de le
// réclamer, sinon chaque candidature déclenche une alerte « émission perdue »
// qui n'en est pas une — et une alerte qui crie à tort apprend à ne plus lire.
//
// Le prédicat est la frontière entre ce qui DOIT avoir une ligne d'outbox et ce
// qui ne le doit pas. Trop large, il masquerait une vraie perte côté clients ;
// trop étroit, il ferait crier le rapport. Les deux sens sont testés.

import { describe, expect, it } from "vitest";
import type { Prisma } from "../../../../prisma/generated/client";
import { FILTRE_APPORTEUR_PRISMA, estApporteur } from "../est-apporteur";

describe("estApporteur — les quatre combinaisons unifiedType × subType", () => {
  it("recrutement + candidature-commerciale : c'est un dossier apporteur", () => {
    expect(estApporteur({ unifiedType: "recrutement", subType: "candidature-commerciale" })).toBe(
      true,
    );
  });

  it("recrutement SANS le sous-type : c'est le /contact « recrutement », pas un apporteur", () => {
    // 🔑 Le cas qui compte le plus : ce message-là reste soumis aux drapeaux du
    // vivier CRM (ADR 0051 § l). Le compter comme apporteur le sortirait du
    // rapprochement, et une vraie perte d'émission deviendrait invisible.
    expect(estApporteur({ unifiedType: "recrutement" })).toBe(false);
    expect(estApporteur({ unifiedType: "recrutement", subType: "autre" })).toBe(false);
  });

  it("le sous-type SANS unifiedType recrutement : pas un apporteur", () => {
    // Les deux clés sont exigées ensemble. Un sous-type seul, venu d'un autre
    // formulaire ou d'une saisie partielle, ne suffit pas à sortir une ligne
    // du rapprochement.
    expect(estApporteur({ unifiedType: "projet", subType: "candidature-commerciale" })).toBe(false);
    expect(estApporteur({ subType: "candidature-commerciale" })).toBe(false);
  });

  it("ni l'un ni l'autre : une demande client ordinaire", () => {
    expect(estApporteur({ unifiedType: "projet", subType: "formation" })).toBe(false);
    expect(estApporteur({})).toBe(false);
  });
});

describe("estApporteur — lecture défensive d'un JSON venu de la base", () => {
  it("details null, absent, scalaire ou tableau : jamais un apporteur, jamais une exception", () => {
    // `Submission.details` est un JSON libre : une ligne ancienne ou partielle
    // peut porter n'importe quoi. Le prédicat tourne dans le batch quotidien —
    // une exception ici ferait échouer TOUT le rapprochement, pas une ligne.
    for (const valeur of [null, undefined, "recrutement", 42, true]) {
      expect(estApporteur(valeur), String(valeur)).toBe(false);
    }
    expect(estApporteur(["recrutement", "candidature-commerciale"])).toBe(false);
    expect(estApporteur([{ unifiedType: "recrutement", subType: "candidature-commerciale" }])).toBe(
      false,
    );
  });
});

describe("FILTRE_APPORTEUR_PRISMA — le même critère, côté requête", () => {
  it("exige les DEUX chemins JSON, exactement les valeurs du prédicat", () => {
    expect(FILTRE_APPORTEUR_PRISMA).toEqual({
      AND: [
        { details: { path: ["unifiedType"], equals: "recrutement" } },
        { details: { path: ["subType"], equals: "candidature-commerciale" } },
      ],
    });
  });

  it("est un `where` Prisma valide pour Submission (vérifié par le typage)", () => {
    // Si la forme divergeait du type attendu par Prisma, ce fichier cesserait de
    // compiler : c'est `pnpm typecheck` qui porte l'assertion, pas l'exécution.
    const where: Prisma.SubmissionWhereInput = FILTRE_APPORTEUR_PRISMA;
    expect(where).toBe(FILTRE_APPORTEUR_PRISMA);
  });
});
