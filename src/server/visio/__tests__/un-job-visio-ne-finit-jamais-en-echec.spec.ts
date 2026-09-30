// @vitest-environment node
/**
 * ⛔ UN JOB DE LA FILE `visio` NE FINIT JAMAIS EN ÉCHEC.
 *
 * L'identifiant d'une étape en file est déterministe
 * (`visio-<rencontre>-<étape>`) pour dédoublonner. Si un job LÈVE hors de
 * `executerEtape` (base indisponible à la prise, au balayage…), BullMQ le
 * range parmi les jobs échoués ; tant qu'il y reste, tout `add` avec le même
 * identifiant est IGNORÉ : l'étape repasse « à faire » en base et plus rien ne
 * l'exécute, sans alerte.
 *
 * Deux défenses, chacune gardée ici :
 *   · `traiterJobVisio` attrape toute erreur (Sentry, puis reprise au balayage) ;
 *   · la file déclare `removeOnFail: true` au registre (`queues.ts`).
 *
 * Mutation qui rougit : retirer le `try/catch` de `traiterJobVisio`, ou
 * repasser `removeOnFail` à `{ count: 200 }`.
 * Angle mort : un arrêt brutal du processus (OOM) laisse un job « bloqué »,
 * que BullMQ reprend lui-même (`stalled`) ; il n'est pas simulé ici.
 */

import { readFileSync } from "node:fs";
import path from "node:path";

import type { Job } from "bullmq";
import { describe, expect, it, vi } from "vitest";

const capture = vi.hoisted(() => vi.fn());
vi.mock("@/server/queue/lib/sentry-worker", () => ({ captureWorkerError: capture }));
vi.mock("@/server/queue/queues", () => ({ VISIO_QUEUE_NAME: "visio", visioQueue: null }));

import type { VisioJobData } from "@/server/queue/types";
import { traiterJobVisio } from "@/server/queue/workers/visio-worker";

const JOB = {
  id: "visio-r1-transcrire",
  name: "etape",
  data: { v: 1, rencontreId: "r1", etape: "transcrire" },
} as unknown as Job<VisioJobData>;

describe("⛔ un job visio ne finit jamais en échec", () => {
  it("une erreur hors de l'étape (base coupée) est remontée, jamais relancée à BullMQ", async () => {
    vi.spyOn(console, "error").mockImplementation(() => undefined);
    await expect(
      traiterJobVisio(JOB, async () => {
        throw new Error("connexion à la base perdue");
      }),
    ).resolves.toBeUndefined();
    expect(capture).toHaveBeenCalledTimes(1);
  });

  it("contre-témoin : un job qui réussit ne remonte rien", async () => {
    capture.mockClear();
    await traiterJobVisio(JOB, async () => undefined);
    expect(capture).not.toHaveBeenCalled();
  });

  it("la file `visio` du registre ne garde pas les jobs échoués", () => {
    const code = readFileSync(path.resolve(__dirname, "../../queue/queues.ts"), "utf8");
    const bloc = /export const visioQueue[\s\S]*?: null;/.exec(code)?.[0] ?? "";
    expect(bloc).toContain("VISIO_QUEUE_NAME");
    expect(bloc).toMatch(/removeOnFail:\s*true/);
  });
});
