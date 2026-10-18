/**
 * Faux client Prisma EN MÉMOIRE pour les tests de la réception : juste les
 * opérations que `reception.ts` appelle. Les contraintes d'unicité de la vraie
 * base (slug, studio_video_id, nonce) sont rejouées — elles sont prouvées
 * contre un vrai Postgres par `tests/integration/videos/schema.spec.ts`.
 */
type Ligne = Record<string, unknown>;

function p2002(): Error {
  return Object.assign(new Error("Unique constraint failed"), { code: "P2002" });
}

export function creerFauxPrisma() {
  const videos: Ligne[] = [];
  const journal: Ligne[] = [];
  const ecritures: string[] = [];

  const client = {
    siteVideo: {
      findUnique: async ({ where }: { where: Ligne }) =>
        videos.find((v) => Object.entries(where).every(([k, val]) => v[k] === val)) ?? null,
      create: async ({ data }: { data: Ligne }) => {
        ecritures.push("siteVideo.create");
        if (videos.some((v) => v.slug === data.slug || v.studioVideoId === data.studioVideoId)) {
          throw p2002();
        }
        const ligne = {
          id: `id-${videos.length + 1}`,
          statut: "publiee",
          retireeLe: null,
          ...data,
        };
        videos.push(ligne);
        return ligne;
      },
      update: async ({ where, data }: { where: Ligne; data: Ligne }) => {
        ecritures.push("siteVideo.update");
        const v = videos.find((x) => Object.entries(where).every(([k, val]) => x[k] === val));
        if (!v) throw new Error("introuvable");
        Object.assign(v, data);
        return v;
      },
    },
    siteVideoReception: {
      findUnique: async ({ where }: { where: { nonce: string } }) =>
        journal.find((l) => l.nonce === where.nonce) ?? null,
      create: async ({ data }: { data: Ligne }) => {
        ecritures.push("siteVideoReception.create");
        if (journal.some((l) => l.nonce === data.nonce)) throw p2002();
        journal.push({ ...data });
        return data;
      },
    },
    $transaction: async <T>(fn: (tx: unknown) => Promise<T>): Promise<T> => {
      // Instantané : une erreur annule tout, comme un ROLLBACK.
      const avantV = videos.map((v) => ({ ...v }));
      const avantJ = journal.map((l) => ({ ...l }));
      try {
        return await fn(client);
      } catch (e) {
        videos.splice(0, videos.length, ...avantV);
        journal.splice(0, journal.length, ...avantJ);
        throw e;
      }
    },
  };

  return { client, videos, journal, ecritures };
}
