/**
 * 🛑 AUCUN EFFACEMENT AUTOMATIQUE DE DONNÉES DE PERSONNES OU D'ÉCHANGES.
 *
 * **Décision du responsable de traitement, 2026-10-07** : « non je ne veux
 * surtout pas d'effacement », puis « coupe tous les effacements ». Elle
 * prolonge ses ordres du 29/09 (« strictement interdit de purger quoi que ce
 * soit et de perdre des contacts ») et du 03/10 (« je veux tout qu'on garde et
 * surtout pas qu'on efface quoi que ce soit »).
 *
 * Même forme que `prospection-aucune-purge-automatique.spec.ts` : ce fichier
 * ne rappelle rien, il **empêche**. Si une suppression de données de
 * personnes réapparaît dans le worker de purge — par un correctif automatique,
 * une reprise d'audit, ou quelqu'un qui « répare » la rétention sans connaître
 * la décision — la suite rougit.
 *
 * ## Ce que le worker a encore le droit de purger
 *
 * Des tables TECHNIQUES, sans personne ni échange : `generationLog`,
 * `webVitalSample`, `funnelEvent` (mesure d'audience sans bannière : la CNIL
 * EXIGE une rétention bornée), `chatSemanticCache`, `chatActionIdempotency`,
 * et la file CRM déjà acquittée (`purgerOutboxCrm`). Toute autre suppression
 * observée à l'exécution fait rougir le cas « liste blanche ».
 *
 * ## Ce qui n'est pas concerné
 *
 * Les effacements MANUELS — console, droit à l'effacement (`api/gdpr-erase`),
 * suppression d'une candidature — ne vivent pas dans ce worker et ne sont pas
 * touchés. Les fonctions de purge de `newsletter/retention.ts`,
 * `lib/rgpd-erase.ts` et `visio/` existent toujours ; seul leur APPEL
 * planifié est retiré.
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
 * ⚠️ Les commentaires sont RETIRÉS avant analyse : le worker raconte en prose
 * ce qu'il ne fait plus. Un test statique qui trouverait ses propres
 * explications serait un faux positif.
 */
function sansCommentaires(source: string): string {
  return source
    .replace(/\/\*[\s\S]*?\*\//g, (bloc) => bloc.replace(/[^\n]/g, ""))
    .replace(/^[ \t]*\/\/.*$/gm, "");
}

/** Modèles Prisma qui portent des personnes ou des échanges : jamais supprimés ici. */
const MODELES_INTOUCHABLES = [
  "jobApplication",
  "submission",
  "activityLog",
  "calendlyEvent",
  "newsletterSubscriber",
  "guideRequest",
  "consentEvent",
  "chatConversation",
  "chatMessage",
  "chatEscalation",
  "emailLog",
  "emailLogContent",
  "emailOutbox",
  "prospectionAccessLog",
  "prospectionCompany",
  "prospectionPerson",
  "prospectionHealthPractitioner",
  "venteBrouillon",
  "costLedger",
  "imageUsageLog",
  "imageDownloadLog",
  "rencontre",
  "transcriptionSegment",
  "compteRendu",
  "enregistrementConsentement",
] as const;

/** Fonctions de purge qui ne doivent plus être APPELÉES par le worker. */
const APPELS_INTERDITS = [
  "purgerDesinscrits",
  "purgerLettreEtGuide",
  "purgerSegmentsAnciens",
  "purgerVersionsComptesRendus",
  "viderFaitsRejetes",
  "purgerDossiersVisioEchus",
  "purgerPreuvesAccordEchues",
  "figerRencontresAvantPurge",
  "executerPurgeVisio",
  "deleteCv",
  "supprimerVideosCandidature",
] as const;

/** Les seules tables que la passe a le droit de purger. */
const PURGES_TECHNIQUES_AUTORISEES = [
  "generationLog",
  "webVitalSample",
  "funnelEvent",
  "chatSemanticCache",
  "chatActionIdempotency",
] as const;

// ── Harnais d'exécution : Prisma mocké, aucun accès à une vraie base ──────────

const suppressions = new Map<string, number>();

function enregistrer(modele: string) {
  const noter = () => suppressions.set(modele, (suppressions.get(modele) ?? 0) + 1);
  return {
    deleteMany: vi.fn(async () => {
      noter();
      return { count: 0 };
    }),
    delete: vi.fn(async () => {
      noter();
      return {};
    }),
    findMany: vi.fn(async () => []),
    count: vi.fn(async () => 0),
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

const { purgerOutboxCrm, captureWorkerError } = vi.hoisted(() => ({
  purgerOutboxCrm: vi.fn(async () => 0),
  captureWorkerError: vi.fn(),
}));
vi.mock("@/server/newsletter/retention", () => ({ purgerOutboxCrm }));
vi.mock("bullmq", () => ({ Worker: class {} }));
vi.mock("../connection", () => ({ getBullConnectionOrThrow: () => ({}) }));
vi.mock("@/server/queue/lib/sentry-worker", () => ({ captureWorkerError }));

import { executerPurgeRetention } from "../retention-purge-worker";

describe("🛑 aucun effacement automatique de données de personnes", () => {
  it("le fichier du worker est bien lu — sinon la garde ne garde rien", () => {
    // Témoin de NON-VACUITÉ : une source vide ou tronquée passerait tout au vert.
    const code = sansCommentaires(readFileSync(SOURCE, "utf8"));
    expect(code).toContain("executerPurgeRetention");
    expect(code.length).toBeGreaterThan(2_500);
  });

  it("🛑 aucune suppression sur un modèle qui porte des personnes ou des échanges", () => {
    const code = sansCommentaires(readFileSync(SOURCE, "utf8"));
    const fautifs = MODELES_INTOUCHABLES.filter((m) =>
      new RegExp(`\\.${m}\\s*\\.\\s*delete`).test(code),
    );
    expect(
      fautifs,
      "Une suppression automatique a été réintroduite sur des données de personnes. " +
        "C'est INTERDIT par décision du responsable de traitement (2026-10-07) : elles se " +
        "conservent et ne s'effacent qu'à la main. Ne pas « réparer » la rétention ici sans " +
        "un nouvel arbitrage explicite de sa part.",
    ).toEqual([]);
  });

  it("🛑 aucune fonction de purge de personnes n'est appelée par le worker", () => {
    const code = sansCommentaires(readFileSync(SOURCE, "utf8"));
    const fautifs = APPELS_INTERDITS.filter((f) => new RegExp(`\\b${f}\\s*\\(`).test(code));
    expect(fautifs, "purge planifiée réintroduite (décision du 2026-10-07)").toEqual([]);
  });

  it("🛑 aucune lecture de durée ne réarme une purge retirée", () => {
    const code = sansCommentaires(readFileSync(SOURCE, "utf8"));
    for (const variable of [
      "RETENTION_LOGS_MONTHS",
      "RETENTION_GDPR_TRACES_MONTHS",
      "RETENTION_CALENDLY_MONTHS",
      "RETENTION_NEWSLETTER_UNSUB_MONTHS",
      "RETENTION_COST_LEDGER_MONTHS",
      "RETENTION_IMAGE_LOGS_MONTHS",
      "RETENTION_EMAIL_LOGS_MONTHS",
      "RETENTION_EMAIL_LOGS_MARKETING_MONTHS",
      "RETENTION_EMAIL_CONTENTS_MONTHS",
      "RETENTION_EMAIL_OUTBOX_MONTHS",
      "RETENTION_PROSPECTION_ACCESS_MONTHS",
      "RETENTION_CANDIDATURES_MONTHS",
      "RETENTION_SUBS_ARCHIVE_MONTHS",
    ]) {
      expect(code, variable).not.toContain(variable);
    }
  });

  describe("à l'exécution, sur un Prisma mocké", () => {
    beforeEach(async () => {
      suppressions.clear();
      purgerOutboxCrm.mockClear();
      captureWorkerError.mockClear();
      await executerPurgeRetention();
    });

    it("la passe tourne sans erreur et exécute TOUTES les purges techniques restantes", () => {
      // Témoin inverse : un correctif qui viderait tout le worker passerait les
      // cas ci-dessus. On prouverait l'obéissance par la destruction.
      for (const modele of PURGES_TECHNIQUES_AUTORISEES) {
        expect(suppressions.get(modele) ?? 0, `${modele} n'est plus purgé`).toBeGreaterThan(0);
      }
      expect(purgerOutboxCrm).toHaveBeenCalledTimes(1);
      expect(captureWorkerError).not.toHaveBeenCalled();
    });

    it("🛑 liste blanche : la passe ne supprime RIEN d'autre que les tables techniques", () => {
      const autorisees = new Set<string>(PURGES_TECHNIQUES_AUTORISEES);
      const horsListe = [...suppressions.keys()].filter((m) => !autorisees.has(m));
      expect(
        horsListe,
        "suppression hors des tables techniques autorisées (décision du 2026-10-07)",
      ).toEqual([]);
    });
  });
});
