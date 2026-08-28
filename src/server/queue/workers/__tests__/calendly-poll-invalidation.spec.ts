// Le worker de sondage invalide-t-il RÉELLEMENT les créneaux ?
//
// ## Le défaut que ce fichier empêche de revenir
//
// Mesuré le 2026-08-27, et c'était LE défaut vivant du parcours de réservation.
//
// La chaîne d'invalidation existait depuis le 2026-08-26, écrite et déployée.
// Elle n'a jamais rien purgé, pour une raison d'un seul champ : la passe
// `revalidate-slots` envoyait `{ tags: [...] }` **sans `paths`**.
//
// Or les deux moitiés n'ont pas la même sémantique côté Next :
//   · les CHEMINS passent par `revalidatePath`, appelé sans profil → expiration
//     dure. Et comme l'entrée `fetch` des créneaux porte l'étiquette implicite
//     du chemin, la purger par le chemin la purge vraiment ;
//   · les ÉTIQUETTES passaient par un profil de cacheLife → l'entrée était
//     seulement marquée *périmée*, et Next servait la version périmée au
//     visiteur suivant.
//
// Le seul appelant vivant était donc le seul à n'envoyer que la moitié qui
// n'expire pas. Le webhook envoyait la bonne — mais il est éteint tant que le
// plan Calendly est gratuit.
//
// ## Pourquoi tester le worker et pas la fonction
//
// La fonction `invaliderCreneaux` était CORRECTE et testée. C'est son absence
// d'appelant vivant qui cassait. Un test de plus sur elle n'aurait rien vu :
// il faut éprouver ce que le worker ENVOIE.

import { describe, it, expect, vi, beforeEach } from "vitest";

const revalidateContentMock = vi.fn();
vi.mock("@/server/content-gen/shared/revalidate-content", () => ({
  revalidateContent: (...a: unknown[]) => revalidateContentMock(...a),
}));

const discoverMock = vi.fn();
vi.mock("@/server/calendly/discover", () => ({
  discoverNewCalendlyEvents: () => discoverMock(),
}));

const refreshMock = vi.fn();
vi.mock("@/server/calendly/refresh", () => ({
  refreshUpcomingCalendlyEvents: () => refreshMock(),
}));

// Le jeton doit paraître posé, sinon `processJob` sort en première ligne et le
// test mesurerait la garde au lieu de l'invalidation.
vi.mock("@/server/calendly/api", () => ({
  isCalendlyApiConfigured: () => true,
  CALENDLY_API_BASE: "https://api.calendly.com",
}));

vi.mock("@/server/queue/lib/sentry-worker", () => ({ captureWorkerError: vi.fn() }));

// 🔑 On capture le processeur passé à `new Worker` : c'est la seule façon
// d'atteindre `processJob`, qui n'est pas exporté. Le tester par un export
// dédié changerait le code pour le test — ici on éprouve ce qui tourne vraiment.
type Processeur = (job: { data: { type: string } }) => Promise<void>;
let processeur: Processeur | null = null;
vi.mock("bullmq", () => ({
  Worker: class {
    constructor(_nom: string, proc: Processeur) {
      processeur = proc;
    }
    on() {
      return this;
    }
  },
  Queue: class {},
}));

import { CALENDLY_SLOTS_TAG } from "@/server/calendly/availability";
import { CALENDLY_SLOTS_PATHS } from "@/server/calendly/revalider-creneaux";

async function chargerProcesseur(): Promise<Processeur> {
  process.env["REDIS_URL"] = "redis://localhost:6379";
  const mod = await import("../calendly-poll-worker");
  mod.startCalendlyPollWorker();
  if (!processeur)
    throw new Error("le processeur n'a pas été capturé — le mock de bullmq a changé");
  return processeur;
}

beforeEach(() => {
  vi.clearAllMocks();
  revalidateContentMock.mockResolvedValue({ ok: true });
  discoverMock.mockResolvedValue({ ok: true, scanned: 0, created: 0 });
  refreshMock.mockResolvedValue({ ok: true, updated: 0 });
});

describe("passe revalidate-slots", () => {
  it("envoie les CHEMINS et pas seulement les étiquettes", async () => {
    // 🔴 LE CAS QUI COMPTE. Sur `origin/main`, l'appel ne portait que `tags` :
    // ce cas échoue avec `paths: undefined`.
    const proc = await chargerProcesseur();
    await proc({ data: { type: "revalidate-slots" } });

    expect(revalidateContentMock).toHaveBeenCalledOnce();
    const envoye = revalidateContentMock.mock.calls[0]?.[0] as {
      tags?: string[];
      paths?: string[];
      purgeEdge?: boolean;
    };
    expect(envoye.tags).toContain(CALENDLY_SLOTS_TAG);
    expect(
      envoye.paths,
      "sans `paths`, seule la moitié qui n'expire pas est envoyée : le visiteur suivant reçoit la liste périmée",
    ).toEqual([...CALENDLY_SLOTS_PATHS]);
  });

  it("ne purge PAS l'edge — /fr/appel répond no-store", async () => {
    // Sans ça, ce cron de 2 minutes émettrait 720 purges Cloudflare par jour sur
    // une page qui sort en `cf-cache-status: BYPASS`, à même le quota du plan
    // gratuit.
    const proc = await chargerProcesseur();
    await proc({ data: { type: "revalidate-slots" } });

    const envoye = revalidateContentMock.mock.calls[0]?.[0] as { purgeEdge?: boolean };
    expect(envoye.purgeEdge).toBe(false);
  });
});

describe("passe discover", () => {
  it("invalide les créneaux quand une réservation vient d'être découverte", async () => {
    // Cette passe tourne à la MINUTE et sait qu'un créneau vient de fermer.
    // Ne pas invalider ici, c'est attendre le cron des 2 minutes pour rien.
    discoverMock.mockResolvedValue({ ok: true, scanned: 3, created: 1 });
    const proc = await chargerProcesseur();
    await proc({ data: { type: "discover" } });

    expect(revalidateContentMock).toHaveBeenCalledOnce();
    const envoye = revalidateContentMock.mock.calls[0]?.[0] as { paths?: string[] };
    expect(envoye.paths).toEqual([...CALENDLY_SLOTS_PATHS]);
  });

  it("n'invalide RIEN quand rien n'a été découvert", async () => {
    // Témoin négatif. Sans lui, une invalidation inconditionnelle passerait le
    // cas précédent tout en multipliant par 60 les défauts de cache — et
    // personne ne verrait la différence dans un test.
    discoverMock.mockResolvedValue({ ok: true, scanned: 3, created: 0 });
    const proc = await chargerProcesseur();
    await proc({ data: { type: "discover" } });

    expect(revalidateContentMock).not.toHaveBeenCalled();
  });
});
