// @vitest-environment node
/**
 * ⛔ L'identifiant d'une tâche visio passe la VRAIE validation de BullMQ
 * (`Job.prototype.validateOptions`, BullMQ 5.81.3) : ni « : », ni entier.
 * Une tâche refusée par BullMQ ne serait jamais mise en file — et l'étape du
 * circuit attendrait pour toujours, sans erreur visible.
 *
 * Mutation qui fait rougir : séparer par « : » dans `idTacheVisio` → rouge.
 * Contre-témoin : un identifiant avec « : » EST refusé par la même validation
 * (preuve qu'on appelle bien la vraie).
 * Angle mort : la validation de BullMQ peut changer avec sa version ; le test
 * lit la version installée.
 */

import { Job } from "bullmq";
import { describe, expect, it } from "vitest";

import { idPassageBalayage, idTacheVisio } from "../id-tache";

function validerParBullmq(jobId: string): void {
  const validate = (Job.prototype as unknown as { validateOptions: (d: unknown) => void })
    .validateOptions;
  validate.call({ opts: { jobId }, name: "t" }, { data: "{}" });
}

const RENCONTRE = "3f2a9c1e-7b4d-4e8a-9c2b-1d5e6f7a8b9c";

describe("⛔ un identifiant de tâche visio est accepté par BullMQ", () => {
  it("les identifiants du circuit passent", () => {
    for (const etape of ["transcrire", "extraire", "verifier_faits", "rattacher"]) {
      expect(() => validerParBullmq(idTacheVisio(etape, RENCONTRE, 1))).not.toThrow();
    }
    expect(() => validerParBullmq(idPassageBalayage(new Date()))).not.toThrow();
  });

  it("forme et unicité : visio-<étape>-<rencontre>-<exécution>", () => {
    expect(idTacheVisio("transcrire", RENCONTRE, 2)).toBe(`visio-transcrire-${RENCONTRE}-2`);
    expect(idTacheVisio("transcrire", RENCONTRE, 2)).not.toBe(
      idTacheVisio("transcrire", RENCONTRE, 3),
    );
  });

  it("contre-témoin : la validation de BullMQ refuse « : » et un entier", () => {
    expect(() => validerParBullmq(`visio:transcrire:${RENCONTRE}:1`)).toThrow(/cannot contain/);
    expect(() => validerParBullmq("42")).toThrow(/integers/);
  });

  it("une étape ou une rencontre invalide est refusée avant BullMQ", () => {
    expect(() => idTacheVisio("Transcrire:", RENCONTRE, 1)).toThrow();
    expect(() => idTacheVisio("transcrire", "pas-un-id", 1)).toThrow();
    expect(() => idTacheVisio("transcrire", RENCONTRE, -1)).toThrow();
  });
});
