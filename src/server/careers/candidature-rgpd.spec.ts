/**
 * 🔴 `D5-5-03` — une candidature était hors de portée des droits RGPD.
 *
 * Ni exportée (art. 15), ni effacée (art. 17) — alors qu'elle porte le **CV**,
 * la **photo** et le **téléphone**, les données les plus sensibles que ce site
 * détienne sur une personne.
 *
 * Et le défaut était plus profond qu'un oubli de branchement : `email` est
 * chiffré par `encryptPii` avec un **IV aléatoire**. Deux chiffrements de la
 * même adresse donnent deux valeurs différentes, donc **une égalité SQL ne peut
 * jamais correspondre**. La candidature n'était pas oubliée : elle était
 * *introuvable*.
 *
 * 🔑 Exactement le défaut qui rendait l'export art. 15 des `Submission` vide,
 * corrigé là-bas par `contact_email_hash`. Le même remède, appliqué au même
 * problème, six mois plus tard : c'est un patron du dépôt, pas un accident.
 */

import { describe, it, expect, vi, beforeEach, afterEach } from "vitest";

const findMany = vi.fn();
const supprimer = vi.fn(async (_a: unknown) => ({}));
const supprimerFichier = vi.fn(async (_c: string) => undefined);

vi.mock("@/lib/prisma", () => ({
  prisma: {
    jobApplication: {
      findMany: (a: unknown) => findMany(a),
      delete: (a: unknown) => supprimer(a),
    },
  },
}));
vi.mock("@/server/careers/cv-storage", () => ({
  deleteCv: (c: string) => supprimerFichier(c),
}));

import { encryptPii } from "@/lib/pii-crypto";
import { hashEmailForLookup } from "@/lib/security/email-hash";
import { trouverCandidatures, effacerCandidaturesPour } from "./candidature-rgpd";

const CLE = "b".repeat(64);
const ORIGINE = process.env["PII_ENCRYPTION_KEY"];
const CIBLE = "alice@example.com";

beforeEach(() => {
  vi.clearAllMocks();
  process.env["PII_ENCRYPTION_KEY"] = CLE;
  findMany.mockResolvedValue([]);
});

afterEach(() => {
  if (ORIGINE === undefined) delete process.env["PII_ENCRYPTION_KEY"];
  else process.env["PII_ENCRYPTION_KEY"] = ORIGINE;
});

describe("🔴 trouverCandidatures — retrouver l'introuvable", () => {
  it("🔴 cherche par EMPREINTE, jamais par égalité sur l'adresse chiffrée", () => {
    // L'égalité SQL sur `email` ne peut JAMAIS correspondre : l'IV est
    // aléatoire. C'est ce qui rendait la candidature invisible aux deux droits.
    return trouverCandidatures(CIBLE).then(() => {
      const requetes = findMany.mock.calls.map((c) => JSON.stringify(c[0]));
      expect(
        requetes.some((r) => r.includes("emailHash")),
        "la recherche ne passe pas par l'empreinte",
      ).toBe(true);
      expect(
        requetes.some((r) => r.includes(`"email":"${CIBLE}"`)),
        "une égalité SQL sur l'adresse chiffrée est de retour — elle ne matchera jamais",
      ).toBe(false);
    });
  });

  it("trouve par empreinte", async () => {
    findMany.mockImplementation((args: { where: { emailHash?: string | null } }) =>
      Promise.resolve(
        args.where.emailHash === hashEmailForLookup(CIBLE)
          ? [{ id: "c-1", cvStoragePath: "/cv/1.pdf", photoStoragePath: null }]
          : [],
      ),
    );

    const { candidatures } = await trouverCandidatures(CIBLE);
    expect(candidatures.map((c) => c.id)).toEqual(["c-1"]);
  });

  it("🔴 RETROUVE aussi l'historique SANS empreinte, en déchiffrant", () => {
    // Les candidatures déposées avant la correction n'ont pas d'empreinte. Sans
    // ce repli, elles resteraient définitivement hors de portée des deux droits
    // — c'est-à-dire que le correctif ne réparerait que l'avenir.
    findMany.mockImplementation((args: { where: { emailHash?: string | null } }) =>
      Promise.resolve(
        args.where.emailHash === null
          ? [
              {
                id: "vieux-1",
                email: encryptPii(CIBLE),
                cvStoragePath: null,
                photoStoragePath: null,
              },
              {
                id: "autre",
                email: encryptPii("bob@example.com"),
                cvStoragePath: null,
                photoStoragePath: null,
              },
            ]
          : [],
      ),
    );

    return trouverCandidatures(CIBLE).then(({ candidatures }) => {
      expect(candidatures.map((c) => c.id)).toEqual(["vieux-1"]);
    });
  });

  it("ne rend JAMAIS deux fois la même candidature", async () => {
    // Les deux chemins peuvent se recouvrir. Un doublon ferait compter deux
    // suppressions pour une, et le courriel de confirmation mentirait sur un
    // chiffre que la personne conserve comme preuve.
    const ligne = { id: "c-1", cvStoragePath: null, photoStoragePath: null };
    findMany.mockImplementation((args: { where: { emailHash?: string | null } }) =>
      Promise.resolve(
        args.where.emailHash === null ? [{ ...ligne, email: encryptPii(CIBLE) }] : [ligne],
      ),
    );

    const { candidatures } = await trouverCandidatures(CIBLE);
    expect(candidatures).toHaveLength(1);
  });

  it("🔴 SIGNALE que le balayage a mordu son plafond", async () => {
    // Une recherche tronquée qui se présente comme complète est pire qu'une
    // recherche refusée : la personne croit son dossier vide, ou effacé.
    findMany.mockImplementation((args: { where: { emailHash?: string | null }; take?: number }) =>
      Promise.resolve(
        args.where.emailHash === null
          ? Array.from({ length: args.take ?? 1 }, (_, i) => ({
              id: `x-${i}`,
              email: encryptPii("qqn@example.com"),
              cvStoragePath: null,
              photoStoragePath: null,
            }))
          : [],
      ),
    );

    const { tronque } = await trouverCandidatures(CIBLE);
    expect(tronque).toBe(true);
  });
});

describe("🔴 effacerCandidaturesPour — le CV part avec la ligne", () => {
  beforeEach(() => {
    findMany.mockImplementation((args: { where: { emailHash?: string | null } }) =>
      Promise.resolve(
        args.where.emailHash === null
          ? []
          : [{ id: "c-1", cvStoragePath: "/cv/1.pdf", photoStoragePath: "/photo/1.jpg" }],
      ),
    );
  });

  it("🔴 supprime les FICHIERS, pas seulement l'enregistrement", async () => {
    // Effacer la ligne sans le fichier laisserait le CV sur le disque — la
    // donnée la plus sensible survivant à l'effacement, et désormais sans
    // aucune trace pour la retrouver.
    const r = await effacerCandidaturesPour(CIBLE);

    expect(supprimerFichier.mock.calls.map((c) => c[0])).toEqual(["/cv/1.pdf", "/photo/1.jpg"]);
    expect(r.fichiersSupprimes).toBe(2);
    expect(r.supprimees).toBe(1);
  });

  it("🔴 supprime la ligne MÊME si le fichier est déjà absent", async () => {
    // Sinon un fichier manquant — cas banal après une purge de rétention —
    // laisserait la candidature en base : l'inverse exact du droit exercé.
    supprimerFichier.mockRejectedValue(new Error("ENOENT"));

    const r = await effacerCandidaturesPour(CIBLE);
    expect(supprimer).toHaveBeenCalledTimes(1);
    expect(r.supprimees).toBe(1);
    expect(r.fichiersSupprimes).toBe(0);
  });

  it("ne supprime RIEN quand la personne n'a pas candidaté", async () => {
    // Témoin de non-vacuité : sans lui, une fonction qui supprimerait tout
    // ferait passer les deux cas ci-dessus.
    findMany.mockResolvedValue([]);

    const r = await effacerCandidaturesPour(CIBLE);
    expect(supprimer).not.toHaveBeenCalled();
    expect(r.supprimees).toBe(0);
  });
});
