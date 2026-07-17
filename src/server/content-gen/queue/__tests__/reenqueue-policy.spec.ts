/**
 * Fix 2026-07-17 — anti-zombie du ré-enfilage BullMQ.
 *
 * Régression couverte : `enqueueGenJob` faisait `queue.add({ jobId: gen-<id> })`
 * sans supprimer le job BullMQ précédent. Les jobs terminés restant dans Redis
 * (`removeOnFail: { age: 30j, count: 5000 }`), BullMQ no-oppait le `add` en
 * silence → job `queued` en DB, absent de Redis = ZOMBIE. Cause racine des
 * « 84 articles queued absents de Redis » (2026-06-27) ; 1046 jobs dans le set
 * `failed` en prod le 2026-07-17 → collision systématique.
 */

import { describe, expect, it } from "vitest";
import {
  resolveReenqueueAction,
  type BullJobState,
} from "@/server/content-gen/queue/reenqueue-policy";

describe("resolveReenqueueAction — le zombie ne peut plus se produire", () => {
  it("job `failed` encore en Redis → remove PUIS enqueue (le coeur du fix)", () => {
    // Sans le remove, le add no-oppe → zombie. C'est exactement le cas de
    // `retryAllFailed`, qui ne cible QUE des jobs failed.
    expect(resolveReenqueueAction("failed")).toBe("remove-then-enqueue");
  });

  it("job `completed` encore en Redis → remove PUIS enqueue", () => {
    expect(resolveReenqueueAction("completed")).toBe("remove-then-enqueue");
  });

  it("aucun job existant → enqueue direct", () => {
    expect(resolveReenqueueAction(null)).toBe("enqueue");
  });
});

describe("resolveReenqueueAction — l'idempotence RÉELLE est préservée", () => {
  // Le commentaire d'origine (« jobId empêche les doublons ») n'était vrai que
  // pour un job en vol. On conserve cette propriété, et elle seule.
  const inFlight: readonly BullJobState[] = [
    "active",
    "waiting",
    "waiting-children",
    "prioritized",
    "delayed",
  ];

  for (const state of inFlight) {
    it(`job \`${state}\` → ne touche à rien (pas de doublon, pas de remove)`, () => {
      expect(resolveReenqueueAction(state)).toBe("skip-in-flight");
    });
  }

  it("un job actif n'est JAMAIS supprimé (BullMQ refuse de retirer un job verrouillé)", () => {
    expect(resolveReenqueueAction("active")).not.toBe("remove-then-enqueue");
  });
});

describe("resolveReenqueueAction — cas limite", () => {
  it("`unknown` (clé purgée entre getJob et getState) → remove-then-enqueue", () => {
    // Le remove est alors un no-op inoffensif, mais il garantit que le add
    // ne no-oppera pas. On préfère cette voie à un skip qui recréerait un zombie.
    expect(resolveReenqueueAction("unknown")).toBe("remove-then-enqueue");
  });

  it("aucun état ne renvoie `skip` pour un job terminé", () => {
    // Garde-fou anti-régression : si quelqu'un ajoute un état terminal, il ne
    // doit pas silencieusement retomber dans le skip (= zombie).
    for (const s of ["completed", "failed", "unknown"] as const) {
      expect(resolveReenqueueAction(s)).not.toBe("skip-in-flight");
    }
  });
});
