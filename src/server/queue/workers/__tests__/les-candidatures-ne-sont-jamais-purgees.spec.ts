/**
 * 🛑 LES CANDIDATURES ET LES DOSSIERS D'APPORTEURS NE SONT JAMAIS SUPPRIMÉS
 * AUTOMATIQUEMENT.
 *
 * **Décision du responsable de traitement, 2026-10-07** : « non je ne veux
 * surtout pas d'effacement ». Elle prolonge ses ordres du 29/09 (« strictement
 * interdit de purger quoi que ce soit et de perdre des contacts ») et du 03/10
 * (« je veux tout qu'on garde et surtout pas qu'on efface quoi que ce soit »).
 *
 * Portée : `JobApplication` (candidatures aux offres, avec leurs CV,
 * photographies et vidéos) et `Submission` (candidats apporteurs classés
 * « sans suite », et toute autre fiche archivée). Les deux blocs du worker qui
 * les supprimaient à 24 mois ont été **retirés** — pas désactivés par un
 * drapeau : retirés.
 *
 * ## Ce que ce fichier garde, et pourquoi il n'est pas un rappel
 *
 * Il ne rappelle rien : il **empêche**. Si une suppression de candidature, de
 * fiche ou de leurs fichiers réapparaît un jour dans le worker — par un
 * correctif automatique, une reprise d'audit, ou quelqu'un qui « répare » la
 * rétention sans connaître la décision — la suite rougit.
 *
 * ## Pourquoi retirer le code plutôt que le désactiver
 *
 * Un drapeau à `false` se bascule, et il aurait laissé croire que la question
 * restait ouverte. Elle est tranchée.
 *
 * ## Ce qui n'est pas concerné
 *
 * - L'effacement MANUEL : `deleteApplicationAction` (console) et
 *   `api/gdpr-erase` (droit à l'effacement). Ce sont des gestes, pas une
 *   horloge, et ils ne vivent pas dans ce worker.
 * - Les purges techniques restantes du worker, et le reste de la décision
 *   « aucun effacement automatique » (2026-10-07), gardé par
 *   `aucun-effacement-automatique-de-personnes.spec.ts`.
 *
 * ## Remplace `les-dossiers-recrutes-ne-sont-jamais-purges.spec.ts`
 *
 * Ce verrou-là gardait l'exclusion des personnes recrutées (`D4`) À L'INTÉRIEUR
 * d'une purge qui n'existe plus. Il exigeait aussi que les refus restent purgés
 * à 24 mois. Sa garantie — aucun dossier de personne recrutée ne part tout
 * seul — est incluse dans celle-ci, qui la généralise à toutes les candidatures.
 */

import { describe, it, expect, vi, beforeEach } from "vitest";
import { readFileSync } from "node:fs";
import { join } from "node:path";

const SOURCE = join(
  process.cwd(),
  "src",
  "server",
  "queue",
  "workers",
  "retention-purge-worker.ts",
);

/**
 * ⚠️ Les commentaires sont RETIRÉS avant analyse. Le worker raconte en prose
 * pourquoi la purge des candidatures a été retirée — un test statique qui
 * trouverait ses propres explications serait un faux positif, et le dépôt l'a
 * déjà payé.
 */
function sansCommentaires(source: string): string {
  return source
    .replace(/\/\*[\s\S]*?\*\//g, (bloc) => bloc.replace(/[^\n]/g, ""))
    .replace(/^[ \t]*\/\/.*$/gm, "");
}

const MODELES_INTOUCHABLES = ["jobApplication", "submission"] as const;

/** Les appels qui effacent les fichiers d'un candidat (CV, photo, vidéos). */
const EFFACEMENTS_DE_FICHIERS = ["deleteCv(", "supprimerVideosCandidature("] as const;

// ── Harnais de comportement : Prisma mocké, aucun accès à une vraie base ──────

/** Méthodes appelées, par modèle. */
const appelsParModele = new Map<string, string[]>();

function enregistrer(modele: string) {
  const noter = (methode: string) => {
    if (!appelsParModele.has(modele)) appelsParModele.set(modele, []);
    appelsParModele.get(modele)!.push(methode);
  };
  return {
    findMany: vi.fn(async () => {
      noter("findMany");
      return [];
    }),
    deleteMany: vi.fn(async () => {
      noter("deleteMany");
      return { count: 0 };
    }),
    delete: vi.fn(async () => {
      noter("delete");
      return {};
    }),
    count: vi.fn(async () => {
      noter("count");
      return 0;
    }),
    update: vi.fn(async () => ({})),
    updateMany: vi.fn(async () => ({ count: 0 })),
    create: vi.fn(async () => ({})),
  };
}

vi.mock("@/lib/prisma", () => {
  const cache = new Map<string, ReturnType<typeof enregistrer>>();
  return {
    prisma: new Proxy(
      {},
      {
        get(_cible, modele: string, recepteur: unknown) {
          if (modele === "$transaction") {
            return (fn: (tx: unknown) => unknown) => fn(recepteur);
          }
          if (!cache.has(modele)) cache.set(modele, enregistrer(modele));
          return cache.get(modele);
        },
      },
    ),
  };
});

const { deleteCv, supprimerVideosCandidature } = vi.hoisted(() => ({
  deleteCv: vi.fn(async () => undefined),
  supprimerVideosCandidature: vi.fn(async () => undefined),
}));
vi.mock("@/server/careers/cv-storage", () => ({ deleteCv }));
vi.mock("@/server/careers/videos-candidat", () => ({ supprimerVideosCandidature }));
vi.mock("bullmq", () => ({ Worker: class {} }));
vi.mock("../connection", () => ({ getBullConnectionOrThrow: () => ({}) }));
vi.mock("@/server/queue/lib/sentry-worker", () => ({ captureWorkerError: vi.fn() }));
vi.mock("@/server/newsletter/retention", () => ({ purgerOutboxCrm: vi.fn(async () => 0) }));

import { executerPurgeRetention } from "../retention-purge-worker";

describe("🛑 candidatures et dossiers d'apporteurs — aucune suppression automatique", () => {
  it("le fichier du worker est bien lu — sinon la garde ne garde rien", () => {
    // Témoin de NON-VACUITÉ. Une source vide ou tronquée passerait tous les cas
    // ci-dessous au vert, et l'absence d'alerte se lirait comme une absence de
    // problème.
    const code = sansCommentaires(readFileSync(SOURCE, "utf8"));
    expect(code).toContain("executerPurgeRetention");
    expect(code.length).toBeGreaterThan(2_500);
  });

  it("🛑 aucune suppression de candidature ni de fiche dans le worker", () => {
    const code = sansCommentaires(readFileSync(SOURCE, "utf8"));
    const fautifs = MODELES_INTOUCHABLES.filter((m) =>
      new RegExp(`\\.${m}\\s*\\.\\s*delete`).test(code),
    );
    expect(
      fautifs,
      "Une suppression automatique a été réintroduite sur les candidatures ou les " +
        "fiches (apporteurs, contacts). C'est INTERDIT par décision du responsable de " +
        "traitement (2026-10-07) : elles se conservent et ne s'effacent qu'à la main. " +
        "Ne pas « réparer » la rétention ici sans un nouvel arbitrage explicite de sa part.",
    ).toEqual([]);
  });

  it("🛑 aucun effacement de CV, de photo ou de vidéo dans le worker", () => {
    const code = sansCommentaires(readFileSync(SOURCE, "utf8"));
    const fautifs = EFFACEMENTS_DE_FICHIERS.filter((appel) => code.includes(appel));
    expect(
      fautifs,
      "Le worker efface de nouveau des fichiers de candidats. Ils suivent leur dossier : " +
        "aucun effacement automatique (décision du 2026-10-07).",
    ).toEqual([]);
  });

  it("🛑 aucune variable d'environnement ne réarme la purge", () => {
    // Retirer le code mais garder la lecture de la variable laisserait croire
    // qu'une durée s'applique encore — et préparerait le retour du bloc.
    const code = sansCommentaires(readFileSync(SOURCE, "utf8"));
    expect(code).not.toContain("RETENTION_CANDIDATURES_MONTHS");
    expect(code).not.toContain("RETENTION_SUBS_ARCHIVE_MONTHS");
  });

  it("les autres purges restent en place — elles ne sont pas concernées par la décision", () => {
    // Témoin inverse : sans lui, un correctif qui viderait tout le worker ferait
    // passer les cas ci-dessus en supprimant aussi des purges légitimes. On
    // prouverait l'obéissance par la destruction.
    const code = sansCommentaires(readFileSync(SOURCE, "utf8"));
    expect(code).toMatch(/prisma\.generationLog\s*\.\s*deleteMany/);
    expect(code).toMatch(/prisma\.webVitalSample\s*\.\s*deleteMany/);
  });

  describe("à l'exécution, sur un Prisma mocké", () => {
    beforeEach(async () => {
      appelsParModele.clear();
      deleteCv.mockClear();
      supprimerVideosCandidature.mockClear();
      await executerPurgeRetention();
    });

    it("la passe a bien tourné — sinon la garde ne regarde rien", () => {
      // Témoin de NON-VACUITÉ : la passe touche d'autres tables.
      expect(appelsParModele.get("webVitalSample") ?? []).toContain("deleteMany");
    });

    it("🛑 la passe ne supprime aucune candidature ni aucune fiche", () => {
      for (const modele of MODELES_INTOUCHABLES) {
        const suppressions = (appelsParModele.get(modele) ?? []).filter((m) =>
          m.startsWith("delete"),
        );
        expect(suppressions, `${modele} : suppression pendant la purge`).toEqual([]);
      }
    });

    it("🛑 la passe n'efface aucun fichier de candidat", () => {
      expect(deleteCv).not.toHaveBeenCalled();
      expect(supprimerVideosCandidature).not.toHaveBeenCalled();
    });
  });
});
